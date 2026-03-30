import type {
  SupportTicketListFilters,
  SupportTicketRow,
} from "@/lib/dal/support-ticket.admin.dal";
import { supportTicketAdminDAL } from "@/lib/dal/support-ticket.admin.dal";
import { parseHistoryOpenedRangeIso } from "@/lib/services/edu-credit-grant.service";

export const SUPPORT_TICKET_LIST_LIMIT = 500;

const STATUS_MODES: SupportTicketListFilters["statusMode"][] = [
  "open",
  "pending",
  "all",
  "in_progress",
  "resolved",
  "closed",
];

function parseStatusMode(raw: string | undefined): SupportTicketListFilters["statusMode"] {
  const v = (raw ?? "").trim() as SupportTicketListFilters["statusMode"];
  if (STATUS_MODES.includes(v)) return v;
  return "open";
}

export type TicketListQueryUi = {
  from: string;
  to: string;
  email: string;
  status: SupportTicketListFilters["statusMode"];
};

/**
 * 解析管理端工单列表 URL 查询参数；无 `status` 时默认为 open（未处理）。
 */
export function parseTicketListQuery(sp: {
  from?: string;
  to?: string;
  email?: string;
  status?: string;
}): { filters: SupportTicketListFilters; ui: TicketListQueryUi } {
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();
  const email = (sp.email ?? "").trim();
  const statusMode = parseStatusMode(sp.status);

  const range = parseHistoryOpenedRangeIso(
    from.length > 0 ? from : null,
    to.length > 0 ? to : null
  );

  return {
    filters: {
      statusMode,
      createdAfter: range.openedAfter,
      createdBefore: range.openedBefore,
      emailSubstr: email.length > 0 ? email : undefined,
    },
    ui: { from, to, email, status: statusMode },
  };
}

export const supportTicketAdminService = {
  parseTicketListQuery,

  async listTicketsForAdmin(sp: {
    from?: string;
    to?: string;
    email?: string;
    status?: string;
  }): Promise<{ tickets: SupportTicketRow[]; ui: TicketListQueryUi; truncated: boolean }> {
    const { filters, ui } = parseTicketListQuery(sp);
    const tickets = await supportTicketAdminDAL.listTicketsFiltered(filters);
    const truncated = tickets.length >= SUPPORT_TICKET_LIST_LIMIT;
    return { tickets, ui, truncated };
  },
};
