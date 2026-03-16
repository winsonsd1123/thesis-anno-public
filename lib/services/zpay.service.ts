import { createHash } from "crypto";

const PID = process.env.ZPAY_PID;
const KEY = process.env.ZPAY_KEY;
const MAPI_URL = process.env.ZPAY_MAPI_URL ?? "https://zpayz.cn/mapi.php";

function buildSign(params: Record<string, string>, key: string): string {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] != null && k !== "sign" && k !== "sign_type")
    .sort();
  const str = sorted.map((k) => `${k}=${params[k]}`).join("&") + key;
  return createHash("md5").update(str).digest("hex").toLowerCase();
}

export type CreatePaymentParams = {
  orderId: string;
  name: string;
  moneyYuan: string;
  notifyUrl: string;
  returnUrl: string;
  clientip: string;
  type?: "alipay" | "wxpay";
};

export type CreatePaymentResult = {
  payurl?: string;
  payurl2?: string;
  qrcode?: string;
  img?: string;
  code?: number;
  msg?: string;
};

export const zpayService = {
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!PID || !KEY) {
      throw new Error("ZPAY_PID or ZPAY_KEY not configured");
    }

    const { orderId, name, moneyYuan, notifyUrl, returnUrl, clientip, type = "alipay" } = params;

    const reqParams: Record<string, string> = {
      pid: PID,
      type,
      out_trade_no: orderId,
      notify_url: notifyUrl,
      name,
      money: moneyYuan,
      clientip,
      sign_type: "MD5",
    };

    reqParams.sign = buildSign(reqParams, KEY);

    const formBody = new URLSearchParams(reqParams).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    return fetch(MAPI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
      signal: controller.signal,
    })
      .finally(() => clearTimeout(timeout))
      .then((res) => res.json())
      .then((data) => {
        if (data.code === 1) {
          return {
            payurl: data.payurl ?? data.payurl2 ?? data.qrcode,
            payurl2: data.payurl2,
            qrcode: data.qrcode,
            img: data.img,
          };
        }
        throw new Error(data.msg ?? "Zpay create payment failed");
      });
  },

  verifyNotifySign(params: Record<string, string | undefined>): boolean {
    if (!KEY) return false;

    const sign = params.sign;
    const signType = params.sign_type;

    if (!sign) return false;

    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (k !== "sign" && k !== "sign_type" && v !== "" && v != null) {
        filtered[k] = String(v);
      }
    }

    const expected = buildSign(filtered, KEY);
    return sign.toLowerCase() === expected.toLowerCase();
  },
};
