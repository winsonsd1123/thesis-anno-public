-- 教育网申领：余额规则由「必须为 0」改为「须低于 100」
-- 与 lib/services/edu-credit-grant.service.ts 中 EDU_GRANT_MAX_BALANCE_EXCLUSIVE 保持一致
-- 在 Supabase SQL Editor 或 apply_migration 中执行

CREATE OR REPLACE FUNCTION public.claim_edu_credit_grant(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_window_id        uuid;
  v_max              integer;
  v_cnt              integer;
  v_email            text;
  v_confirmed        timestamptz;
  v_domain           text;
  v_balance_before   integer;
  v_balance_after    integer;
  v_claim_id         uuid;
  v_grant_amount     integer := 300;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'EDU_GRANT_INVALID_USER';
  END IF;

  SELECT w.id, w.max_claims
  INTO v_window_id, v_max
  FROM public.edu_credit_grant_windows w
  WHERE w.closed_at IS NULL
  ORDER BY w.opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_window_id IS NULL THEN
    RAISE EXCEPTION 'EDU_GRANT_NO_OPEN_WINDOW';
  END IF;

  v_cnt := (
    SELECT count(*)::integer
    FROM public.edu_credit_grant_claims c
    WHERE c.window_id = v_window_id
  );

  IF v_cnt >= v_max THEN
    UPDATE public.edu_credit_grant_windows
    SET closed_at = now()
    WHERE id = v_window_id AND closed_at IS NULL;
    RAISE EXCEPTION 'EDU_GRANT_QUOTA_FULL';
  END IF;

  SELECT u.email, u.email_confirmed_at
  INTO v_email, v_confirmed
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EDU_GRANT_USER_NOT_FOUND';
  END IF;

  IF v_confirmed IS NULL THEN
    RAISE EXCEPTION 'EDU_GRANT_EMAIL_NOT_CONFIRMED';
  END IF;

  v_domain := lower(trim(split_part(v_email, '@', 2)));
  IF v_domain IS NULL OR v_domain = '' THEN
    RAISE EXCEPTION 'EDU_GRANT_NOT_EDU_EMAIL';
  END IF;

  IF NOT (v_domain ~ '\.(edu|ac)\.cn$') THEN
    RAISE EXCEPTION 'EDU_GRANT_NOT_EDU_EMAIL';
  END IF;

  SELECT credits_balance
  INTO v_balance_before
  FROM public.user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EDU_GRANT_WALLET_NOT_FOUND';
  END IF;

  IF v_balance_before >= 100 THEN
    RAISE EXCEPTION 'EDU_GRANT_BALANCE_NOT_ZERO';
  END IF;

  BEGIN
    INSERT INTO public.edu_credit_grant_claims (window_id, user_id, credits)
    VALUES (v_window_id, p_user_id, v_grant_amount)
    RETURNING id INTO v_claim_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'EDU_GRANT_ALREADY_CLAIMED';
  END;

  v_balance_after := v_balance_before + v_grant_amount;

  UPDATE public.user_wallets
  SET
    credits_balance = v_balance_after,
    version         = version + 1,
    updated_at      = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    reference_id,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    p_user_id,
    v_grant_amount,
    'bonus'::transaction_type,
    v_claim_id::text,
    v_balance_before,
    v_balance_after,
    jsonb_build_object(
      'reason',    'edu_grant',
      'window_id', v_window_id,
      'claim_id',  v_claim_id
    )
  );

  IF v_cnt + 1 >= v_max THEN
    UPDATE public.edu_credit_grant_windows
    SET closed_at = now()
    WHERE id = v_window_id AND closed_at IS NULL;
  END IF;
END;
$func$;

REVOKE ALL ON FUNCTION public.claim_edu_credit_grant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_edu_credit_grant(uuid) TO service_role;
