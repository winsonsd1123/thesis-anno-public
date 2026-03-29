-- 教育网积分申领：窗口表 + 申领记录 + 原子 RPC
-- 在 Supabase SQL Editor 执行；与 billing RPC 同模式：SECURITY DEFINER，仅 service_role 可 EXECUTE。

-- ─────────────────────────────────────────
-- 1. 表
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.edu_credit_grant_windows (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at  timestamptz NOT NULL DEFAULT now(),
  closed_at  timestamptz NULL,
  opened_by  uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_edu_grant_windows_closed_at
  ON public.edu_credit_grant_windows (closed_at)
  WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.edu_credit_grant_claims (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id  uuid NOT NULL REFERENCES public.edu_credit_grant_windows (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  credits    int  NOT NULL DEFAULT 300 CHECK (credits > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, window_id)
);

CREATE INDEX IF NOT EXISTS idx_edu_grant_claims_window_id
  ON public.edu_credit_grant_claims (window_id);

ALTER TABLE public.edu_credit_grant_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_credit_grant_claims ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- 2. claim_edu_credit_grant
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_edu_credit_grant(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_window_id        uuid;
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

  SELECT w.id
  INTO v_window_id
  FROM public.edu_credit_grant_windows w
  WHERE w.closed_at IS NULL
  ORDER BY w.opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_window_id IS NULL THEN
    RAISE EXCEPTION 'EDU_GRANT_NO_OPEN_WINDOW';
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

  IF v_balance_before <> 0 THEN
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
END;
$func$;

REVOKE ALL ON FUNCTION public.claim_edu_credit_grant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_edu_credit_grant(uuid) TO service_role;

-- ─────────────────────────────────────────
-- 3. open_edu_credit_grant_window
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_edu_credit_grant_window(p_admin_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_new_id uuid;
BEGIN
  UPDATE public.edu_credit_grant_windows
  SET closed_at = now()
  WHERE closed_at IS NULL;

  INSERT INTO public.edu_credit_grant_windows (opened_by)
  VALUES (p_admin_id)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.open_edu_credit_grant_window(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_edu_credit_grant_window(uuid) TO service_role;

-- ─────────────────────────────────────────
-- 4. close_edu_credit_grant_window（无开放窗口时静默成功）
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_edu_credit_grant_window()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  UPDATE public.edu_credit_grant_windows
  SET closed_at = now()
  WHERE closed_at IS NULL;
END;
$func$;

REVOKE ALL ON FUNCTION public.close_edu_credit_grant_window() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_edu_credit_grant_window() TO service_role;
