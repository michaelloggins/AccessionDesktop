/**
 * ScanPanel — Left sidebar with scan/upload zone, document preview, and gate checks.
 *
 * Three states:
 *   1. Empty — drag/drop zone or scanner button
 *   2. Preview — uploaded PDF/image shown as reference for manual entry
 *   3. Processing — AI extraction spinner (when OCR is enabled)
 */
import { useState, useRef, useCallback } from "react";
import { MV } from "../theme";
import GateChip from "./GateChip";
import ScannerSettings, { DEFAULT_SCANNER_SETTINGS } from "./ScannerSettings";

export default function ScanPanel({
  onUpload,
  onFileLoaded,
  onScanCapture,
  loading,
  scanComplete,
  previewUrl,
  previewType,
  gateResults,
  onOverride,
  onReset,
  ocrEnabled,
}) {
  const [mode, setMode] = useState("scan");
  const [collapsed, setCollapsed] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showScannerSettings, setShowScannerSettings] = useState(false);
  const [scannerSettings, setScannerSettings] = useState(DEFAULT_SCANNER_SETTINGS);
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
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    },
    [onUpload, onFileLoaded, ocrEnabled],
  );

  const handleFileChange = useCallback(
    (e) => {
      if (e.target.files?.[0]) handleFile(e.target.files[0]);
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [onUpload, onFileLoaded, ocrEnabled],
  );

  const handleFile = (file) => {
    // Always create a preview URL
    const url = URL.createObjectURL(file);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    onFileLoaded(url, isPdf ? "pdf" : "image", file);

    // If OCR is enabled, also send to extraction
    if (ocrEnabled) {
      onUpload(file);
    }
  };

  const handleModeSwitch = (m) => {
    setMode(m);
    onReset();
  };

  // Derive gate statuses
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

  const hasPreview = previewUrl != null;

  // Collapsed state — thin sidebar with expand button
  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center flex-shrink-0 py-3"
        style={{ width: 40, borderRight: `1px solid ${MV.gray200}`, backgroundColor: MV.white }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 rounded flex items-center justify-center cursor-pointer border-none text-sm"
          style={{ backgroundColor: MV.gray100, color: MV.gray500 }}
          title="Expand scan panel"
        >
          {"\u25B6"}
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ width: 420, borderRight: `1px solid ${MV.gray200}`, backgroundColor: MV.white }}
    >
      {/* Mode Toggle + Collapse button */}
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${MV.gray100}` }}>
        <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${MV.gray200}` }}>
          {[
            { id: "scan", icon: "\u2398", label: "Scan / Upload" },
            { id: "manual", icon: "\u270E", label: "Manual Entry" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeSwitch(m.id)}
              className="flex-1 py-2 text-[13px] font-semibold cursor-pointer border-none transition-all"
              style={{
                backgroundColor: mode === m.id ? MV.green2 : MV.white,
                color: mode === m.id ? "#fff" : MV.textMuted,
              }}
            >
              {m.icon}  {m.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="w-8 h-8 rounded flex items-center justify-center cursor-pointer border-none flex-shrink-0"
          style={{ backgroundColor: MV.gray100, color: MV.gray500 }}
          title="Collapse scan panel"
        >
          {"\u25C0"}
        </button>
      </div>

      {/* Document Preview / Upload Zone */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Preview area */}
        <div className="flex-1 relative overflow-hidden">
          {!hasPreview && !loading && (
            <div
              className="absolute inset-0 m-3 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              style={{
                border: `2px dashed ${dragActive ? MV.teal : MV.gray300}`,
                backgroundColor: MV.gray50,
              }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
                onChange={handleFileChange}
              />
              {mode === "scan" ? (
                <div className="text-center p-4">
                  <div className="text-5xl mb-2" style={{ color: MV.gray300 }}>{"\u2398"}</div>
                  <div className="text-[15px] font-semibold" style={{ color: MV.textMuted }}>
                    Upload requisition
                  </div>
                  <div className="text-[13px] mt-1" style={{ color: MV.gray400 }}>
                    Drag & drop PDF or image, or click to browse
                  </div>
                </div>
              ) : (
                <div className="text-center p-6">
                  <div className="text-5xl mb-2" style={{ color: MV.gray300 }}>{"\u270E"}</div>
                  <div className="text-[15px] font-semibold" style={{ color: MV.textMuted }}>
                    Manual Entry Mode
                  </div>
                  <div className="text-[13px] mt-1 leading-relaxed max-w-[260px]" style={{ color: MV.gray400 }}>
                    Fill the form manually, or upload a document for reference.
                  </div>
                </div>
              )}
            </div>
          )}

          {loading && !hasPreview && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div
                  className="w-9 h-9 rounded-full mx-auto mb-3 animate-spin"
                  style={{ border: `3px solid ${MV.gray200}`, borderTopColor: MV.teal }}
                />
                <div className="text-[15px] font-semibold" style={{ color: MV.tealDark }}>
                  AI Extracting Fields...
                </div>
              </div>
            </div>
          )}

          {hasPreview && (
            <div className="absolute inset-0 flex flex-col">
              {/* Document label */}
              <div
                className="flex items-center justify-between px-3 py-2 flex-shrink-0"
                style={{ backgroundColor: MV.gray50, borderBottom: `1px solid ${MV.gray200}` }}
              >
                <span className="text-[11px] font-bold uppercase" style={{ color: MV.textMuted, letterSpacing: "0.06em" }}>
                  Reference Document
                </span>
                <button
                  onClick={onReset}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer bg-transparent"
                  style={{ color: MV.danger, border: `1px solid ${MV.dangerBorder}` }}
                >
                  Clear
                </button>
              </div>
              {/* PDF or image render */}
              <div className="flex-1 overflow-auto bg-gray-100">
                {previewType === "pdf" ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-none"
                    title="Requisition preview"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Requisition scan"
                    className="w-full h-auto"
                  />
                )}
              </div>
              {loading && (
                <div
                  className="flex items-center justify-center gap-2 py-2 flex-shrink-0"
                  style={{ backgroundColor: MV.tealLight, borderTop: `1px solid ${MV.teal}` }}
                >
                  <div
                    className="w-4 h-4 rounded-full animate-spin"
                    style={{ border: `2px solid ${MV.gray200}`, borderTopColor: MV.teal }}
                  />
                  <span className="text-xs font-semibold" style={{ color: MV.tealDark }}>
                    AI extracting fields...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scan + Upload buttons (when no preview) */}
        {!hasPreview && mode === "scan" && (
          <div className="px-4 pb-3 flex flex-col gap-2 relative">
            {/* Scanner settings popout */}
            {showScannerSettings && (
              <ScannerSettings
                settings={scannerSettings}
                onChange={setScannerSettings}
                onClose={() => setShowScannerSettings(false)}
              />
            )}

            {/* Scan Requisition + Gear */}
            <div className="flex gap-1.5">
              <button
                disabled={loading}
                className="py-[9px] rounded-md border-none cursor-pointer text-[13px] font-bold flex-1 disabled:opacity-50"
                style={{ backgroundColor: MV.gray900, color: "#fff" }}
                onClick={() => {
                  if (onScanCapture) {
                    onScanCapture(scannerSettings);
                  } else {
                    alert("TWAIN scanner not connected. Use Upload instead.");
                  }
                }}
              >
                Scan Requisition
              </button>
              <button
                onClick={() => setShowScannerSettings(!showScannerSettings)}
                className="px-2.5 py-[9px] rounded-md cursor-pointer border-none"
                style={{
                  backgroundColor: showScannerSettings ? MV.teal : MV.gray700,
                  color: "#fff",
                }}
                title="Scanner settings"
              >
                {"\u2699"}
              </button>
            </div>

            {/* Upload Requisition */}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              className="py-[9px] rounded-md border-none cursor-pointer text-[13px] font-bold w-full disabled:opacity-50"
              style={{
                background: MV.greenGrad,
                color: "#fff",
                boxShadow: "0 2px 8px rgba(40, 111, 31, 0.25)",
              }}
            >
              Upload Requisition
            </button>
          </div>
        )}

        {/* Replace button (when preview showing) */}
        {hasPreview && (
          <div className="px-4 py-2" style={{ borderTop: `1px solid ${MV.gray100}` }}>
            <button
              onClick={() => inputRef.current?.click()}
              className="py-2 rounded-md text-xs font-semibold w-full cursor-pointer"
              style={{
                backgroundColor: MV.white,
                color: MV.textMuted,
                border: `1px solid ${MV.gray200}`,
              }}
            >
              Replace Document
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>

      {/* Gate Checks */}
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${MV.gray100}` }}>
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
