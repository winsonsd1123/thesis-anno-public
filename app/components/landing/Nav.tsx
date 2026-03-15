"use client";

import { useState, useEffect } from "react";
import { C } from "./constants";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "0 32px",
        transition: "all 0.3s ease",
        background: scrolled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0)",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: `linear-gradient(135deg, ${C.brand}, ${C.teal})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            ✦
          </div>
          <span
            style={{
              fontFamily: "Sora, sans-serif",
              fontWeight: 800,
              fontSize: 17,
              color: C.textPrimary,
              letterSpacing: "-0.4px",
            }}
          >
            ThesisAI
          </span>
        </div>

        <div className="nav-links" style={{ alignItems: "center" }}>
          {[
            { label: "功能", href: "#features" },
            { label: "流程", href: "#workflow" },
            { label: "价格", href: "#pricing" },
            { label: "FAQ", href: "#faq" },
          ].map((item) => (
            <a key={item.label} href={item.href} className="nav-link">
              {item.label}
            </a>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn-ghost" style={{ padding: "8px 18px", fontSize: 14 }}>
            登录
          </button>
          <button className="btn-primary" style={{ padding: "9px 20px", fontSize: 14 }}>
            免费开始
          </button>
        </div>
      </div>
    </nav>
  );
}
