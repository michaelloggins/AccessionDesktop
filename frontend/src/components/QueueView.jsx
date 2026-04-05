/**
 * QueueView — Today's accessions table.
 */
import { MV } from "../theme";
import StatusBadge from "./StatusBadge";

// Placeholder data — in production this comes from the backend
const QUEUE_DATA = [
  { id: "ACC-2026-0847", patient: "Max", species: "Canine", owner: "Davis, Emily", tests: "310", status: "submitted", time: "08:12 AM", station: "S1" },
  { id: "ACC-2026-0848", patient: "Whiskers", species: "Feline", owner: "Park, James", tests: "316, 315", status: "submitted", time: "08:18 AM", station: "S2" },
  { id: "ACC-2026-0849", patient: "Duke", species: "Canine", owner: "Martinez, Rosa", tests: "310, 316", status: "pending", time: "08:23 AM", station: "S3" },
  { id: "ACC-2026-0850", patient: "Luna", species: "Feline", owner: "Thompson, Mark", tests: "319", status: "queued", time: "08:31 AM", station: "S1" },
  { id: "ACC-2026-0851", patient: "Rocky", species: "Canine", owner: "Wilson, Sarah", tests: "908", status: "submitted", time: "08:44 AM", station: "S4" },
];

const HEADERS = ["Accession ID", "Patient", "Species", "Owner", "Tests", "Status", "Time", "Stn"];

export default function QueueView() {
  const submitted = QUEUE_DATA.filter((q) => q.status === "submitted").length;
  const pending = QUEUE_DATA.filter((q) => q.status === "pending").length;
  const queued = QUEUE_DATA.filter((q) => q.status === "queued").length;

  return (
    <div className="flex-1 p-6 overflow-auto" style={{ backgroundColor: MV.offWhite }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold m-0" style={{ color: MV.text }}>Today's Accessions</h2>
          <div className="flex gap-4 text-[13px]" style={{ color: MV.textMuted }}>
            <span>Total: <strong style={{ color: MV.text }}>{QUEUE_DATA.length}</strong></span>
            <span>Submitted: <strong style={{ color: MV.success }}>{submitted}</strong></span>
            <span>Pending: <strong style={{ color: MV.warning }}>{pending}</strong></span>
            <span>Queued: <strong style={{ color: MV.tealDark }}>{queued}</strong></span>
          </div>
        </div>

        <div
          className="rounded-lg overflow-hidden"
          style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}` }}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ backgroundColor: MV.gray50, borderBottom: `2px solid ${MV.gray200}` }}>
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    className="px-3.5 py-2.5 text-left text-[11px] font-bold uppercase"
                    style={{ color: MV.textMuted, letterSpacing: "0.05em" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QUEUE_DATA.map((r, i) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: `1px solid ${MV.gray100}`,
                    backgroundColor: i % 2 === 0 ? MV.white : MV.gray50,
                  }}
                >
                  <td className="px-3.5 py-3 font-mono text-[13px] font-semibold" style={{ color: MV.green2 }}>{r.id}</td>
                  <td className="px-3.5 py-3 font-medium">{r.patient}</td>
                  <td className="px-3.5 py-3" style={{ color: MV.textMuted }}>{r.species}</td>
                  <td className="px-3.5 py-3" style={{ color: MV.textMuted }}>{r.owner}</td>
                  <td className="px-3.5 py-3 text-xs font-mono" style={{ color: MV.tealDark }}>{r.tests}</td>
                  <td className="px-3.5 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-3.5 py-3 font-mono text-[13px]" style={{ color: MV.textMuted }}>{r.time}</td>
                  <td className="px-3.5 py-3 text-xs font-semibold" style={{ color: MV.textMuted }}>{r.station}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
