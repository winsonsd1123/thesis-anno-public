-- 管理端历史：申领记录联 auth.users 邮箱（仅 service_role 可读）
CREATE OR REPLACE VIEW public.edu_credit_grant_claims_with_email AS
SELECT
  c.id          AS claim_id,
  c.window_id,
  c.user_id,
  c.credits,
  c.created_at,
  COALESCE(u.email, '')::text AS user_email
FROM public.edu_credit_grant_claims c
LEFT JOIN auth.users u ON u.id = c.user_id;

REVOKE ALL ON public.edu_credit_grant_claims_with_email FROM PUBLIC;
GRANT SELECT ON public.edu_credit_grant_claims_with_email TO service_role;
