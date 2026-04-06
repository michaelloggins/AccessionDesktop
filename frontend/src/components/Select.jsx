/**
 * Select — Styled dropdown matching the Field component look.
 */
import { useState } from "react";
import { MV } from "../theme";

export default function Select({ label, value, options, onChange, required, span, placeholder }) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: MV.textMuted }}>
          {label}
          {required && <span style={{ color: MV.danger }}>*</span>}
        </label>
      </div>
      <select
        value={value || ""}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-[11px] py-[9px] text-sm rounded-[5px] outline-none transition-all appearance-none cursor-pointer"
        style={{
          border: `1.5px solid ${focused ? MV.teal : MV.gray200}`,
          color: value ? MV.text : MV.gray400,
          backgroundColor: MV.white,
          boxShadow: focused ? "0 0 0 3px rgba(126, 190, 197, 0.2)" : "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          paddingRight: "30px",
        }}
      >
        <option value="">{placeholder || "Select..."}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
