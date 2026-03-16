"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Nav, Hero } from "../components/landing";
import { C } from "../components/landing/constants";

const Features = dynamic(() => import("../components/landing/Features").then((m) => ({ default: m.Features })), {
  ssr: true,
});

const HowItWorks = dynamic(
  () => import("../components/landing/HowItWorks").then((m) => ({ default: m.HowItWorks })),
  { ssr: true }
);

const SocialProof = dynamic(
  () => import("../components/landing/SocialProof").then((m) => ({ default: m.SocialProof })),
  { ssr: true }
);

const Pricing = dynamic(() => import("../components/landing/Pricing").then((m) => ({ default: m.Pricing })), {
  ssr: true,
});

const FAQ = dynamic(() => import("../components/landing/FAQ").then((m) => ({ default: m.FAQ })), {
  ssr: true,
});

const CTABanner = dynamic(
  () => import("../components/landing/CTABanner").then((m) => ({ default: m.CTABanner })),
  { ssr: true }
);

const Footer = dynamic(() => import("../components/landing/Footer").then((m) => ({ default: m.Footer })), {
  ssr: true,
});

export default function Home() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        }),
      { threshold: 0.08 }
    );
    document.querySelectorAll(".section-fade").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.textPrimary }}>
      <Nav />
      <Hero />
      <div className="section-fade">
        <Features />
      </div>
      <div className="section-fade">
        <HowItWorks />
      </div>
      <div className="section-fade">
        <SocialProof />
      </div>
      <div className="section-fade">
        <Pricing />
      </div>
      <div className="section-fade">
        <FAQ />
      </div>
      <div className="section-fade">
        <CTABanner />
      </div>
      <Footer />
    </div>
  );
}
