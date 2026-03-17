"use client";

import { useState } from "react";
import { PricingCard } from "@/app/components/billing/PricingCard";
import type { BillingPackage } from "@/lib/config/billing";

type Props = {
  packages: BillingPackage[];
};

export function BillingPlanSelector({ packages }: Props) {
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 24,
        marginBottom: 32,
      }}
    >
      {packages.map((pkg) => (
        <PricingCard
          key={pkg.id}
          pkg={pkg}
          popular={pkg.id === "pkg_standard"}
          selected={selectedPkgId === pkg.id}
          hasAnySelection={selectedPkgId !== null}
          onSelect={() => setSelectedPkgId(pkg.id)}
        />
      ))}
    </div>
  );
}
