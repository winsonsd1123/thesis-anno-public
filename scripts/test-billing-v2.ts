import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials in .env.local");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("🚀 Starting Billing v2.0 RPC Tests...");

  // 1. Create a test user with password, or sign in if exists
  const testEmail = "test_billing_v3@example.com";
  const testPassword = "TestPassword123!";
  let testUserId = "";
  let userToken = "";

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseKey;
  const authClient = createClient(supabaseUrl as string, anonKey as string);

  const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInData.user) {
    testUserId = signInData.user.id;
    userToken = signInData.session?.access_token || "";
  } else {
    // Try to create
    const { data: signUpData, error: signUpErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (signUpData.user) {
      testUserId = signUpData.user.id;
      // Now sign in with authClient to get token
      const { data: signData } = await authClient.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      userToken = signData.session?.access_token || "";
    } else {
      console.log("❌ Failed to create or sign in user", signUpErr || signInErr);
      return;
    }
  }

  console.log("👤 Using test user:", testUserId);

  // We need a client authenticated as this user to call start_review_and_deduct
  const { data: sessionData } = await authClient.auth.getSession();
  const token = userToken || sessionData.session?.access_token;
  if (!token) {
    console.log("❌ Failed to get access token.");
    return;
  }
  
  const userClient = createClient(supabaseUrl as string, anonKey as string, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Since we created a new user, we might need to ensure they have a wallet row (if not auto-created by trigger)
  // Let's check if wallet exists, if not create it
  const { data: walletCheck } = await supabase.from("user_wallets").select("*").eq("user_id", testUserId).single();
  if (!walletCheck) {
    await supabase.from("user_wallets").insert({ user_id: testUserId, credits_balance: 0 });
  }

  // 2. Ensure wallet has enough balance
  const { error: updateWalletErr } = await supabase
    .from("user_wallets")
    .update({ credits_balance: 1000 })
    .eq("user_id", testUserId);
  if (updateWalletErr) {
    console.log("❌ Failed to update wallet balance", updateWalletErr);
    return;
  }
  console.log("💰 Wallet reset to 1000 credits");

  // 3. Create a mock review
  const { data: review, error: insertErr } = await supabase
    .from("reviews")
    .insert({
      user_id: testUserId,
      file_url: "test.docx",
      status: "pending",
      cost: 0,
    })
    .select()
    .single();

  if (insertErr || !review) {
    console.log("❌ Failed to create mock review", insertErr);
    return;
  }
  console.log("📄 Created mock review:", review.id);

  // 4. Test start_review_and_deduct
  const totalCost = 150;
  const costBreakdown = { total: 150, format: 120, aitrace: 30 };
  const planOptions = { format: true, logic: false, aitrace: true, reference: false };

  console.log("💳 Calling start_review_and_deduct...");
  const { error: deductErr } = await userClient.rpc("start_review_and_deduct", {
    p_review_id: review.id,
    p_total_cost: totalCost,
    p_cost_breakdown: costBreakdown,
    p_plan_options: planOptions,
  });

  if (deductErr) {
    console.log("❌ start_review_and_deduct failed:", deductErr);
    return;
  }

  // Verify wallet
  const { data: wallet } = await supabase.from("user_wallets").select("credits_balance").eq("user_id", testUserId).single();
  console.log(`✅ Deduction success. New balance: ${wallet?.credits_balance} (Expected 850)`);

  // Verify review state
  const { data: reviewAfterDeduct } = await supabase.from("reviews").select("*").eq("id", review.id).single();
  console.log("✅ Review state after deduction:");
  console.log(`   Cost: ${reviewAfterDeduct?.cost}`);
  console.log(`   Status: ${reviewAfterDeduct?.status}`);
  console.log(`   Stages:`, JSON.stringify(reviewAfterDeduct?.stages));

  // 5. Test partial_refund_review_stage
  console.log("💸 Calling admin_partial_refund_review_stage for 'format'...");
  const { error: refundErr } = await supabase.rpc("admin_partial_refund_review_stage", {
    p_review_id: review.id,
    p_agent: "format",
    p_reason: "test_format_failed",
  });

  if (refundErr) {
    console.log("❌ admin_partial_refund_review_stage failed:", refundErr);
    return;
  }

  // Verify wallet
  const { data: walletAfterRefund } = await supabase.from("user_wallets").select("credits_balance").eq("user_id", testUserId).single();
  console.log(`✅ Partial refund success. New balance: ${walletAfterRefund?.credits_balance} (Expected 970)`);

  // Verify review state
  const { data: reviewAfterRefund } = await supabase.from("reviews").select("refunded_amount, stages").eq("id", review.id).single();
  console.log("✅ Review state after partial refund:");
  console.log(`   Refunded Amount: ${reviewAfterRefund?.refunded_amount} (Expected 120)`);
  console.log(`   Stages:`, JSON.stringify(reviewAfterRefund?.stages));

  // 6. Test Idempotency
  console.log("♻️ Calling admin_partial_refund_review_stage again (idempotency test)...");
  const { error: refundErr2 } = await supabase.rpc("admin_partial_refund_review_stage", {
    p_review_id: review.id,
    p_agent: "format",
    p_reason: "test_format_failed_again",
  });
  
  if (refundErr2) {
    console.log("❌ Idempotency test failed with error:", refundErr2);
  } else {
    const { data: walletIdempotent } = await supabase.from("user_wallets").select("credits_balance").eq("user_id", testUserId).single();
    console.log(`✅ Idempotency success. Balance unchanged: ${walletIdempotent?.credits_balance} (Expected 970)`);
  }

  // 7. Test admin_full_refund_processing_review
  console.log("🚨 Calling admin_full_refund_processing_review...");
  const { error: fullRefundErr } = await supabase.rpc("admin_full_refund_processing_review", {
    p_review_id: review.id,
    p_reason: "all_agents_failed",
  });

  if (fullRefundErr) {
    console.log("❌ admin_full_refund_processing_review failed:", fullRefundErr);
  } else {
    const { data: walletFullRefund } = await supabase.from("user_wallets").select("credits_balance").eq("user_id", testUserId).single();
    const expectedBalance = 1000; // 850 + 120(partial) + 30(remaining full) = 1000
    const actualBalance = walletFullRefund?.credits_balance ?? -1;
    const pass = actualBalance === expectedBalance;
    console.log(`${pass ? "✅" : "❌"} Full refund (after partial). Balance: ${actualBalance} (Expected ${expectedBalance})`);

    const { data: reviewAfterFullRefund } = await supabase.from("reviews").select("status, cost").eq("id", review.id).single();
    console.log(`   Status: ${reviewAfterFullRefund?.status} (Expected pending)`);
    console.log(`   Cost: ${reviewAfterFullRefund?.cost} (Expected 0)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Test admin_refund_needs_manual_review_and_resolve_ticket
  //    场景：先局部退款，再触发工单手动退款，确保不超额
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n🎫 === Test: admin_refund_needs_manual_review_and_resolve_ticket ===");

  // 8.1 重置钱包到 1000
  await supabase.from("user_wallets").update({ credits_balance: 1000 }).eq("user_id", testUserId);
  console.log("💰 Wallet reset to 1000 credits");

  // 8.2 创建新审阅
  const { data: review2 } = await supabase
    .from("reviews")
    .insert({ user_id: testUserId, file_url: "test_ticket.docx", status: "pending", cost: 0 })
    .select()
    .single();
  if (!review2) { console.log("❌ Failed to create review2"); return; }
  console.log("📄 Created mock review2:", review2.id);

  // 8.3 扣费 150（format:120 + aitrace:30）
  const { error: deductErr2 } = await userClient.rpc("start_review_and_deduct", {
    p_review_id: review2.id,
    p_total_cost: 150,
    p_cost_breakdown: { total: 150, format: 120, aitrace: 30 },
    p_plan_options: { format: true, logic: false, aitrace: true, reference: false },
  });
  if (deductErr2) { console.log("❌ Deduct failed:", deductErr2); return; }
  console.log("💳 Deducted 150. Balance should be 850.");

  // 8.4 局部退款 format:120
  const { error: partialErr2 } = await supabase.rpc("admin_partial_refund_review_stage", {
    p_review_id: review2.id,
    p_agent: "format",
    p_reason: "format_failed",
  });
  if (partialErr2) { console.log("❌ Partial refund failed:", partialErr2); return; }
  const { data: w2AfterPartial } = await supabase.from("user_wallets").select("credits_balance").eq("user_id", testUserId).single();
  console.log(`💸 After partial refund(120). Balance: ${w2AfterPartial?.credits_balance} (Expected 970)`);

  // 8.5 将审阅状态改为 needs_manual_review（模拟 Trigger 挂起）
  await supabase.from("reviews").update({ status: "needs_manual_review" }).eq("id", review2.id);
  console.log("⚠️  Review2 set to needs_manual_review");

  // 8.6 创建工单（admin_id 用管理员 UUID，测试环境随意）
  const adminId = "636f44b5-fd71-44e2-9c6e-1b320a6fc323"; // 17403933@qq.com
  const { data: ticket, error: ticketErr } = await supabase
    .from("support_tickets")
    .insert({
      user_id: testUserId,
      review_id: review2.id,
      subject: "Test ticket for billing refund",
      category: "refund_request",
      status: "open",
    })
    .select()
    .single();
  if (ticketErr || !ticket) { console.log("❌ Failed to create ticket", ticketErr); return; }
  console.log("🎫 Created ticket:", ticket.id);

  // 8.7 调用 admin_refund_needs_manual_review_and_resolve_ticket
  const { error: ticketRefundErr } = await supabase.rpc("admin_refund_needs_manual_review_and_resolve_ticket", {
    p_ticket_id: ticket.id,
    p_admin_id: adminId,
    p_reason: "manual_refund_test",
  });
  if (ticketRefundErr) {
    console.log("❌ admin_refund_needs_manual_review_and_resolve_ticket failed:", ticketRefundErr);
  } else {
    const { data: w2Final } = await supabase.from("user_wallets").select("credits_balance").eq("user_id", testUserId).single();
    const expectedFinal = 1000; // 970 + 30(remaining) = 1000，不是 1120
    const actualFinal = w2Final?.credits_balance ?? -1;
    const pass2 = actualFinal === expectedFinal;
    console.log(`${pass2 ? "✅" : "❌"} Ticket refund (after partial). Balance: ${actualFinal} (Expected ${expectedFinal})`);

    const { data: ticketFinal } = await supabase.from("support_tickets").select("status").eq("id", ticket.id).single();
    const { data: review2Final } = await supabase.from("reviews").select("status, cost, refunded_amount").eq("id", review2.id).single();
    console.log(`   Ticket status: ${ticketFinal?.status} (Expected resolved)`);
    console.log(`   Review2 status: ${review2Final?.status} (Expected pending)`);
    console.log(`   Review2 cost: ${review2Final?.cost} (Expected 0)`);
    console.log(`   Review2 refunded_amount: ${review2Final?.refunded_amount} (Expected 0)`);
  }

  console.log("\n🎉 All tests finished.");
}

runTest().catch(console.error);
