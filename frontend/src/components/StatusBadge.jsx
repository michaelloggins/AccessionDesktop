/**
 * StatusBadge — Queue table status indicator (submitted/pending/queued/failed).
 */
import { MV } from "../theme";

const STATUS_MAP = {
  submitted: { bg: MV.successLight, color: MV.success, border: MV.successBorder },
  pending: { bg: MV.warningLight, color: MV.warning, border: MV.warningBorder },
  queued: { bg: MV.tealLight, color: MV.tealDark, border: MV.teal },
  failed: { bg: MV.dangerLight, color: MV.danger, border: MV.dangerBorder },
};

export default function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.queued;
  return (
    <span
      className="text-[11px] font-bold px-2 py-[3px] rounded uppercase tracking-wide"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      {status}
    </span>
  );
}
