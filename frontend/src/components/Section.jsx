/**
 * Section — Collapsible card with validation status indicator.
 *
 * Status: "complete" (green), "warning" (yellow), "error" (red), "empty" (neutral)
 * Collapses/expands on header click. Shows status chip + count in header.
 */
import { useState } from "react";
import { MV } from "../theme";

const STATUS_CONFIG = {
  complete: {
    color: MV.success,
    bg: MV.successLight,
    border: MV.successBorder,
    icon: "\u2713",
    label: "Complete",
  },
  warning: {
    color: MV.warning,
    bg: MV.warningLight,
    border: MV.warningBorder,
    icon: "\u26A0",
    label: "Needs Attention",
  },
  error: {
    color: MV.danger,
    bg: MV.dangerLight,
    border: MV.dangerBorder,
    icon: "\u2717",
    label: "Issues",
  },
  empty: {
    color: MV.gray400,
    bg: MV.gray100,
    border: MV.gray200,
    icon: "\u25CB",
    label: "",
  },
};

export default function Section({
  color,
  title,
  status = "empty",
  statusDetail,
  locked,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.empty;

  return (
    <div
      className="mb-5 rounded-lg"
      style={{
        border: `1px solid ${status === "empty" ? MV.gray200 : cfg.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header — clickable to expand/collapse */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
        style={{
          backgroundColor: status === "empty" ? MV.white : cfg.bg,
          borderBottom: open ? `1px solid ${status === "empty" ? MV.gray200 : cfg.border}` : "none",
        }}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          {/* Color accent bar */}
          <div className="w-1 h-5 rounded-sm flex-shrink-0" style={{ background: color }} />

          {/* Expand/collapse chevron */}
          <span
            className="text-xs transition-transform flex-shrink-0"
            style={{
              color: MV.gray400,
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            {"\u25B6"}
          </span>

          <h3 className="text-[15px] font-bold m-0" style={{ color: MV.text }}>
            {title}
          </h3>

          {locked && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: MV.tealDark, backgroundColor: MV.tealLight }}
            >
              MANIFEST — SHARED
            </span>
          )}
        </div>

        {/* Status chip */}
        {status !== "empty" && (
          <div className="flex items-center gap-1.5">
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1"
              style={{
                color: cfg.color,
                backgroundColor: status === "empty" ? "transparent" : `${cfg.bg}`,
                border: `1px solid ${cfg.border}`,
              }}
            >
              <span>{cfg.icon}</span>
              <span>{statusDetail || cfg.label}</span>
            </span>
          </div>
        )}
      </div>

      {/* Body — collapsible, overflow visible for dropdowns */}
      {open && (
        <div
          className="px-5 py-4 relative"
          style={{ backgroundColor: locked ? MV.gray50 : MV.white, overflow: "visible" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
