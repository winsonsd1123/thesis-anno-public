"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useTransition, type FormEvent } from "react";
import type { OrderQueryUi } from "@/lib/services/admin-transaction.service";
import styles from "./order-query-filter.module.css";

type Props = {
  ui: OrderQueryUi;
};

function buildQueryString(fd: FormData): string {
  const params = new URLSearchParams();
  for (const [key, value] of fd.entries()) {
    const s = typeof value === "string" ? value.trim() : "";
    if (s === "") continue;
    if (key === "type" && s === "all") continue;
    params.set(key, s);
  }
  if (!params.has("page")) params.set("page", "1");
  return params.toString();
}

export function OrderQueryFilterForm({ ui }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.orderQuery");
  const tb = useTranslations("billing.transactions");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const qs = buildQueryString(fd);
    const href = qs ? `/admin/order-query?${qs}` : "/admin/order-query";
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <form
      className={`${styles.form} ${isPending ? styles.formPending : ""}`}
      onSubmit={handleSubmit}
      aria-busy={isPending}
    >
      <input type="hidden" name="page" value="1" />
      <div style={{ flex: "1 1 160px", minWidth: 140 }}>
        <label htmlFor="orderQueryType" className={styles.label}>
          {t("filterType")}
        </label>
        <select
          id="orderQueryType"
          name="type"
          defaultValue={ui.type}
          className={styles.inputBase}
          disabled={isPending}
        >
          <option value="all">{t("filterTypeAll")}</option>
          <option value="refunds">{tb("filterRefunds")}</option>
          <option value="deposit">{tb("typeDeposit")}</option>
          <option value="consumption">{tb("typeConsumption")}</option>
          <option value="refund">{tb("typeRefund")}</option>
          <option value="partial_refund">{tb("typePartialRefund")}</option>
          <option value="admin_adjustment">{tb("typeAdminAdjustment")}</option>
          <option value="bonus">{tb("typeBonus")}</option>
        </select>
      </div>
      <div style={{ flex: "1 1 200px", minWidth: 180 }}>
        <label htmlFor="orderQueryEmail" className={styles.label}>
          {t("filterEmail")}
        </label>
        <input
          id="orderQueryEmail"
          name="email"
          type="search"
          placeholder={t("filterEmailPlaceholder")}
          defaultValue={ui.email}
          className={styles.inputBase}
          disabled={isPending}
          autoComplete="off"
        />
      </div>
      <div style={{ flex: "0 1 150px", minWidth: 130 }}>
        <label htmlFor="orderQueryFrom" className={styles.label}>
          {t("filterFrom")}
        </label>
        <input
          id="orderQueryFrom"
          name="from"
          type="date"
          defaultValue={ui.from}
          className={styles.inputBase}
          disabled={isPending}
        />
      </div>
      <div style={{ flex: "0 1 150px", minWidth: 130 }}>
        <label htmlFor="orderQueryTo" className={styles.label}>
          {t("filterTo")}
        </label>
        <input
          id="orderQueryTo"
          name="to"
          type="date"
          defaultValue={ui.to}
          className={styles.inputBase}
          disabled={isPending}
        />
      </div>
      <button type="submit" className={styles.submitBtn} disabled={isPending}>
        {isPending ? (
          <>
            <span className={styles.spinner} aria-hidden />
            <span>{t("filterSubmitLoading")}</span>
          </>
        ) : (
          t("filterSubmit")
        )}
      </button>
    </form>
  );
}
