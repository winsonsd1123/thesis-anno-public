-- Billing v2.0 Migration: Module Pricing & Partial Refund
-- 阶段一：reviews 表新增 cost_breakdown / refunded_amount 两列
--
-- ⚠️  数据重置部分（TRUNCATE / UPDATE）仅适用于尚未正式上线的开发/测试环境。
--     正式上线后如需升级，请移除该部分并单独评估历史数据处理策略。

-- ─────────────────────────────────────────
-- 1. reviews 表扩展
-- ─────────────────────────────────────────

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb;

COMMENT ON COLUMN public.reviews.cost_breakdown IS
  '开始审阅时的各模块积分单价快照，仅含已选中模块。
   格式示例: {"logic":120,"format":120,"aitrace":30,"reference":30,"total":300}
   用于局部退款时按快照原路退回，防止配置变更后金额不一致。';

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS refunded_amount integer NOT NULL DEFAULT 0
  CONSTRAINT reviews_refunded_amount_nonneg CHECK (refunded_amount >= 0);

COMMENT ON COLUMN public.reviews.refunded_amount IS
  '累计已退款积分（局部退款之和）。
   reviews.cost 列保持不可变（原始扣费），
   真实净耗 = cost - refunded_amount，在查询层计算。';

-- ─────────────────────────────────────────
-- 2. 测试数据重置（未上线环境专用）
-- ─────────────────────────────────────────

-- 清空流水（credit_transactions 无对其他表的外键依赖，可直接 TRUNCATE）
TRUNCATE public.credit_transactions;

-- 将所有用户钱包余额归零
UPDATE public.user_wallets
SET
  credits_balance = 0,
  version         = version + 1,
  updated_at      = now();
