/**
 * Field — Form input with confidence badge, edited indicator, and
 * low-confidence highlighting.
 */
import { useState } from "react";
import { MV } from "../theme";
import ConfBadge from "./ConfBadge";

export default function Field({
  label,
  value,
  confidence,
  onChange,
  edited,
  required,
  type = "text",
  span,
  placeholder,
}) {
  const [focused, setFocused] = useState(false);
  const isLow = confidence !== undefined && confidence < 0.85;

  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: MV.textMuted }}>
          {label}
          {required && <span style={{ color: MV.danger }}>*</span>}
        </label>
        <div className="flex gap-1 items-center">
          {edited && (
            <span
              className="text-[10px] font-bold px-[5px] py-[1px] rounded"
              style={{ color: MV.tealDark, backgroundColor: MV.tealLight }}
            >
              EDITED
            </span>
          )}
          {confidence !== undefined && <ConfBadge c={confidence} />}
        </div>
      </div>
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-[11px] py-[9px] text-sm rounded-[5px] outline-none transition-all"
        style={{
          border: `1.5px solid ${focused ? MV.teal : isLow ? MV.warningBorder : MV.gray200}`,
          color: MV.text,
          backgroundColor: isLow ? MV.warningLight : MV.white,
          boxShadow: focused ? "0 0 0 3px rgba(126, 190, 197, 0.2)" : "none",
        }}
      />
    </div>
  );
}
