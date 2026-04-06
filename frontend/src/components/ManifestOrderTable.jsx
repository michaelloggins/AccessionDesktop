/**
 * ManifestOrderTable — Table of orders in a multi-order manifest.
 * Shows patient summary, tests, and edit/delete actions per row.
 */
import { MV } from "../theme";

export default function ManifestOrderTable({ orders, orderType, onEdit, onDelete }) {
  const isVet = orderType === "veterinary";

  if (orders.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: MV.gray400 }}>
        <div className="text-3xl mb-2">{"\u2630"}</div>
        <div className="text-sm">No orders added yet. Click "New Order" to start.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${MV.gray200}` }}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ backgroundColor: MV.gray50, borderBottom: `2px solid ${MV.gray200}` }}>
            <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase" style={{ color: MV.textMuted, letterSpacing: "0.05em" }}>#</th>
            {isVet ? (
              <>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase" style={{ color: MV.textMuted }}>Owner</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase" style={{ color: MV.textMuted }}>Pet Name</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase" style={{ color: MV.textMuted }}>Species</th>
              </>
            ) : (
              <>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase" style={{ color: MV.textMuted }}>Last Name</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase" style={{ color: MV.textMuted }}>First Name</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase" style={{ color: MV.textMuted }}>DOB</th>
              </>
            )}
            <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase" style={{ color: MV.textMuted }}>Tests</th>
            <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase" style={{ color: MV.textMuted }}>Specimen</th>
            <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase" style={{ color: MV.textMuted, width: 80 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, i) => (
            <tr
              key={i}
              style={{
                borderBottom: `1px solid ${MV.gray100}`,
                backgroundColor: i % 2 === 0 ? MV.white : MV.gray50,
              }}
            >
              <td className="px-3 py-2.5 font-bold text-[13px]" style={{ color: MV.gray400 }}>{i + 1}</td>
              {isVet ? (
                <>
                  <td className="px-3 py-2.5 font-medium">{order.patient.owner_name || "—"}</td>
                  <td className="px-3 py-2.5">{order.patient.name || "—"}</td>
                  <td className="px-3 py-2.5" style={{ color: MV.textMuted }}>{order.patient.species || "—"}</td>
                </>
              ) : (
                <>
                  <td className="px-3 py-2.5 font-medium">{order.patient.name || "—"}</td>
                  <td className="px-3 py-2.5">{order.patient.first_name || "—"}</td>
                  <td className="px-3 py-2.5" style={{ color: MV.textMuted }}>{order.patient.dob || "—"}</td>
                </>
              )}
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {order.tests.map((t, j) => (
                    <span
                      key={j}
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: MV.tealLight, color: MV.tealDark, border: `1px solid rgba(126,190,197,0.3)` }}
                    >
                      {t.code}
                    </span>
                  ))}
                  {order.tests.length === 0 && <span style={{ color: MV.gray400 }}>—</span>}
                </div>
              </td>
              <td className="px-3 py-2.5 text-[12px]" style={{ color: MV.textMuted }}>
                {order.tests.filter((t) => t.specimen_type).map((t) => t.specimen_type).join(", ") || "—"}
              </td>
              <td className="px-3 py-2.5 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onEdit(i)}
                    className="px-2 py-1 rounded text-xs font-semibold cursor-pointer bg-transparent"
                    style={{ color: MV.tealDark, border: `1px solid ${MV.teal}` }}
                    title="Edit order"
                  >
                    {"\u270E"}
                  </button>
                  <button
                    onClick={() => onDelete(i)}
                    className="px-2 py-1 rounded text-xs font-semibold cursor-pointer bg-transparent"
                    style={{ color: MV.danger, border: `1px solid ${MV.dangerBorder}` }}
                    title="Delete order"
                  >
                    {"\u2717"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
