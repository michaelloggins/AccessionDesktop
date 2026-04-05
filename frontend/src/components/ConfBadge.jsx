/**
 * ConfBadge — Per-field AI confidence indicator.
 * Green (>=85%), Yellow (75-84%), Red (<75%)
 */
import { MV } from "../theme";

export default function ConfBadge({ c }) {
  const p = Math.round(c * 100);
  const vlow = p < 75;
  const low = p < 85;
  const color = vlow ? MV.danger : low ? MV.warning : MV.success;
  const bg = vlow ? MV.dangerLight : low ? MV.warningLight : MV.successLight;
  const border = vlow ? MV.dangerBorder : low ? MV.warningBorder : MV.successBorder;

  return (
    <span
      style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
      className="text-[11px] font-semibold px-[7px] py-[2px] rounded font-mono"
    >
      {p}%
    </span>
  );
}
