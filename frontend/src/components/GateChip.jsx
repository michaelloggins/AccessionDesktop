/**
 * GateChip — Compact pass/warn/fail gate status indicator.
 */
import { MV } from "../theme";

const STATUS_MAP = {
  pass: { icon: "\u2713", color: MV.success, bg: MV.successLight, border: MV.successBorder },
  warn: { icon: "\u26A0", color: MV.warning, bg: MV.warningLight, border: MV.warningBorder },
  fail: { icon: "\u2717", color: MV.danger, bg: MV.dangerLight, border: MV.dangerBorder },
  pending: { icon: "\u25CB", color: MV.gray400, bg: MV.gray100, border: MV.gray200 },
};

export default function GateChip({ status, label, onClick }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[13px] cursor-default"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      <span className="font-bold" style={{ color: s.color }}>{s.icon}</span>
      <span className="font-medium" style={{ color: s.color }}>{label}</span>
    </div>
  );
}
