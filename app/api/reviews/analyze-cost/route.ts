import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeStagedDocxFromStorage } from "@/lib/services/staged-docx-cost.service";

/**
 * POST body: { stagingPath: string }
 * 与规范「analyze-cost」一致：服务端根据暂存对象重新统计字数与扣点（不信任客户端）。
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
    }

    const body = await request.json();
    const stagingPath = typeof body?.stagingPath === "string" ? body.stagingPath : "";
    if (!stagingPath) {
      return NextResponse.json({ error: "stagingPath required" }, { status: 400 });
    }

    const r = await analyzeStagedDocxFromStorage(stagingPath, auth.user.id);
    if (!r.ok) {
      const status = r.error === "STAGING_INVALID" ? 400 : 422;
      return NextResponse.json({ error: r.error }, { status });
    }

    return NextResponse.json({ wordCount: r.wordCount, cost: r.cost });
  } catch (e) {
    console.error("[analyze-cost]", e);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "production" ? "Server error" : String(e) },
      { status: 500 }
    );
  }
}
