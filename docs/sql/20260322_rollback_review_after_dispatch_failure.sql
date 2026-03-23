-- Reference copy: applied via Supabase migration `rollback_review_after_dispatch_failure`
-- Trigger 派发失败或未配置时：退款 + 审阅回到 pending（与 start_review_and_deduct 对称）

CREATE OR REPLACE FUNCTION public.rollback_review_after_dispatch_failure(
  p_review_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_review public.reviews%ROWTYPE;
  v_balance_before integer;
  v_balance_after integer;
  v_cost integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;

  IF v_review.user_id <> v_uid THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;

  IF v_review.status <> 'processing'::review_status THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  IF v_review.trigger_run_id IS NOT NULL AND btrim(v_review.trigger_run_id) <> '' THEN
    RAISE EXCEPTION 'RUN_ALREADY_ATTACHED';
  END IF;

  v_cost := COALESCE(v_review.cost, 0);
  IF v_cost < 1 THEN
    RAISE EXCEPTION 'INVALID_COST';
  END IF;

  SELECT credits_balance INTO v_balance_before FROM public.user_wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  v_balance_after := v_balance_before + v_cost;

  UPDATE public.user_wallets
  SET
    credits_balance = v_balance_after,
    version = version + 1,
    updated_at = now()
  WHERE user_id = v_uid;

  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    reference_id,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    v_uid,
    v_cost,
    'refund'::transaction_type,
    p_review_id::text,
    v_balance_before,
    v_balance_after,
    jsonb_build_object('review_id', p_review_id, 'reason', 'trigger_dispatch_failed')
  );

  UPDATE public.reviews
  SET
    status = 'pending'::review_status,
    cost = 0,
    stages = '[]'::jsonb,
    trigger_run_id = NULL,
    error_message = NULL,
    updated_at = now()
  WHERE id = p_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_review_after_dispatch_failure(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollback_review_after_dispatch_failure(bigint) TO authenticated;
