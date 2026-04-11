import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/utils/admin";
import { userAdminService } from "@/lib/services/user.admin.service";
import UsersTableClient from "./UsersTableClient";
import { UsersFilterSection } from "./UsersFilterSection";
import { AdminUserCreateForm } from "./AdminUserCreateForm";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; email?: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations("admin.users");
  const sp = await searchParams;
  const { items, page, total, totalPages, ui, emailFilterNote, usedFallbackListing } =
    await userAdminService.listUsersForAdmin(sp);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}
        >
          {t("title")}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>{t("subtitle")}</p>
      </div>

      <AdminUserCreateForm />

      <UsersFilterSection ui={ui} />

      <UsersTableClient
        items={items}
        page={page}
        total={total}
        totalPages={totalPages}
        ui={ui}
        emailFilterNote={emailFilterNote}
        usedFallbackListing={usedFallbackListing}
      />
    </div>
  );
}
