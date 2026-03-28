-- Billing v2.0 Phase 5: Support Tickets MVP
-- Admin 退款并结案 RPC（挂起审阅专用）
--
-- 安全设计：SECURITY DEFINER + 仅 GRANT service_role，与阶段三 RPC 同模式。
-- 调用方：Admin Server Action（使用 createAdminClient()，无用户 JWT）。
--
-- 与 admin_full_refund_processing_review 的区别：
--   - 本 RPC 处理 status = 'needs_manual_review' 的审阅（已挂起，trigger_run_id 已写）
--   - 同时原子更新 support_tickets.status = 'resolved'

CREATE OR REPLACE FUNCTION public.admin_refund_needs_manual_review_and_resolve_ticket(
  p_ticket_id uuid,
  p_admin_id  uuid,
  p_reason    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_ticket         public.support_tickets%ROWTYPE;
  v_review         public.reviews%ROWTYPE;
  v_user_id        uuid;
  v_cost           integer;
  v_balance_before integer;
  v_balance_after  integer;
  v_resolution     text;
BEGIN
  -- 锁定工单行
  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;

  -- 仅允许 open 状态的工单（防止重复结案）
  IF v_ticket.status <> 'open'::ticket_status THEN
    RAISE EXCEPTION 'TICKET_NOT_OPEN';
  END IF;

  -- 工单必须关联审阅
  IF v_ticket.review_id IS NULL THEN
    RAISE EXCEPTION 'TICKET_NO_REVIEW';
  END IF;

  -- 锁定审阅行
  SELECT * INTO v_review
  FROM public.reviews
  WHERE id = v_ticket.review_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;

  -- 仅允许 needs_manual_review 状态
  IF v_review.status <> 'needs_manual_review'::review_status THEN
    RAISE EXCEPTION 'INVALID_REVIEW_STATUS';
  END IF;

  v_user_id := v_review.user_id;
  -- 减去已局部退款的金额，防止超额退款
  v_cost    := COALESCE(v_review.cost, 0) - COALESCE(v_review.refunded_amount, 0);

  -- 有扣费时执行退款
  IF v_cost >= 1 THEN
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

    INSERT INTO public.credit_transactions (
      user_id, amount, type, reference_id, balance_before, balance_after, metadata
    ) VALUES (
      v_user_id,
      v_cost,
      'refund'::transaction_type,
      v_review.id::text,
      v_balance_before,
      v_balance_after,
      jsonb_build_object(
        'review_id',  v_review.id,
        'ticket_id',  p_ticket_id,
        'admin_id',   p_admin_id,
        'reason',     COALESCE(p_reason, 'manual_suspend_refund')
      )
    );

    v_resolution := format('已退还 %s 积分（工单手动处理）', v_cost);
  ELSE
    v_resolution := '审阅无扣费记录，直接结案';
  END IF;

  -- 重置审阅到 pending 供用户重试（与 admin_full_refund_processing_review 对称）
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
  WHERE id = v_review.id;

  -- 原子结案工单
  UPDATE public.support_tickets
  SET
    status     = 'resolved'::ticket_status,
    resolution = COALESCE(p_reason, v_resolution),
    admin_id   = p_admin_id,
    updated_at = now()
  WHERE id = p_ticket_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.admin_refund_needs_manual_review_and_resolve_ticket(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_refund_needs_manual_review_and_resolve_ticket(uuid, uuid, text) TO service_role;
