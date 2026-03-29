"use server";

import { createClient } from "@/lib/supabase/server";
import {
  eduCreditGrantService,
  type EduGrantClaimErrorCode,
} from "@/lib/services/edu-credit-grant.service";

export type ClaimEduCreditGrantActionResult =
  | { success: true }
  | { success: false; code: EduGrantClaimErrorCode | "NOT_LOGGED_IN" };

export async function claimEduCreditGrant(): Promise<ClaimEduCreditGrantActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return { success: false, code: "NOT_LOGGED_IN" };
  }

  const result = await eduCreditGrantService.claimForAuthenticatedUser(data.user.id);
  if (result.ok) return { success: true };
  return { success: false, code: result.code };
}
