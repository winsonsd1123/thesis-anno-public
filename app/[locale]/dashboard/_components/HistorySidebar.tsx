"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  MoreVertical,
  Pencil,
  Trash2,
  CircleDashed,
  Loader2,
  CheckCircle2,
  AlertCircle,
  LifeBuoy,
} from "lucide-react";
import { createUserSupportTicketForReview } from "@/lib/actions/support-ticket.actions";

export type SidebarReviewItem = {
  id: number;
  title: string;
  statusLabel: string;
  variant: "done" | "processing" | "pending" | "failed";
};

type HistorySidebarProps = {
  title: string;
  collapseLabel: string;
  expandLabel: string;
  emptyHint: string;
  newReviewLabel: string;
  items: SidebarReviewItem[];
  selectedId: number | null;
  /** 正在请求该条详情时显示行内加载指示（与 selectedId 可同时为同一条） */
  loadingItemId?: number | null;
  onSelect: (id: number) => void;
  onNewReview: () => void;
  renameLabel?: string;
  deleteLabel?: string;
  renamePlaceholder?: string;
  onRename?: (id: number, newTitle: string) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
};

type MenuState = { id: number; x: number; y: number } | null;

export function HistorySidebar({
  title,
  collapseLabel,
  expandLabel,
  emptyHint,
  newReviewLabel,
  items,
  selectedId,
  loadingItemId = null,
  onSelect,
  onNewReview,
  renameLabel = "Rename",
  deleteLabel = "Delete",
  renamePlaceholder = "New name…",
  onRename,
  onDelete,
}: HistorySidebarProps) {
  const tHelp = useTranslations("dashboard.review");
  const [isTicketPending, startTicketTransition] = useTransition();
  const [collapsed, setCollapsed] = useState(false);
  const [hoverItemId, setHoverItemId] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<MenuState>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [helpReviewId, setHelpReviewId] = useState<number | null>(null);
  const [helpSubject, setHelpSubject] = useState("");
  const [helpTicketError, setHelpTicketError] = useState<string | null>(null);
  const [helpTicketSuccess, setHelpTicketSuccess] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close menu on Escape (help modal takes precedence)
  useEffect(() => {
    if (helpReviewId !== null) return;
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMenu, helpReviewId]);

  useEffect(() => {
    if (helpReviewId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isTicketPending) {
        setHelpReviewId(null);
        setHelpSubject("");
        setHelpTicketError(null);
        setHelpTicketSuccess(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpReviewId, isTicketPending]);

  useEffect(() => {
    if (!helpTicketSuccess) return;
    const id = window.setTimeout(() => {
      setHelpReviewId(null);
      setHelpSubject("");
      setHelpTicketError(null);
      setHelpTicketSuccess(false);
    }, 1400);
    return () => window.clearTimeout(id);
  }, [helpTicketSuccess]);

  // Focus rename input when it mounts
  useEffect(() => {
    if (renamingId !== null) {
      setTimeout(() => renameInputRef.current?.select(), 30);
    }
  }, [renamingId]);

  function openMenuFor(e: React.MouseEvent<HTMLButtonElement>, id: number) {
    e.stopPropagation();
    if (openMenu?.id === id) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({ id, x: rect.right + 4, y: rect.top });
  }

  function startRename(id: number, currentTitle: string) {
    setOpenMenu(null);
    setRenameValue(currentTitle);
    setRenamingId(id);
  }

  async function commitRename(id: number) {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed || !onRename) return;
    await onRename(id, trimmed);
  }

  async function handleDelete(id: number) {
    setOpenMenu(null);
    if (!onDelete) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  function openHelpTicketModal(reviewId: number) {
    setOpenMenu(null);
    setHelpReviewId(reviewId);
    setHelpSubject("");
    setHelpTicketError(null);
    setHelpTicketSuccess(false);
  }

  function closeHelpTicketModal() {
    if (isTicketPending) return;
    setHelpReviewId(null);
    setHelpSubject("");
    setHelpTicketError(null);
    setHelpTicketSuccess(false);
  }

  function submitHelpTicket() {
    if (helpReviewId === null) return;
    setHelpTicketError(null);
    startTicketTransition(async () => {
      const res = await createUserSupportTicketForReview(helpReviewId, helpSubject);
      if (res.ok) {
        setHelpTicketSuccess(true);
        return;
      }
      const errKey =
        res.error === "NOT_AUTHENTICATED"
          ? "helpTicketError_NOT_AUTHENTICATED"
          : res.error === "REVIEW_NOT_FOUND"
            ? "helpTicketError_REVIEW_NOT_FOUND"
            : res.error === "SUBJECT_REQUIRED"
              ? "helpTicketError_SUBJECT_REQUIRED"
              : res.error === "SUBJECT_TOO_LONG"
                ? "helpTicketError_SUBJECT_TOO_LONG"
                : "helpTicketError_TICKET_INSERT_FAILED";
      setHelpTicketError(tHelp(errKey));
    });
  }

  /** 左侧状态色条 — 扫一眼即可区分阶段 */
  function accentBarColor(v: SidebarReviewItem["variant"]) {
    if (v === "done") return "var(--teal)";
    if (v === "failed") return "var(--danger)";
    if (v === "processing") return "var(--brand)";
    return "#94A3B8";
  }

  function statusPillStyle(v: SidebarReviewItem["variant"]): CSSProperties {
    if (v === "done") {
      return {
        background: "var(--teal-bg)",
        color: "var(--teal)",
        border: "1px solid rgba(0, 180, 166, 0.22)",
      };
    }
    if (v === "failed") {
      return {
        background: "rgba(239, 68, 68, 0.08)",
        color: "var(--danger)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
      };
    }
    if (v === "processing") {
      return {
        background: "var(--brand-bg)",
        color: "var(--brand)",
        border: "1px solid rgba(0, 87, 255, 0.18)",
      };
    }
    return {
      background: "var(--bg-muted)",
      color: "var(--text-secondary)",
      border: "1px solid var(--border)",
    };
  }

  function StatusIcon({ variant }: { variant: SidebarReviewItem["variant"] }) {
    if (variant === "done") return <CheckCircle2 size={11} strokeWidth={2} aria-hidden />;
    if (variant === "failed") return <AlertCircle size={11} strokeWidth={2} aria-hidden />;
    if (variant === "processing") {
      return (
        <Loader2
          size={11}
          strokeWidth={2}
          className="animate-spin"
          aria-hidden
          style={{ flexShrink: 0 }}
        />
      );
    }
    return <CircleDashed size={11} strokeWidth={2} aria-hidden />;
  }

  return (
    <>
      {/* Click-outside backdrop for menu */}
      {openMenu ? (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 998 }}
          onClick={() => setOpenMenu(null)}
          aria-hidden
        />
      ) : null}

      {/* Dropdown menu — fixed position to escape overflow:hidden */}
      {openMenu ? (
        <div
          style={{
            position: "fixed",
            top: openMenu.y,
            left: openMenu.x,
            zIndex: 999,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "var(--shadow-lg)",
            minWidth: 180,
            padding: "4px",
            animation: "fade-in 0.1s ease",
          }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {[
            {
              key: "help",
              icon: <LifeBuoy size={14} strokeWidth={2} aria-hidden />,
              label: tHelp("historySeekHelp"),
              onClick: () => openHelpTicketModal(openMenu.id),
              danger: false,
            },
            {
              key: "rename",
              icon: <Pencil size={14} strokeWidth={2} aria-hidden />,
              label: renameLabel,
              onClick: () => {
                const item = items.find((i) => i.id === openMenu.id);
                if (item) startRename(item.id, item.title);
              },
              danger: false,
            },
            {
              key: "delete",
              icon: <Trash2 size={14} strokeWidth={2} aria-hidden />,
              label: deleteLabel,
              onClick: () => handleDelete(openMenu.id),
              danger: true,
            },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="menuitem"
              onClick={opt.onClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: opt.danger ? "var(--danger)" : "var(--text-primary)",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = opt.danger
                  ? "rgba(239,68,68,0.06)"
                  : "var(--bg-subtle)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span style={{ color: opt.danger ? "var(--danger)" : "var(--text-secondary)", flexShrink: 0 }}>
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      {helpReviewId !== null ? (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15, 23, 42, 0.35)" }}
            onClick={() => closeHelpTicketModal()}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal
            aria-labelledby="help-ticket-dialog-title"
            style={{
              position: "fixed",
              zIndex: 1001,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(calc(100vw - 32px), 420px)",
              maxWidth: "100%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              boxShadow: "var(--shadow-xl)",
              padding: 20,
              animation: "fade-in 0.15s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="help-ticket-dialog-title"
              style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}
            >
              {helpTicketSuccess ? tHelp("helpTicketSuccessTitle") : tHelp("helpTicketTitle")}
            </h2>
            {helpTicketSuccess ? (
              <p style={{ fontSize: 14, color: "var(--success)", marginBottom: 8, lineHeight: 1.55 }}>
                {tHelp("helpTicketSuccess")}
              </p>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                  {tHelp("helpTicketHint")}
                </p>
                <label
                  htmlFor="help-ticket-subject"
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 6,
                  }}
                >
                  {tHelp("helpTicketSubjectLabel")}
                </label>
                <input
                  id="help-ticket-subject"
                  type="text"
                  value={helpSubject}
                  onChange={(e) => setHelpSubject(e.target.value)}
                  placeholder={tHelp("helpTicketSubjectPlaceholder")}
                  maxLength={200}
                  disabled={isTicketPending}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    fontSize: 14,
                    marginBottom: 12,
                    boxSizing: "border-box",
                  }}
                />
                {helpTicketError ? (
                  <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{helpTicketError}</p>
                ) : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => closeHelpTicketModal()}
                    disabled={isTicketPending}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--bg-subtle)",
                      color: "var(--text-primary)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isTicketPending ? "not-allowed" : "pointer",
                      opacity: isTicketPending ? 0.7 : 1,
                    }}
                  >
                    {tHelp("helpTicketCancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => submitHelpTicket()}
                    disabled={isTicketPending}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 10,
                      border: "none",
                      background: "var(--brand)",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isTicketPending ? "not-allowed" : "pointer",
                      opacity: isTicketPending ? 0.85 : 1,
                    }}
                  >
                    {isTicketPending ? tHelp("helpTicketSubmitting") : tHelp("helpTicketSubmit")}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}

      <aside
        className="review-history-sidebar"
        style={{
          width: collapsed ? 56 : 260,
          flexShrink: 0,
          borderRadius: 20,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.25s ease",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 12px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: 8,
            minHeight: 52,
          }}
        >
          {!collapsed && (
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", paddingLeft: 4 }}>
              {title}
            </span>
          )}
          <button
            type="button"
            title={collapsed ? expandLabel : collapseLabel}
            aria-label={collapsed ? expandLabel : collapseLabel}
            onClick={() => setCollapsed((c) => !c)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {/* New review button */}
        {!collapsed && (
          <div style={{ padding: "8px 10px 0" }}>
            <button
              type="button"
              onClick={onNewReview}
              style={{
                width: "100%",
                fontSize: 12,
                fontWeight: 600,
                padding: "9px 12px",
                borderRadius: 10,
                border: "1px dashed var(--border-strong)",
                background: "transparent",
                color: "var(--brand)",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--brand-bg)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              + {newReviewLabel}
            </button>
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: collapsed ? "8px 6px" : "8px 8px 12px" }}>
          {items.length === 0 ? (
            !collapsed && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55, padding: "8px 6px" }}>
                {emptyHint}
              </p>
            )
          ) : (
            items.map((item) => {
              const selected = selectedId === item.id;
              const isHovered = hoverItemId === item.id;
              const isRenaming = renamingId === item.id;
              const isDeleting = deletingId === item.id;
              const isLoadingSelection = loadingItemId === item.id;

              return (
                <div
                  key={item.id}
                  style={{ position: "relative", marginBottom: 2 }}
                  onMouseEnter={() => setHoverItemId(item.id)}
                  onMouseLeave={() => setHoverItemId(null)}
                >
                  <button
                    type="button"
                    title={
                      !isRenaming
                        ? `${item.title} · ${item.statusLabel}`
                        : undefined
                    }
                    onClick={() => !isRenaming && onSelect(item.id)}
                    disabled={isDeleting}
                    aria-busy={isLoadingSelection || undefined}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderRadius: 10,
                      padding: collapsed ? "10px 6px" : "10px 10px 10px 8px",
                      paddingRight: collapsed ? 6 : !isRenaming && isHovered ? 32 : 10,
                      cursor: isDeleting || isLoadingSelection ? "wait" : "pointer",
                      background: selected
                        ? "var(--brand-bg)"
                        : isHovered
                          ? "var(--bg-subtle)"
                          : "transparent",
                      display: "flex",
                      flexDirection: "row",
                      alignItems: collapsed ? "center" : "stretch",
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: 0,
                      opacity: isDeleting ? 0.45 : 1,
                      transition: "background 0.12s, opacity 0.15s",
                      outline: selected ? "1.5px solid var(--brand)" : "none",
                      outlineOffset: -1,
                      position: "relative",
                    }}
                  >
                    {collapsed ? (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: "var(--bg-subtle)",
                          color: accentBarColor(item.variant),
                          border: `2px solid ${accentBarColor(item.variant)}`,
                          opacity: item.variant === "pending" ? 0.85 : 1,
                        }}
                      >
                        {isLoadingSelection ? (
                          <Loader2
                            size={14}
                            strokeWidth={2}
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden
                            style={{ color: "var(--brand)", flexShrink: 0 }}
                          />
                        ) : (
                          <StatusIcon variant={item.variant} />
                        )}
                      </span>
                    ) : (
                      <>
                        <span
                          aria-hidden
                          style={{
                            width: 3,
                            flexShrink: 0,
                            borderRadius: 2,
                            background: accentBarColor(item.variant),
                            marginRight: 10,
                            alignSelf: "stretch",
                            minHeight: 36,
                          }}
                        />
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 6,
                          }}
                        >
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              placeholder={renamePlaceholder}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename(item.id);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              onBlur={() => commitRename(item.id)}
                              style={{
                                width: "100%",
                                fontSize: 13,
                                fontWeight: 500,
                                color: "var(--text-primary)",
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                padding: 0,
                              }}
                            />
                          ) : (
                            <>
                              <span
                                style={{
                                  width: "100%",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: selected ? "var(--brand)" : "var(--text-primary)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  lineHeight: 1.35,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  minWidth: 0,
                                }}
                              >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                                  {item.title}
                                </span>
                                {isLoadingSelection ? (
                                  <Loader2
                                    size={14}
                                    strokeWidth={2}
                                    className="animate-spin motion-reduce:animate-none shrink-0"
                                    aria-hidden
                                    style={{ color: "var(--brand)" }}
                                  />
                                ) : null}
                              </span>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  maxWidth: "100%",
                                  ...statusPillStyle(item.variant),
                                }}
                              >
                                <StatusIcon variant={item.variant} />
                                <span
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {item.statusLabel}
                                </span>
                              </span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </button>

                  {/* ··· menu button — only when expanded, hovered, not renaming */}
                  {!collapsed && !isRenaming && (onRename || onDelete) && isHovered ? (
                    <button
                      type="button"
                      aria-label="More actions"
                      onClick={(e) => openMenuFor(e, item.id)}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: 10,
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        border: "none",
                        background: openMenu?.id === item.id ? "var(--brand-bg)" : "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: openMenu?.id === item.id ? "var(--brand)" : "var(--text-muted)",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--brand-bg)";
                        (e.currentTarget as HTMLElement).style.color = "var(--brand)";
                      }}
                      onMouseLeave={(e) => {
                        if (openMenu?.id !== item.id) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                        }
                      }}
                    >
                      <MoreVertical size={14} strokeWidth={2} aria-hidden />
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
