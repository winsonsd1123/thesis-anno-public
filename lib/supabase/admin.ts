import { createClient } from "@supabase/supabase-js";

/**
 * Service Role 客户端，绕过 RLS。
 * 仅用于服务端：钱包更新、订单创建、流水插入、工单创建。
 * 切勿暴露到前端。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local for billing operations."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
