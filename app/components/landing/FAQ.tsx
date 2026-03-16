"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { C } from "./constants";


export function FAQ() {
  const t = useTranslations("landing.faq");
  const [open, setOpen] = useState<number | null>(null);
  const faqs = t.raw("items") as Array<{ q: string; a: string }>;

  return (
    <section id="faq" style={{ padding: "96px 32px", background: C.bgSubtle }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div className="badge badge-teal" style={{ marginBottom: 18 }}>
            {t("badge")}
          </div>
          <h2
            style={{
              fontSize: "clamp(24px, 3.5vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-0.8px",
              color: C.textPrimary,
              marginBottom: 10,
            }}
          >
            {t("title")}
          </h2>
          <p style={{ fontSize: 15, color: C.textMuted }}>{t("subtitle")}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {faqs.map((faq, i) => (
            <div
              key={i}
              style={{
                background: C.surface,
                border: `1.5px solid ${open === i ? "rgba(0,87,255,0.3)" : C.border}`,
                borderRadius: 12,
                overflow: "hidden",
                transition: "all 0.25s ease",
                boxShadow: open === i ? "var(--shadow-sm)" : "none",
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%",
                  padding: "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: 16,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: C.textPrimary }}>{faq.q}</span>
                <span
                  style={{
                    color: open === i ? C.brand : C.textMuted,
                    fontSize: 20,
                    flexShrink: 0,
                    transition: "all 0.25s ease",
                    transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                    fontWeight: 300,
                  }}
                >
                  +
                </span>
              </button>
              {open === i && (
                <div
                  style={{
                    padding: "0 22px 18px",
                    fontSize: 14,
                    color: C.textSecondary,
                    lineHeight: 1.75,
                    animation: "fade-up 0.2s ease-out",
                  }}
                >
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
