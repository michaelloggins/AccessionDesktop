/**
 * App — Root component for the MVD Accessioning Workstation.
 *
 * Two-panel layout: scan/upload panel on the left, form on the right.
 * Tab bar switches between "New Accession" and "Today's Queue".
 */
import { useState, useEffect } from "react";
import { MV } from "./theme";
import useAccession from "./hooks/useAccession";
import ScanPanel from "./components/ScanPanel";
import AccessionForm from "./components/AccessionForm";
import QueueView from "./components/QueueView";

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

  // Document preview state
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [ocrEnabled, setOcrEnabled] = useState(false); // Off by default — manual mode

  // Manifest orders list
  const [manifestOrders, setManifestOrders] = useState([]);

  // Track which fields the operator has manually edited
  const [editedFields, setEditedFields] = useState(new Set());

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
    reset();
    setEditedFields(new Set());
    setManifestOrders([]);
  };

  const handleValidateAndSubmit = async () => {
    await runGateCheck("before_submit");
    const result = await validate();
    if (result?.valid) {
      await submit();
    }
  };

  const scanComplete = step === "review" || step === "validate" || step === "submit" || step === "done";
  const submitReady = step === "submit";

  // Load Roboto Condensed font
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  return (
    <div
      className="flex flex-col min-h-screen"
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/15">
            <div className="w-[7px] h-[7px] rounded-full bg-green-400" />
            <span className="text-xs text-white font-medium">Online</span>
          </div>
          <div className="w-px h-5 bg-white/25" />
          <span className="text-[13px] text-white/85">Station DEV-01</span>
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
      <div className="flex flex-1 overflow-hidden">
        {tab === "accession" && (
          <>
            <ScanPanel
              onUpload={uploadAndExtract}
              onFileLoaded={handleFileLoaded}
              loading={loading}
              scanComplete={scanComplete}
              previewUrl={previewUrl}
              previewType={previewType}
              gateResults={gateResults}
              onReset={handleReset}
              ocrEnabled={ocrEnabled}
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
