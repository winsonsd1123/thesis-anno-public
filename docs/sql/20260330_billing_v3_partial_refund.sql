-- Billing v2.0 Phase 3: Partial Refund Engine
-- 阶段三：局部退款核心引擎
--
-- 安全设计：两个 RPC 均仅授权 service_role（与 admin_patch_review_stage 同模式）。
-- Trigger.dev 编排器使用 createAdminClient()（service_role），无用户 JWT，
-- 故用 reviews.user_id 操作 user_wallets，而非 auth.uid()。

-- ─────────────────────────────────────────
-- 1. 扩展 transaction_type 枚举
-- ─────────────────────────────────────────
DO $$
BEGIN
  ALTER TYPE public.transaction_type ADD VALUE 'partial_refund';
EXCEPTION WHEN duplicate_object THEN
  NULL; -- 已存在则跳过
END $$;

-- ─────────────────────────────────────────
-- 2. admin_partial_refund_review_stage
--    从 reviews.cost_breakdown 快照读取退款额，幂等写回 stages
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_partial_refund_review_stage(
  p_review_id bigint,
  p_agent     text,
  p_reason    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_review         public.reviews%ROWTYPE;
  v_user_id        uuid;
  v_refund_amount  integer;
  v_refund_text    text;
  v_already_refunded boolean := false;
  v_balance_before integer;
  v_balance_after  integer;
BEGIN
  -- 参数校验
  IF p_agent NOT IN ('format', 'logic', 'aitrace', 'reference') THEN
    RAISE EXCEPTION 'INVALID_AGENT';
  END IF;

  -- 锁定 reviews 行
  SELECT * INTO v_review
  FROM public.reviews
  WHERE id = p_review_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;

  -- 状态校验（允许 processing / completed / failed，与 Spec 一致）
  IF v_review.status NOT IN (
    'processing'::review_status,
    'completed'::review_status,
    'failed'::review_status
  ) THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  v_user_id := v_review.user_id;

  -- 幂等检查：stages 中该 agent 是否已有 refunded_at
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_review.stages, '[]'::jsonb)) AS elem
    WHERE elem->>'agent' = p_agent
      AND (elem->>'refunded_at') IS NOT NULL
  ) INTO v_already_refunded;

  IF v_already_refunded THEN
    RETURN; -- 幂等：已退过，直接跳过
  END IF;

  -- 从 cost_breakdown 快照读取退款额（禁止调用方传入金额）
  v_refund_text := jsonb_extract_path_text(v_review.cost_breakdown, p_agent);
  IF v_refund_text IS NULL THEN
    RETURN; -- 该模块未在快照中（未扣费），无需退款
  END IF;

  v_refund_amount := v_refund_text::integer;
  IF v_refund_amount <= 0 THEN
    RETURN; -- 单价为 0，无需退款
  END IF;

  -- 防超额退款：已退总额 + 本次 <= 原始扣费
  IF v_refund_amount + COALESCE(v_review.refunded_amount, 0) > v_review.cost THEN
    RAISE EXCEPTION 'REFUND_EXCEEDS_COST';
  END IF;

  -- 锁定钱包并退款
  SELECT credits_balance INTO v_balance_before
  FROM public.user_wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  v_balance_after := v_balance_before + v_refund_amount;

  UPDATE public.user_wallets
  SET
    credits_balance = v_balance_after,
    version         = version + 1,
    updated_at      = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.credit_transactions (
    user_id, amount, type, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    v_user_id,
    v_refund_amount,
    'partial_refund'::transaction_type,
    p_review_id::text,
    v_balance_before,
    v_balance_after,
    jsonb_build_object(
      'review_id', p_review_id,
      'agent',     p_agent,
      'reason',    COALESCE(p_reason, 'agent_failed')
    )
  );

  -- 原子更新 reviews：refunded_amount 累加 + stages 写入退款信息
  UPDATE public.reviews
  SET
    refunded_amount = COALESCE(refunded_amount, 0) + v_refund_amount,
    stages = (
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN elem->>'agent' = p_agent THEN
              elem
              || jsonb_build_object(
                   'refunded_amount', v_refund_amount,
                   'refunded_at',     to_jsonb(now()::text)
                 )
            ELSE elem
          END
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(COALESCE(stages, '[]'::jsonb)) AS elem
    ),
    updated_at = now()
  WHERE id = p_review_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.admin_partial_refund_review_stage(bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_partial_refund_review_stage(bigint, text, text) TO service_role;

-- ─────────────────────────────────────────
-- 3. admin_full_refund_processing_review
--    所有已启用 agent 全部失败时，全额退款并将任务回退至 pending 供用户重试。
--    仅在 status = 'processing' 时可用（trigger_run_id 已写入，
--    不能走 rollback_review_after_dispatch_failure）。
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_full_refund_processing_review(
  p_review_id bigint,
  p_reason    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_review         public.reviews%ROWTYPE;
  v_user_id        uuid;
  v_cost           integer;
  v_balance_before integer;
  v_balance_after  integer;
BEGIN
  -- 锁定 reviews 行
  SELECT * INTO v_review
  FROM public.reviews
  WHERE id = p_review_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;

  -- 仅允许 processing 状态（编排中途所有 agent 全失败时调用）
  IF v_review.status <> 'processing'::review_status THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  v_user_id := v_review.user_id;
  v_cost    := COALESCE(v_review.cost, 0) - COALESCE(v_review.refunded_amount, 0);

  IF v_cost < 1 THEN
    RETURN; -- 无扣费记录或已全部退完，直接跳过
  END IF;

  -- 锁定钱包并全额退款
  SELECT credits_balance INTO v_balance_before
  FROM public.user_wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  v_balance_after := v_balance_before + v_cost;

  UPDATE public.user_wallets
  SET
    credits_balance = v_balance_after,
    version         = version + 1,
    updated_at      = now()
  WHERE user_id = v_user_id;

  -- 使用现有 refund 类型（与 rollback_review_after_dispatch_failure 一致）
  INSERT INTO public.credit_transactions (
    user_id, amount, type, reference_id, balance_before, balance_after, metadata
  ) VALUES (
    v_user_id,
    v_cost,
    'refund'::transaction_type,
    p_review_id::text,
    v_balance_before,
    v_balance_after,
    jsonb_build_object(
      'review_id', p_review_id,
      'reason',    COALESCE(p_reason, 'all_agents_failed')
    )
  );

  -- 重置任务状态到 pending 供用户重试，与 rollback 对称
  UPDATE public.reviews
  SET
    status          = 'pending'::review_status,
    cost            = 0,
    cost_breakdown  = NULL,
    refunded_amount = 0,
    stages          = '[]'::jsonb,
    trigger_run_id  = NULL,
    error_message   = COALESCE(p_reason, 'all_agents_failed'),
    updated_at      = now()
  WHERE id = p_review_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.admin_full_refund_processing_review(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_full_refund_processing_review(bigint, text) TO service_role;
