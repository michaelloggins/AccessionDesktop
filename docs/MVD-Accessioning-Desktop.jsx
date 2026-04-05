import { useState, useEffect } from "react";

// MiraVista brand palette extracted from miravistalabs.com
const MV = {
  green1: "#85b43b",
  green2: "#286f1f",
  greenGrad: "linear-gradient(135deg, #85b43b, #286f1f)",
  teal: "#7EBEC5",
  tealLight: "#e8f4f6",
  tealDark: "#5a9da5",
  blue: "#2ea3f2",
  white: "#ffffff",
  offWhite: "#f7f8fa",
  cream: "#f7f5e7",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
  text: "#2d3940",
  textLight: "#4e4e4e",
  textMuted: "#6b7280",
  danger: "#dc2626",
  dangerLight: "#fef2f2",
  dangerBorder: "#fecaca",
  warning: "#d97706",
  warningLight: "#fffbeb",
  warningBorder: "#fde68a",
  success: "#16a34a",
  successLight: "#f0fdf4",
  successBorder: "#bbf7d0",
};

const MOCK_OCR = {
  patient_name: { value: "Bella", confidence: 0.98 },
  species: { value: "Canine", confidence: 0.97 },
  breed: { value: "Golden Retriever", confidence: 0.91 },
  owner_name: { value: "Smith, John", confidence: 0.95 },
  owner_phone: { value: "317-555-0142", confidence: 0.82 },
  referring_vet: { value: "Dr. Sarah Chen", confidence: 0.93 },
  referring_clinic: { value: "Fishers Animal Hospital", confidence: 0.90 },
  npi: { value: "1234567890", confidence: 0.96 },
  specimen_type: { value: "Urine", confidence: 0.99 },
  collection_date: { value: "2026-04-01", confidence: 0.79 },
  tests_ordered: [
    { value: "Histoplasma Quantitative EIA", confidence: 0.94, code: "HISTO-AG-EIA" },
    { value: "Blastomyces Quantitative EIA", confidence: 0.91, code: "BLASTO-AG-EIA" },
  ],
  clinical_notes: { value: "Suspected histoplasmosis, weight loss, lethargy x2 weeks", confidence: 0.74 },
};

const QUEUE_DATA = [
  { id: "ACC-2026-0847", patient: "Max", species: "Canine", owner: "Davis, Emily", tests: "HISTO-AG-EIA", status: "submitted", time: "08:12 AM", station: "S1" },
  { id: "ACC-2026-0848", patient: "Whiskers", species: "Feline", owner: "Park, James", tests: "BLASTO-AG-EIA, COCCI-AG-EIA", status: "submitted", time: "08:18 AM", station: "S2" },
  { id: "ACC-2026-0849", patient: "Duke", species: "Canine", owner: "Martinez, Rosa", tests: "HISTO-AG-EIA, BLASTO-AG-EIA", status: "pending", time: "08:23 AM", station: "S3" },
  { id: "ACC-2026-0850", patient: "Luna", species: "Feline", owner: "Thompson, Mark", tests: "CRYPTO-AG-EIA", status: "queued", time: "08:31 AM", station: "S1" },
  { id: "ACC-2026-0851", patient: "Rocky", species: "Canine", owner: "Wilson, Sarah", tests: "FUNGAL-PANEL-1", status: "submitted", time: "08:44 AM", station: "S4" },
];

const TESTS = [
  { code: "HISTO-AG-EIA", name: "Histoplasma Quantitative EIA", type: "Antigen", specimen: "Urine, Serum, BAL, CSF" },
  { code: "BLASTO-AG-EIA", name: "Blastomyces Quantitative EIA", type: "Antigen", specimen: "Urine, Serum" },
  { code: "COCCI-AG-EIA", name: "Coccidioides Quantitative EIA", type: "Antigen", specimen: "Urine, Serum, BAL, CSF" },
  { code: "CRYPTO-LAT", name: "Cryptococcus Latex Agglutination", type: "Antigen", specimen: "Serum, CSF" },
  { code: "ASPERG-GM", name: "Aspergillus Galactomannan EIA", type: "Antigen", specimen: "Serum, BAL" },
  { code: "BDG-ASSAY", name: "Beta-D Glucan Assay", type: "Antigen", specimen: "Serum" },
  { code: "HISTO-AB-EIA", name: "Histoplasma Antibody IgG/IgM EIA", type: "Antibody", specimen: "Serum" },
  { code: "HISTO-AB-ID", name: "Histoplasma Antibody Immunodiffusion", type: "Antibody", specimen: "Serum" },
  { code: "BLASTO-AB-EIA", name: "Blastomyces IgG Antibody EIA", type: "Antibody", specimen: "Serum" },
  { code: "COCCI-AB-EIA", name: "Coccidioides Antibody IgG/IgM EIA", type: "Antibody", specimen: "Serum" },
  { code: "PCP-PCR", name: "Pneumocystis DNA PCR", type: "Molecular", specimen: "BAL" },
  { code: "FUNGAL-PCR", name: "Pulmonary Fungal Pathogen PCR Panel", type: "Molecular", specimen: "BAL" },
];

const font = "'Roboto Condensed', Helvetica, Arial, sans-serif";

const ConfBadge = ({ c }) => {
  const p = Math.round(c * 100);
  const low = p < 85;
  const vlow = p < 75;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 3, fontFamily: "monospace",
      color: vlow ? MV.danger : low ? MV.warning : MV.success,
      backgroundColor: vlow ? MV.dangerLight : low ? MV.warningLight : MV.successLight,
      border: `1px solid ${vlow ? MV.dangerBorder : low ? MV.warningBorder : MV.successBorder}`,
    }}>{p}%</span>
  );
};

const GateChip = ({ status, label }) => {
  const map = {
    pass: { icon: "✓", color: MV.success, bg: MV.successLight, border: MV.successBorder },
    warn: { icon: "⚠", color: MV.warning, bg: MV.warningLight, border: MV.warningBorder },
    fail: { icon: "✕", color: MV.danger, bg: MV.dangerLight, border: MV.dangerBorder },
    pending: { icon: "○", color: MV.gray400, bg: MV.gray100, border: MV.gray200 },
  };
  const s = map[status] || map.pending;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
      borderRadius: 5, backgroundColor: s.bg, border: `1px solid ${s.border}`, fontSize: 13,
    }}>
      <span style={{ fontWeight: 700, color: s.color }}>{s.icon}</span>
      <span style={{ fontWeight: 500, color: s.color }}>{label}</span>
    </div>
  );
};

const Field = ({ label, value, confidence, onChange, edited, required, type = "text", span }) => {
  const [focused, setFocused] = useState(false);
  const isLow = confidence !== undefined && confidence < 0.85;
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: MV.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: font }}>
          {label}{required && <span style={{ color: MV.danger }}>*</span>}
        </label>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {edited && <span style={{ fontSize: 10, fontWeight: 700, color: MV.tealDark, backgroundColor: MV.tealLight, padding: "1px 5px", borderRadius: 3 }}>EDITED</span>}
          {confidence !== undefined && <ConfBadge c={confidence} />}
        </div>
      </div>
      <input type={type} value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", padding: "9px 11px", fontSize: 14, fontFamily: font,
          border: `1.5px solid ${focused ? MV.teal : isLow ? MV.warningBorder : MV.gray200}`,
          borderRadius: 5, outline: "none", color: MV.text,
          backgroundColor: isLow ? MV.warningLight : MV.white,
          boxShadow: focused ? `0 0 0 3px rgba(126, 190, 197, 0.2)` : "none",
          transition: "all 0.15s",
        }}
      />
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    submitted: { bg: MV.successLight, color: MV.success, border: MV.successBorder },
    pending: { bg: MV.warningLight, color: MV.warning, border: MV.warningBorder },
    queued: { bg: MV.tealLight, color: MV.tealDark, border: MV.teal },
    failed: { bg: MV.dangerLight, color: MV.danger, border: MV.dangerBorder },
  };
  const s = map[status] || map.queued;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 3, textTransform: "uppercase",
      letterSpacing: "0.03em", color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}`,
    }}>{status}</span>
  );
};

export default function App() {
  const [tab, setTab] = useState("accession");
  const [mode, setMode] = useState("scan");
  const [scanPhase, setScanPhase] = useState("idle");
  const [fields, setFields] = useState({ patient_name: "", species: "", breed: "", owner_name: "", owner_phone: "", referring_vet: "", referring_clinic: "", npi: "", specimen_type: "", collection_date: "", clinical_notes: "" });
  const [confs, setConfs] = useState({});
  const [tests, setTests] = useState([]);
  const [edited, setEdited] = useState(new Set());
  const [gates, setGates] = useState({ specimen: "pending", compendium: "pending", duplicate: "pending" });
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const upd = (k, v) => { setFields(f => ({ ...f, [k]: v })); setEdited(e => new Set([...e, k])); };

  const doScan = () => {
    setScanPhase("scanning");
    setTimeout(() => {
      setScanPhase("processing");
      setTimeout(() => {
        const nf = {}, nc = {};
        Object.entries(MOCK_OCR).forEach(([k, v]) => { if (k !== "tests_ordered") { nf[k] = v.value; nc[k] = v.confidence; } });
        setFields(f => ({ ...f, ...nf })); setConfs(nc); setEdited(new Set());
        setTests(MOCK_OCR.tests_ordered.map(t => ({ name: t.value, code: t.code })));
        setScanPhase("complete");
        setTimeout(() => setGates({ specimen: "pass", compendium: "pass", duplicate: "warn" }), 600);
      }, 2000);
    }, 1200);
  };

  const reset = () => {
    setFields({ patient_name: "", species: "", breed: "", owner_name: "", owner_phone: "", referring_vet: "", referring_clinic: "", npi: "", specimen_type: "", collection_date: "", clinical_notes: "" });
    setConfs({}); setEdited(new Set()); setTests([]); setGates({ specimen: "pending", compendium: "pending", duplicate: "pending" }); setScanPhase("idle");
  };

  const filtTests = TESTS.filter(t => (t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase())) && !tests.find(s => s.code === t.code));

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  return (
    <div style={{ width: 1440, minHeight: 900, margin: "0 auto", fontFamily: font, color: MV.text, backgroundColor: MV.offWhite, display: "flex", flexDirection: "column" }}>

      {/* ═══ Top Header Bar ═══ */}
      <header style={{ background: MV.greenGrad, height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="13" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/><text x="14" y="18" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily={font}>M</text></svg>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", lineHeight: 1 }}>MiraVista Diagnostics</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>Accessioning Workstation</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#4ade80" }} />
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>GB10 Online</span>
          </div>
          <div style={{ width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.25)" }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Station 3 — M. Jones</span>
        </div>
      </header>

      {/* ═══ Tab Bar ═══ */}
      <div style={{ backgroundColor: MV.white, borderBottom: `1px solid ${MV.gray200}`, padding: "0 24px", display: "flex", gap: 0, flexShrink: 0 }}>
        {[
          { id: "accession", label: "New Accession" },
          { id: "queue", label: "Today's Queue" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "12px 20px", fontSize: 14, fontWeight: 600, fontFamily: font, cursor: "pointer",
            border: "none", borderBottom: `3px solid ${tab === t.id ? MV.green1 : "transparent"}`,
            backgroundColor: "transparent", color: tab === t.id ? MV.green2 : MV.textMuted,
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: MV.textMuted }}>
          <span>Today: <strong style={{ color: MV.text }}>{QUEUE_DATA.length}</strong> accessions</span>
          <span>·</span>
          <span>Queue: <strong style={{ color: MV.warning }}>1</strong> pending</span>
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {tab === "accession" && (
          <>
            {/* ── Left Panel: Scan/Source ── */}
            <div style={{ width: 380, flexShrink: 0, borderRight: `1px solid ${MV.gray200}`, backgroundColor: MV.white, display: "flex", flexDirection: "column" }}>

              {/* Mode Toggle */}
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${MV.gray100}` }}>
                <div style={{ display: "flex", borderRadius: 6, border: `1px solid ${MV.gray200}`, overflow: "hidden" }}>
                  {[{ id: "scan", icon: "⎘", label: "Scan Requisition" }, { id: "manual", icon: "✎", label: "Manual Entry" }].map(m => (
                    <button key={m.id} onClick={() => { setMode(m.id); reset(); }} style={{
                      flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, fontFamily: font,
                      border: "none", cursor: "pointer",
                      backgroundColor: mode === m.id ? MV.green2 : MV.white,
                      color: mode === m.id ? "#fff" : MV.textMuted,
                      transition: "all 0.2s",
                    }}>{m.icon}  {m.label}</button>
                  ))}
                </div>
              </div>

              {/* Scan Zone */}
              <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{
                  flex: 1, borderRadius: 8, border: `2px dashed ${scanPhase !== "idle" ? MV.teal : MV.gray300}`,
                  backgroundColor: MV.gray50, display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative", overflow: "hidden", transition: "border-color 0.3s",
                }}>
                  {scanPhase === "idle" && mode === "scan" && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 48, color: MV.gray300, marginBottom: 8 }}>⎘</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: MV.textMuted }}>Place requisition on scanner</div>
                      <div style={{ fontSize: 13, color: MV.gray400, marginTop: 4 }}>or drag and drop an image file here</div>
                    </div>
                  )}
                  {scanPhase === "idle" && mode === "manual" && (
                    <div style={{ textAlign: "center", padding: 24 }}>
                      <div style={{ fontSize: 48, color: MV.gray300, marginBottom: 8 }}>✎</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: MV.textMuted }}>Manual Entry Mode</div>
                      <div style={{ fontSize: 13, color: MV.gray400, marginTop: 4, lineHeight: 1.5, maxWidth: 260 }}>
                        Enter all required fields manually. Use this when requisition forms are unavailable for scanning.
                      </div>
                    </div>
                  )}
                  {scanPhase === "scanning" && (
                    <>
                      <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${MV.teal}, transparent)`, animation: "scanline 1.5s linear infinite" }} />
                      <div style={{ fontSize: 15, fontWeight: 600, color: MV.teal }}>Scanning document...</div>
                      <style>{`@keyframes scanline { 0% { top: 0; } 100% { top: 100%; } }`}</style>
                    </>
                  )}
                  {scanPhase === "processing" && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ width: 36, height: 36, border: `3px solid ${MV.gray200}`, borderTopColor: MV.teal, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                      <div style={{ fontSize: 15, fontWeight: 600, color: MV.tealDark }}>AI Extracting Fields...</div>
                      <div style={{ fontSize: 12, color: MV.textMuted, marginTop: 4 }}>Qwen2.5-VL-72B processing</div>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}
                  {scanPhase === "complete" && (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: "70%", aspectRatio: "8.5/11", backgroundColor: "#fff", borderRadius: 4, boxShadow: "0 2px 12px rgba(0,0,0,0.1)", border: `1px solid ${MV.gray200}`, display: "flex", flexDirection: "column", padding: 16, gap: 8 }}>
                        <div style={{ height: 10, width: "55%", backgroundColor: MV.gray200, borderRadius: 2 }} />
                        <div style={{ height: 7, width: "75%", backgroundColor: MV.gray100, borderRadius: 2 }} />
                        <div style={{ height: 7, width: "40%", backgroundColor: MV.gray100, borderRadius: 2 }} />
                        <div style={{ flex: 1 }} />
                        <div style={{ height: 7, width: "65%", backgroundColor: MV.gray100, borderRadius: 2 }} />
                      </div>
                      <div style={{ marginTop: 10, fontSize: 13, color: MV.success, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>✓ Scan captured — fields extracted</div>
                    </div>
                  )}
                </div>
                {mode === "scan" && (
                  <button onClick={scanPhase === "idle" ? doScan : reset} style={{
                    padding: "11px 0", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 700, fontFamily: font, width: "100%",
                    background: scanPhase === "idle" ? MV.greenGrad : MV.white,
                    color: scanPhase === "idle" ? "#fff" : MV.textMuted,
                    border: scanPhase === "idle" ? "none" : `1px solid ${MV.gray200}`,
                    boxShadow: scanPhase === "idle" ? "0 2px 8px rgba(40, 111, 31, 0.25)" : "none",
                  }}>
                    {scanPhase === "idle" ? "Start Scan" : scanPhase === "complete" ? "Clear & Rescan" : "Processing..."}
                  </button>
                )}
              </div>

              {/* Gate Checks */}
              <div style={{ padding: "16px 20px", borderTop: `1px solid ${MV.gray100}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MV.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pre-Submit Gate Checks</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <GateChip status={gates.specimen} label="Fulcrum Specimen Registered" />
                  <GateChip status={gates.compendium} label="Compendium Test Validation" />
                  <GateChip status={gates.duplicate} label="Duplicate Order Check" />
                </div>
              </div>
            </div>

            {/* ── Right Panel: Form ── */}
            <div style={{ flex: 1, overflow: "auto", padding: "24px 36px 60px", backgroundColor: MV.offWhite }}>
              <div style={{ maxWidth: 900, margin: "0 auto" }}>

                {/* Section: Patient & Owner */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 4, height: 18, borderRadius: 2, background: MV.greenGrad }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: MV.text, margin: 0 }}>Patient & Owner Information</h3>
                  </div>
                  <div style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}`, borderRadius: 8, padding: 20 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <Field label="Patient Name" value={fields.patient_name} confidence={confs.patient_name} edited={edited.has("patient_name")} required onChange={e => upd("patient_name", e.target.value)} />
                      <Field label="Species" value={fields.species} confidence={confs.species} edited={edited.has("species")} required onChange={e => upd("species", e.target.value)} />
                      <Field label="Breed" value={fields.breed} confidence={confs.breed} edited={edited.has("breed")} onChange={e => upd("breed", e.target.value)} />
                      <Field label="Owner Name (Last, First)" value={fields.owner_name} confidence={confs.owner_name} edited={edited.has("owner_name")} required onChange={e => upd("owner_name", e.target.value)} />
                      <Field label="Owner Phone" value={fields.owner_phone} confidence={confs.owner_phone} edited={edited.has("owner_phone")} onChange={e => upd("owner_phone", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Section: Ordering */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: MV.teal }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: MV.text, margin: 0 }}>Ordering Information</h3>
                  </div>
                  <div style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}`, borderRadius: 8, padding: 20 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <Field label="Referring Veterinarian" value={fields.referring_vet} confidence={confs.referring_vet} edited={edited.has("referring_vet")} required onChange={e => upd("referring_vet", e.target.value)} />
                      <Field label="Referring Clinic" value={fields.referring_clinic} confidence={confs.referring_clinic} edited={edited.has("referring_clinic")} onChange={e => upd("referring_clinic", e.target.value)} />
                      <Field label="NPI" value={fields.npi} confidence={confs.npi} edited={edited.has("npi")} onChange={e => upd("npi", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Section: Specimen */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: MV.blue }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: MV.text, margin: 0 }}>Specimen Details</h3>
                  </div>
                  <div style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}`, borderRadius: 8, padding: 20 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                      <Field label="Specimen Type" value={fields.specimen_type} confidence={confs.specimen_type} edited={edited.has("specimen_type")} required onChange={e => upd("specimen_type", e.target.value)} />
                      <Field label="Collection Date" value={fields.collection_date} confidence={confs.collection_date} edited={edited.has("collection_date")} type="date" onChange={e => upd("collection_date", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Section: Tests Ordered */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: MV.warning }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: MV.text, margin: 0 }}>Tests Ordered</h3>
                  </div>
                  <div style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}`, borderRadius: 8, padding: 20 }}>
                    {tests.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                        {tests.map((t, i) => (
                          <div key={t.code} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", borderRadius: 6,
                            backgroundColor: MV.tealLight, border: `1px solid rgba(126, 190, 197, 0.3)`,
                          }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: MV.text }}>{t.name}</div>
                              <div style={{ fontSize: 12, color: MV.tealDark, fontFamily: "monospace", marginTop: 2 }}>{t.code}</div>
                            </div>
                            <button onClick={() => setTests(ts => ts.filter((_, j) => j !== i))} style={{
                              background: "none", border: `1px solid rgba(126, 190, 197, 0.4)`, borderRadius: 4,
                              color: MV.tealDark, cursor: "pointer", padding: "2px 8px", fontSize: 16, fontFamily: font,
                            }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ position: "relative" }}>
                      <input placeholder="Search compendium to add tests..." value={search}
                        onChange={e => { setSearch(e.target.value); setShowPicker(true); }}
                        onFocus={() => setShowPicker(true)}
                        onBlur={() => setTimeout(() => setShowPicker(false), 200)}
                        style={{
                          width: "100%", padding: "10px 12px", fontSize: 14, fontFamily: font,
                          border: `1.5px solid ${MV.gray200}`, borderRadius: 5, outline: "none", color: MV.text,
                        }}
                      />
                      {showPicker && filtTests.length > 0 && (
                        <div style={{
                          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
                          backgroundColor: MV.white, borderRadius: 6, border: `1px solid ${MV.gray200}`,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 240, overflow: "auto",
                        }}>
                          {filtTests.slice(0, 8).map(t => (
                            <button key={t.code} onMouseDown={() => { setTests(ts => [...ts, { name: t.name, code: t.code }]); setSearch(""); }}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                                padding: "10px 14px", border: "none", borderBottom: `1px solid ${MV.gray100}`,
                                backgroundColor: "transparent", cursor: "pointer", textAlign: "left", fontFamily: font,
                              }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: MV.text }}>{t.name}</div>
                                <div style={{ fontSize: 11, color: MV.textMuted, marginTop: 2 }}>
                                  <span style={{ fontFamily: "monospace", color: MV.tealDark }}>{t.code}</span>
                                  <span style={{ margin: "0 6px", color: MV.gray300 }}>|</span>
                                  {t.specimen}
                                </div>
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 600, color: MV.gray400, backgroundColor: MV.gray100, padding: "2px 6px", borderRadius: 3 }}>{t.type}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section: Clinical Notes */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: MV.gray400 }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: MV.text, margin: 0 }}>Clinical Notes</h3>
                    {confs.clinical_notes && <ConfBadge c={confs.clinical_notes} />}
                  </div>
                  <textarea value={fields.clinical_notes} onChange={e => upd("clinical_notes", e.target.value)} rows={3}
                    style={{
                      width: "100%", padding: "12px 14px", fontSize: 14, fontFamily: font,
                      border: `1.5px solid ${confs.clinical_notes && confs.clinical_notes < 0.8 ? MV.warningBorder : MV.gray200}`,
                      borderRadius: 8, outline: "none", color: MV.text, resize: "vertical", lineHeight: 1.5,
                      backgroundColor: confs.clinical_notes && confs.clinical_notes < 0.8 ? MV.warningLight : MV.white,
                    }}
                  />
                </div>

                {/* ── Submit Bar ── */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", borderRadius: 8, backgroundColor: MV.white,
                  border: `1px solid ${MV.gray200}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}>
                  <button onClick={reset} style={{
                    padding: "10px 20px", borderRadius: 6, border: `1px solid ${MV.gray200}`,
                    backgroundColor: MV.white, color: MV.textMuted, cursor: "pointer",
                    fontSize: 14, fontWeight: 600, fontFamily: font,
                  }}>Clear Form</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {gates.duplicate === "warn" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: MV.warning, fontWeight: 500 }}>
                        <span>⚠</span> Possible duplicate — supervisor override required
                      </div>
                    )}
                    <button style={{
                      padding: "10px 32px", borderRadius: 6, border: "none", cursor: "pointer",
                      fontSize: 15, fontWeight: 700, fontFamily: font,
                      background: MV.greenGrad, color: "#fff",
                      boxShadow: "0 2px 10px rgba(40, 111, 31, 0.3)",
                    }}>Submit Accession</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ Queue Screen ═══ */}
        {tab === "queue" && (
          <div style={{ flex: 1, padding: "24px 36px", backgroundColor: MV.offWhite, overflow: "auto" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Today's Accessions</h2>
                <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                  <span style={{ color: MV.textMuted }}>Total: <strong style={{ color: MV.text }}>{QUEUE_DATA.length}</strong></span>
                  <span style={{ color: MV.textMuted }}>Submitted: <strong style={{ color: MV.success }}>{QUEUE_DATA.filter(q => q.status === "submitted").length}</strong></span>
                  <span style={{ color: MV.textMuted }}>Pending: <strong style={{ color: MV.warning }}>{QUEUE_DATA.filter(q => q.status === "pending").length}</strong></span>
                  <span style={{ color: MV.textMuted }}>Queued: <strong style={{ color: MV.tealDark }}>{QUEUE_DATA.filter(q => q.status === "queued").length}</strong></span>
                </div>
              </div>
              <div style={{ backgroundColor: MV.white, borderRadius: 8, border: `1px solid ${MV.gray200}`, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ backgroundColor: MV.gray50, borderBottom: `2px solid ${MV.gray200}` }}>
                      {["Accession ID", "Patient", "Species", "Owner", "Tests", "Status", "Time", "Stn"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: MV.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {QUEUE_DATA.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${MV.gray100}`, backgroundColor: i % 2 === 0 ? MV.white : MV.gray50 }}>
                        <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 13, color: MV.green2, fontWeight: 600 }}>{r.id}</td>
                        <td style={{ padding: "12px 14px", fontWeight: 500 }}>{r.patient}</td>
                        <td style={{ padding: "12px 14px", color: MV.textMuted }}>{r.species}</td>
                        <td style={{ padding: "12px 14px", color: MV.textMuted }}>{r.owner}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, fontFamily: "monospace", color: MV.tealDark }}>{r.tests}</td>
                        <td style={{ padding: "12px 14px" }}><StatusBadge status={r.status} /></td>
                        <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 13, color: MV.textMuted }}>{r.time}</td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: MV.textMuted, fontWeight: 600 }}>{r.station}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
