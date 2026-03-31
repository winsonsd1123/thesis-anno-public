-- 与应用层 DEFAULT_REVIEW_PLAN_OPTIONS 对齐：格式维度默认勾选；RPC 在 p_plan_options 为空时同此默认。

ALTER TABLE public.reviews
  ALTER COLUMN plan_options SET DEFAULT '{"format":true,"logic":true,"aitrace":true,"reference":true}'::jsonb;

CREATE OR REPLACE FUNCTION public.start_review_and_deduct(
  p_review_id      bigint,
  p_total_cost     integer,
  p_cost_breakdown jsonb,
  p_plan_options   jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid;
  v_review       public.reviews%ROWTYPE;
  v_balance_before integer;
  v_balance_after  integer;
  v_plan         jsonb;
  v_fmt          boolean;
  v_logic        boolean;
  v_aitrace      boolean;
  v_ref          boolean;
  v_breakdown_total integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_total_cost IS NULL OR p_total_cost < 1 THEN
    RAISE EXCEPTION 'INVALID_CREDITS';
  END IF;

  IF p_cost_breakdown IS NOT NULL AND (p_cost_breakdown->>'total') IS NOT NULL THEN
    v_breakdown_total := (p_cost_breakdown->>'total')::integer;
    IF v_breakdown_total <> p_total_cost THEN
      RAISE EXCEPTION 'BREAKDOWN_MISMATCH';
    END IF;
  END IF;

  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;

  IF v_review.user_id <> v_uid THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;

  IF v_review.status <> 'pending'::review_status THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  v_plan := COALESCE(
    p_plan_options,
    '{"format":true,"logic":true,"aitrace":true,"reference":true}'::jsonb
  );

  v_fmt     := COALESCE((v_plan->>'format')::boolean,    true);
  v_logic   := COALESCE((v_plan->>'logic')::boolean,     true);
  v_aitrace := COALESCE((v_plan->>'aitrace')::boolean,  true);
  v_ref     := COALESCE((v_plan->>'reference')::boolean, true);

  IF NOT (v_fmt OR v_logic OR v_aitrace OR v_ref) THEN
    RAISE EXCEPTION 'PLAN_EMPTY';
  END IF;

  SELECT credits_balance INTO v_balance_before
  FROM public.user_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_balance_before < p_total_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  v_balance_after := v_balance_before - p_total_cost;

  UPDATE public.user_wallets
  SET
    credits_balance = v_balance_after,
    version         = version + 1,
    updated_at      = now()
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
    -p_total_cost,
    'consumption'::transaction_type,
    p_review_id::text,
    v_balance_before,
    v_balance_after,
    jsonb_build_object(
      'review_id',      p_review_id,
      'cost_breakdown', p_cost_breakdown
    )
  );

  UPDATE public.reviews
  SET
    status         = 'processing'::review_status,
    cost           = p_total_cost,
    cost_breakdown = p_cost_breakdown,
    plan_options   = v_plan,
    stages         = jsonb_build_array(
      jsonb_build_object('agent', 'format',    'status', CASE WHEN v_fmt     THEN 'pending' ELSE 'skipped' END),
      jsonb_build_object('agent', 'logic',     'status', CASE WHEN v_logic   THEN 'pending' ELSE 'skipped' END),
      jsonb_build_object('agent', 'aitrace',   'status', CASE WHEN v_aitrace THEN 'pending' ELSE 'skipped' END),
      jsonb_build_object('agent', 'reference', 'status', CASE WHEN v_ref     THEN 'pending' ELSE 'skipped' END)
    ),
    updated_at     = now(),
    error_message  = NULL
  WHERE id = p_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_review_and_deduct(bigint, integer, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_review_and_deduct(bigint, integer, jsonb, jsonb) TO authenticated;
