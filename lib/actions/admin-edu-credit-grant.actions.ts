"use server";

import { getAdminUserOrNull } from "@/lib/utils/admin";
import { eduCreditGrantService } from "@/lib/services/edu-credit-grant.service";

type ActionResult = { success: true } | { success: false; error: string };

const EDU_GRANT_MAX_CLAIMS_DEFAULT = 10;
const EDU_GRANT_MAX_CLAIMS_CAP = 10_000;

function clampMaxClaims(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return EDU_GRANT_MAX_CLAIMS_DEFAULT;
  return Math.min(EDU_GRANT_MAX_CLAIMS_CAP, Math.max(1, Math.floor(n)));
}

export async function openEduCreditGrantWindowAdmin(
  maxClaims?: number
): Promise<{ success: true; windowId: string } | ActionResult> {
  const admin = await getAdminUserOrNull();
  if (!admin) return { success: false, error: "UNAUTHORIZED" };

  try {
    const windowId = await eduCreditGrantService.openCurrentWindow(
      admin.userId,
      clampMaxClaims(maxClaims ?? EDU_GRANT_MAX_CLAIMS_DEFAULT)
    );
    return { success: true, windowId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[openEduCreditGrantWindowAdmin]", msg);
    return { success: false, error: msg };
  }
}

export async function closeEduCreditGrantWindowAdmin(): Promise<ActionResult> {
  const admin = await getAdminUserOrNull();
  if (!admin) return { success: false, error: "UNAUTHORIZED" };

  try {
    await eduCreditGrantService.closeCurrentWindow();
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[closeEduCreditGrantWindowAdmin]", msg);
    return { success: false, error: msg };
  }
}
