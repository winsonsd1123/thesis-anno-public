import { createHash } from "crypto";

const PID = process.env.ZPAY_PID;
const KEY = process.env.ZPAY_KEY;
const SUBMIT_URL = process.env.ZPAY_SUBMIT_URL ?? "https://zpayz.cn/submit.php";

/**
 * 参数排序拼接（与官方 demo 一致）
 * 排除 sign、sign_type 及空值
 */
function getVerifyParams(params: Record<string, string>): string {
  const entries = Object.entries(params)
    .filter(([k, v]) => v !== "" && v != null && k !== "sign" && k !== "sign_type")
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

function buildSign(params: Record<string, string>, key: string): string {
  const str = getVerifyParams(params);
  return createHash("md5").update(str + key).digest("hex").toLowerCase();
}

export type CreatePaymentParams = {
  orderId: string;
  name: string;
  moneyYuan: string;
  notifyUrl: string;
  returnUrl: string;
  sitename?: string;
  type?: "alipay" | "wxpay";
};

export type CreatePaymentResult = {
  payurl: string;
};

/**
 * 页面跳转支付（官方 demo 方式）
 * 直接构建 submit.php URL，无需调用 API，避免网络超时
 */
export const zpayService = {
  createPayment(params: CreatePaymentParams): CreatePaymentResult {
    if (!PID || !KEY) {
      throw new Error("ZPAY_PID or ZPAY_KEY not configured");
    }

    const { orderId, name, moneyYuan, notifyUrl, returnUrl, sitename = "ThesisAI", type = "alipay" } = params;

    const data: Record<string, string> = {
      pid: PID,
      money: moneyYuan,
      name,
      notify_url: notifyUrl,
      out_trade_no: orderId,
      return_url: returnUrl,
      sitename,
      type,
    };

    const prestr = getVerifyParams(data);
    const sign = buildSign(data, KEY);

    const paymentUrl = `${SUBMIT_URL}?${prestr}&sign=${sign}&sign_type=MD5`;

    return { payurl: paymentUrl };
  },

  /**
   * 验签：与官方 demo 一致，排除 sign/sign_type/空值，按 key 排序后 md5(str+key)
   */
  verifyNotifySign(params: Record<string, string | undefined>): boolean {
    if (!KEY) return false;

    const sign = params.sign;
    if (!sign) return false;

    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (k !== "sign" && k !== "sign_type" && v !== "" && v != null) {
        filtered[k] = String(v);
      }
    }

    const expected = buildSign(filtered, KEY);
    const ok = sign.toLowerCase() === expected.toLowerCase();
    if (!ok && process.env.NODE_ENV !== "production") {
      console.warn("[zpay verify] Sign mismatch", {
        received: sign,
        expected,
        prestr: getVerifyParams(filtered),
      });
    }
    return ok;
  },
};
