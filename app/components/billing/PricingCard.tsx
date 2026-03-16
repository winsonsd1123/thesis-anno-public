"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createOrder } from "@/lib/actions/billing.actions";
import type { BillingPackage } from "@/lib/config/billing";

type Props = {
  pkg: BillingPackage;
  popular?: boolean;
};

export function PricingCard({ pkg, popular }: Props) {
  const t = useTranslations("billing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const priceYuan = (pkg.price / 100).toFixed(1);
  const originalYuan = (pkg.original_price / 100).toFixed(1);

  const handleBuy = async () => {
    setLoading(true);
    setError(null);
    setPaymentUrl(null);
    const result = await createOrder(pkg.id);
    setLoading(false);

    if (result.success && result.paymentUrl) {
      setPaymentUrl(result.paymentUrl);
      window.location.href = result.paymentUrl;
      return;
    }
    setError(result.error ?? t("error"));
  };

  return (
    <div
      style={{
        padding: 24,
        borderRadius: 16,
        border: popular ? "2px solid var(--brand)" : "1px solid var(--border)",
        background: popular ? "var(--bg-subtle)" : "var(--surface)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {popular && (
        <div
          style={{
            position: "absolute",
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--brand)",
            color: "white",
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 12px",
            borderRadius: 100,
          }}
        >
          {pkg.tag}
        </div>
      )}
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          {pkg.nameZh ?? pkg.name}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {pkg.credits} {t("credits")}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)" }}>
          ¥{priceYuan}
        </span>
        {pkg.original_price > pkg.price && (
          <span style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "line-through" }}>
            ¥{originalYuan}
          </span>
        )}
      </div>
      <button
        onClick={handleBuy}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          background: popular ? "var(--brand)" : "var(--bg-subtle)",
          border: popular ? "none" : "1px solid var(--border)",
          color: popular ? "white" : "var(--text-primary)",
        }}
      >
        {loading ? t("purchasing") : popular ? t("buyNow") : t("selectPlan")}
      </button>
      {error && (
        <div style={{ fontSize: 13, color: "var(--danger)" }}>{error}</div>
      )}
      {paymentUrl && (
        <a
          href={paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13,
            color: "var(--brand)",
            textDecoration: "underline",
          }}
        >
          {t("openPayment")}
        </a>
      )}
    </div>
  );
}
