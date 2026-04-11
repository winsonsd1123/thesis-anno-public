import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/utils/admin";
import { userAdminService } from "@/lib/services/user.admin.service";
import UserDetailClient from "./UserDetailClient";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const user = await userAdminService.getUserForAdmin(id);
  if (!user) notFound();

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <UserDetailClient user={user} />
    </div>
  );
}
