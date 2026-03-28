-- Billing v2.0: 新版 start_review_and_deduct（四参数） + rollback 对称更新
-- 阶段二：Server Action 计算 totalCost/breakdown，RPC 不再重算，只验证与扣费。

-- ─────────────────────────────────────────
-- 1. 移除旧三参数重载（避免 Postgres 函数签名歧义）
-- ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.start_review_and_deduct(bigint, integer, jsonb);
DROP FUNCTION IF EXISTS public.start_review_and_deduct(bigint, integer);

-- ─────────────────────────────────────────
-- 2. 新版四参数函数
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_review_and_deduct(
  p_review_id      bigint,
  p_total_cost     integer,                  -- Server Action 计算，RPC 仅信任并扣减
  p_cost_breakdown jsonb,                    -- 各模块单价快照，写入 reviews.cost_breakdown
  p_plan_options   jsonb DEFAULT NULL        -- { logic:true, format:false, ... }，生成 stages
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

  -- 一致性校验：breakdown.total 若存在，必须与 p_total_cost 吻合（防篡改）
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

  -- plan_options 为 NULL 时使用与应用层一致的默认值
  v_plan := COALESCE(
    p_plan_options,
    '{"format":false,"logic":true,"aitrace":true,"reference":true}'::jsonb
  );

  v_fmt    := COALESCE((v_plan->>'format')::boolean,    false);
  v_logic  := COALESCE((v_plan->>'logic')::boolean,     true);
  v_aitrace := COALESCE((v_plan->>'aitrace')::boolean,  true);
  v_ref    := COALESCE((v_plan->>'reference')::boolean, true);

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

-- ─────────────────────────────────────────
-- 3. 更新 rollback：清空阶段一新增的列，保持对称
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rollback_review_after_dispatch_failure(
  p_review_id bigint
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
  v_cost         integer;
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
    v_cost,
    'refund'::transaction_type,
    p_review_id::text,
    v_balance_before,
    v_balance_after,
    jsonb_build_object('review_id', p_review_id, 'reason', 'trigger_dispatch_failed')
  );

  UPDATE public.reviews
  SET
    status          = 'pending'::review_status,
    cost            = 0,
    cost_breakdown  = NULL,
    refunded_amount = 0,
    stages          = '[]'::jsonb,
    trigger_run_id  = NULL,
    error_message   = NULL,
    updated_at      = now()
  WHERE id = p_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_review_after_dispatch_failure(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollback_review_after_dispatch_failure(bigint) TO authenticated;
