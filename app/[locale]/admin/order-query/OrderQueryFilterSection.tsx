import type { OrderQueryUi } from "@/lib/services/admin-transaction.service";
import { OrderQueryFilterForm } from "./OrderQueryFilterForm";

type Props = {
  ui: OrderQueryUi;
};

/** 筛选表单（客户端）：提交时用 transition + 加载态，避免「点了没反应」 */
export function OrderQueryFilterSection({ ui }: Props) {
  return <OrderQueryFilterForm ui={ui} />;
}
