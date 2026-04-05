/**
 * ScanPanel — Left sidebar with scan/upload zone, mode toggle, and gate checks.
 */
import { useState, useRef, useCallback } from "react";
import { MV } from "../theme";
import GateChip from "./GateChip";

export default function ScanPanel({
  onUpload,
  loading,
  scanComplete,
  gateResults,
  onOverride,
  onReset,
}) {
  const [mode, setMode] = useState("scan");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) onUpload(e.dataTransfer.files[0]);
    },
    [onUpload],
  );

  const handleFileChange = useCallback(
    (e) => {
      if (e.target.files?.[0]) onUpload(e.target.files[0]);
    },
    [onUpload],
  );

  const handleModeSwitch = (m) => {
    setMode(m);
    onReset();
  };

  // Derive gate statuses from results
  const gates = [];
  if (gateResults && Object.keys(gateResults).length > 0) {
    Object.entries(gateResults).forEach(([id, gate]) => {
      gates.push({ id, label: gate.gate_id || id, status: gate.result || "pending" });
    });
  } else {
    gates.push(
      { id: "specimen", label: "Fulcrum Specimen Check", status: "pending" },
      { id: "compendium", label: "Compendium Validation", status: "pending" },
    );
  }

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ width: 380, borderRight: `1px solid ${MV.gray200}`, backgroundColor: MV.white }}
    >
      {/* Mode Toggle */}
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${MV.gray100}` }}>
        <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${MV.gray200}` }}>
          {[
            { id: "scan", icon: "\u2398", label: "Scan Requisition" },
            { id: "manual", icon: "\u270E", label: "Manual Entry" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeSwitch(m.id)}
              className="flex-1 py-2.5 text-[13px] font-semibold cursor-pointer border-none transition-all"
              style={{
                backgroundColor: mode === m.id ? MV.green2 : MV.white,
                color: mode === m.id ? "#fff" : MV.textMuted,
              }}
            >
              {m.icon}  {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scan / Upload Zone */}
      <div className="flex-1 p-5 flex flex-col gap-4">
        <div
          className="flex-1 rounded-lg flex items-center justify-center relative overflow-hidden transition-colors"
          style={{
            border: `2px dashed ${dragActive ? MV.teal : scanComplete ? MV.teal : MV.gray300}`,
            backgroundColor: MV.gray50,
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !loading && !scanComplete && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
            onChange={handleFileChange}
          />

          {!loading && !scanComplete && mode === "scan" && (
            <div className="text-center cursor-pointer">
              <div className="text-5xl mb-2" style={{ color: MV.gray300 }}>{"\u2398"}</div>
              <div className="text-[15px] font-semibold" style={{ color: MV.textMuted }}>
                Place requisition on scanner
              </div>
              <div className="text-[13px] mt-1" style={{ color: MV.gray400 }}>
                or drag and drop an image file here
              </div>
            </div>
          )}

          {!loading && !scanComplete && mode === "manual" && (
            <div className="text-center p-6">
              <div className="text-5xl mb-2" style={{ color: MV.gray300 }}>{"\u270E"}</div>
              <div className="text-[15px] font-semibold" style={{ color: MV.textMuted }}>
                Manual Entry Mode
              </div>
              <div className="text-[13px] mt-1 leading-relaxed max-w-[260px]" style={{ color: MV.gray400 }}>
                Enter all required fields manually. Use when requisition forms are unavailable.
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center">
              <div
                className="w-9 h-9 rounded-full mx-auto mb-3 animate-spin"
                style={{
                  border: `3px solid ${MV.gray200}`,
                  borderTopColor: MV.teal,
                }}
              />
              <div className="text-[15px] font-semibold" style={{ color: MV.tealDark }}>
                AI Extracting Fields...
              </div>
              <div className="text-xs mt-1" style={{ color: MV.textMuted }}>
                PaddleOCR-VL processing
              </div>
            </div>
          )}

          {scanComplete && !loading && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div
                className="w-[70%] rounded bg-white flex flex-col p-4 gap-2"
                style={{
                  aspectRatio: "8.5/11",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
                  border: `1px solid ${MV.gray200}`,
                }}
              >
                <div className="h-2.5 w-[55%] rounded-sm" style={{ backgroundColor: MV.gray200 }} />
                <div className="h-[7px] w-[75%] rounded-sm" style={{ backgroundColor: MV.gray100 }} />
                <div className="h-[7px] w-[40%] rounded-sm" style={{ backgroundColor: MV.gray100 }} />
                <div className="flex-1" />
                <div className="h-[7px] w-[65%] rounded-sm" style={{ backgroundColor: MV.gray100 }} />
              </div>
              <div className="mt-2.5 text-[13px] font-semibold flex items-center gap-1" style={{ color: MV.success }}>
                {"\u2713"} Scan captured — fields extracted
              </div>
            </div>
          )}
        </div>

        {mode === "scan" && (
          <button
            onClick={scanComplete ? onReset : () => inputRef.current?.click()}
            disabled={loading}
            className="py-[11px] rounded-md border-none cursor-pointer text-sm font-bold w-full disabled:opacity-50"
            style={{
              background: scanComplete ? MV.white : MV.greenGrad,
              color: scanComplete ? MV.textMuted : "#fff",
              border: scanComplete ? `1px solid ${MV.gray200}` : "none",
              boxShadow: scanComplete ? "none" : "0 2px 8px rgba(40, 111, 31, 0.25)",
            }}
          >
            {loading ? "Processing..." : scanComplete ? "Clear & Rescan" : "Upload Requisition"}
          </button>
        )}
      </div>

      {/* Gate Checks */}
      <div className="px-5 py-4" style={{ borderTop: `1px solid ${MV.gray100}` }}>
        <div
          className="text-[11px] font-bold mb-2 uppercase"
          style={{ color: MV.textMuted, letterSpacing: "0.06em" }}
        >
          Pre-Submit Gate Checks
        </div>
        <div className="flex flex-col gap-1.5">
          {gates.map((g) => (
            <GateChip
              key={g.id}
              status={g.status}
              label={g.label}
              onClick={g.status === "warn" ? () => onOverride?.(g.id) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
