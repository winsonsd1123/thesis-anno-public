import { NextResponse } from "next/server";
import { getAdminUserOrNull } from "@/lib/utils/admin";
import { ConfigService } from "@/lib/services/config.service";
import { promptsSchema } from "@/lib/schemas/config.schemas";

export async function POST(request: Request) {
  const admin = await getAdminUserOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = promptsSchema.parse(body);
    await ConfigService.update("prompts", parsed);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin/config/prompts]", e);
    const msg = e instanceof Error ? e.message : "Invalid payload";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
