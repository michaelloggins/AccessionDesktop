/**
 * App — Root component for the MVD Accessioning Workstation.
 *
 * Two-panel layout: scan/upload panel on the left, form on the right.
 * Tab bar switches between "New Accession" and "Today's Queue".
 *
 * Integrates Dynamsoft Web TWAIN for scanner access via scannerService.
 */
import { useState, useEffect, useCallback } from "react";
import { MV } from "./theme";
import useAccession from "./hooks/useAccession";
import ScanPanel from "./components/ScanPanel";
import AccessionForm from "./components/AccessionForm";
import { ScannerConfig, LabelPrinterConfig, LaserPrinterConfig, DEFAULT_SCANNER_CONFIG, DEFAULT_LABEL_CONFIG, DEFAULT_LASER_CONFIG } from "./components/DeviceConfig";
import DeviceChip from "./components/DeviceChip";
import QueueView from "./components/QueueView";
import { scannerService } from "./services/scanner";

export default function App() {
  const [tab, setTab] = useState("accession");

  const {
    step,
    extraction,
    gateResults,
    form,
    validation,
    submitResult,
    loading,
    error,
    orderType,
    manifestMode,
    manifestIndex,
    setOrderType,
    setManifestMode,
    uploadAndExtract,
    runGateCheck,
    validate,
    submit,
    updateForm,
    updateFormSection,
    nextManifestOrder,
    reset,
    fullReset,
  } = useAccession();

  // Station and device state
  const [stationId, setStationId] = useState("ScanStation-1");
  const [scannerStatus, setScannerStatus] = useState("offline");
  const [labelPrinterStatus, setLabelPrinterStatus] = useState("offline");
  const [laserPrinterStatus, setLaserPrinterStatus] = useState("offline");
  const [scannerConfig, setScannerConfig] = useState(DEFAULT_SCANNER_CONFIG);
  const [labelConfig, setLabelConfig] = useState(DEFAULT_LABEL_CONFIG);
  const [laserConfig, setLaserConfig] = useState(DEFAULT_LASER_CONFIG);
  const [openConfig, setOpenConfig] = useState(null); // "scanner" | "label" | "laser" | "user" | null

  // Document preview state
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [ocrEnabled, setOcrEnabled] = useState(false);

  // TWAIN scanner state
  const [scannerSources, setScannerSources] = useState([]);
  const [scanError, setScanError] = useState(null);

  // Manifest orders list
  const [manifestOrders, setManifestOrders] = useState([]);

  // Track which fields the operator has manually edited
  const [editedFields, setEditedFields] = useState(new Set());

  // ─── Initialize Dynamsoft Web TWAIN ───
  useEffect(() => {
    let destroyed = false;

    // Register status callback before init
    scannerService.onStatusChange((status) => {
      if (!destroyed) {
        setScannerStatus(status);
      }
    });

    scannerService.init().then((dwt) => {
      if (destroyed) return;
      if (dwt) {
        // Enumerate available TWAIN scanners
        const sources = scannerService.getSourceNames();
        setScannerSources(sources);
        console.log("[App] Available TWAIN scanners:", sources);

        // Auto-select Ricoh fi-8701 if present
        const ricoh = sources.find((s) => s.toLowerCase().includes("fi-8701"));
        if (ricoh) {
          console.log("[App] Auto-selected scanner:", ricoh);
        }
      }
    });

    return () => {
      destroyed = true;
      scannerService.destroy();
    };
  }, []);

  // Build confidence map from extraction
  const confidences = {};
  if (extraction) {
    const conf = extraction.confidence || 0;
    // Apply overall confidence to all extracted fields
    if (extraction.patient?.name) confidences.patient_name = conf;
    if (extraction.patient?.species) confidences.species = conf;
    if (extraction.patient?.breed) confidences.breed = conf;
    if (extraction.patient?.owner_name) confidences.owner_name = conf;
    if (extraction.patient?.dob) confidences.dob = conf;
    if (extraction.patient?.mrn) confidences.mrn = conf;
    if (extraction.ordering?.physician) confidences.physician = conf;
    if (extraction.ordering?.npi) confidences.npi = conf;
    if (extraction.specimen?.type) confidences.specimen_type = conf;
    if (extraction.specimen?.collection_date) confidences.collection_date = conf;
  }

  // Wrap updateFormSection to track edits
  const handleUpdateSection = (section, updates) => {
    Object.keys(updates).forEach((k) => {
      setEditedFields((prev) => new Set([...prev, k]));
    });
    updateFormSection(section, updates);
  };

  const handleFileLoaded = (url, type, file) => {
    // Revoke previous preview URL to avoid memory leaks
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setPreviewType(type);
  };

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewType(null);
    setScanError(null);
    reset();
    setEditedFields(new Set());
    setManifestOrders([]);
    scannerService.clearBuffer();
  };

  /**
   * Handle TWAIN scan capture.
   * Called from ScanPanel when "Scan Requisition" is clicked.
   * Acquires image(s) from the scanner, displays preview, and optionally sends to OCR.
   */
  const handleScanCapture = useCallback(async (settings) => {
    setScanError(null);

    if (!scannerService.isReady()) {
      setScanError("Scanner not available. Ensure Dynamsoft Service is running and refresh the page.");
      return;
    }

    try {
      const result = await scannerService.scan(settings);

      if (result.pageCount === 0) {
        setScanError("No pages scanned. Check that paper is loaded in the scanner.");
        return;
      }

      // Use the first scanned image as preview
      const firstBlob = result.images[0];
      if (firstBlob) {
        const url = URL.createObjectURL(firstBlob);
        handleFileLoaded(url, "image");

        // If OCR is enabled, send the scanned image to the extraction endpoint
        if (ocrEnabled) {
          // Create a File object from the blob for the upload API
          const file = new File([firstBlob], "scanned-requisition.png", { type: "image/png" });
          uploadAndExtract(file);
        }
      }

      // If multiple pages were scanned, log it (future: multi-page support)
      if (result.pageCount > 1) {
        console.log(`[App] ${result.pageCount} pages scanned. Showing first page as preview.`);
      }
    } catch (err) {
      console.error("[App] Scan capture failed:", err);
      setScanError(err.message || "Scan failed. Check scanner connection.");
    }
  }, [ocrEnabled, previewUrl, uploadAndExtract]);

  const handleValidateAndSubmit = async () => {
    await runGateCheck("before_submit");
    const result = await validate();
    if (result?.valid) {
      await submit();
    }
  };

  const scanComplete = step === "review" || step === "validate" || step === "submit" || step === "done";
  const submitReady = step === "submit";

  // Close config popout when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (openConfig && !e.target.closest("[data-config-popout]")) {
        // Don't close if clicking inside a popout
      }
    };
    // Simple: just close on escape
    const escHandler = (e) => { if (e.key === "Escape") setOpenConfig(null); };
    document.addEventListener("keydown", escHandler);
    return () => document.removeEventListener("keydown", escHandler);
  }, [openConfig]);

  // Load Roboto Condensed font
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ fontFamily: "'Roboto Condensed', Helvetica, Arial, sans-serif", color: MV.text, backgroundColor: MV.offWhite }}
    >
      {/* Header */}
      <header
        className="h-[52px] flex items-center justify-between px-6 flex-shrink-0"
        style={{ background: MV.greenGrad }}
      >
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="13" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
              <text x="14" y="18" textAnchor="middle" fill="white" fontSize="14" fontWeight="700">M</text>
            </svg>
            <div>
              <div className="text-base font-bold text-white leading-none tracking-tight">MiraVista Diagnostics</div>
              <div className="text-[10px] font-medium uppercase text-white/70" style={{ letterSpacing: "0.08em" }}>
                Accessioning Workstation
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Station selector + gear */}
          <DeviceChip
            label={`Station ${stationId.split("-")[1] || "1"}`}
            isSelect
            selectValue={stationId}
            selectOptions={[1,2,3,4,5,6].map(n => ({ value: `ScanStation-${n}`, label: `Station ${n}` }))}
            onSelectChange={setStationId}
          />

          <div className="w-px h-5 bg-white/20" />

          {/* Scanner + gear */}
          <div className="relative">
            <DeviceChip
              status={scannerStatus}
              label="Scanner"
              onGearClick={() => setOpenConfig(openConfig === "scanner" ? null : "scanner")}
            />
            {openConfig === "scanner" && (
              <ScannerConfig config={scannerConfig} onChange={setScannerConfig} onClose={() => setOpenConfig(null)} />
            )}
          </div>

          {/* Label Printer + gear */}
          <div className="relative">
            <DeviceChip
              status={labelPrinterStatus}
              label="Label"
              onGearClick={() => setOpenConfig(openConfig === "label" ? null : "label")}
            />
            {openConfig === "label" && (
              <LabelPrinterConfig config={labelConfig} onChange={setLabelConfig} onClose={() => setOpenConfig(null)} />
            )}
          </div>

          {/* Laser Printer + gear */}
          <div className="relative">
            <DeviceChip
              status={laserPrinterStatus}
              label="Laser"
              onGearClick={() => setOpenConfig(openConfig === "laser" ? null : "laser")}
            />
            {openConfig === "laser" && (
              <LaserPrinterConfig config={laserConfig} onChange={setLaserConfig} onClose={() => setOpenConfig(null)} />
            )}
          </div>

          <div className="w-px h-5 bg-white/20" />

          {/* User avatar */}
          <div className="relative">
            <button
              onClick={() => setOpenConfig(openConfig === "user" ? null : "user")}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none text-xs font-bold"
              style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}
              title="User menu"
            >
              ML
            </button>
            {openConfig === "user" && (
              <div
                className="absolute top-full mt-1 right-0 z-50 rounded-lg w-48 overflow-hidden"
                style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}`, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
              >
                <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${MV.gray100}` }}>
                  <div className="text-sm font-semibold" style={{ color: MV.text }}>M. Loggins</div>
                  <div className="text-[11px]" style={{ color: MV.textMuted }}>mloggins@miravistalabs.com</div>
                </div>
                <button
                  className="w-full px-3 py-2 text-left text-xs font-semibold cursor-pointer bg-transparent border-none hover:bg-gray-50"
                  style={{ color: MV.danger }}
                  onClick={() => alert("Logout")}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div
        className="flex gap-0 px-6 flex-shrink-0"
        style={{ backgroundColor: MV.white, borderBottom: `1px solid ${MV.gray200}` }}
      >
        {[
          { id: "accession", label: "New Accession" },
          { id: "queue", label: "Today's Queue" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-5 py-3 text-sm font-semibold cursor-pointer bg-transparent border-none transition-all"
            style={{
              borderBottom: `3px solid ${tab === t.id ? MV.green1 : "transparent"}`,
              color: tab === t.id ? MV.green2 : MV.textMuted,
            }}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />

        {/* Error display */}
        {error && (
          <div className="flex items-center text-xs px-3 py-1 rounded" style={{ color: MV.danger, backgroundColor: MV.dangerLight }}>
            {error}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden min-w-0">
        {tab === "accession" && (
          <>
            <ScanPanel
              onUpload={uploadAndExtract}
              onFileLoaded={handleFileLoaded}
              onScanCapture={scannerService.isReady() ? handleScanCapture : null}
              loading={loading}
              scanComplete={scanComplete}
              previewUrl={previewUrl}
              previewType={previewType}
              gateResults={gateResults}
              onReset={handleReset}
              ocrEnabled={ocrEnabled}
              scannerReady={scannerService.isReady()}
              scannerSources={scannerSources}
              scanError={scanError}
            />
            <AccessionForm
              form={form}
              orderType={orderType}
              manifestMode={manifestMode}
              manifestIndex={manifestIndex}
              confidences={confidences}
              editedFields={editedFields}
              onUpdateSection={handleUpdateSection}
              onUpdateForm={updateForm}
              onSetOrderType={setOrderType}
              onSetManifestMode={setManifestMode}
              onValidate={handleValidateAndSubmit}
              onSubmit={submit}
              onReset={handleReset}
              onNextManifestOrder={nextManifestOrder}
              validation={validation}
              loading={loading}
              submitReady={submitReady}
              submitResult={submitResult}
              manifestOrders={manifestOrders}
              onManifestOrdersChange={setManifestOrders}
            />
          </>
        )}
        {tab === "queue" && <QueueView />}
      </div>
    </div>
  );
}
