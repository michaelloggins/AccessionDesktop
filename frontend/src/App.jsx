/**
 * App — Root component for the MVD Accessioning Workstation.
 *
 * Manages the workflow steps: scan → review → validate → submit → done
 */

import useAccession from "./hooks/useAccession";
import ScanUpload from "./components/ScanUpload";
import AccessionForm from "./components/AccessionForm";
import GateStatus from "./components/GateStatus";
import ValidationDisplay from "./components/ValidationDisplay";

const STEP_LABELS = {
  scan: "1. Scan / Upload",
  review: "2. Review & Edit",
  validate: "3. Validate",
  submit: "4. Submit",
  done: "5. Complete",
};

export default function App() {
  const {
    step,
    extraction,
    gateResults,
    form,
    validation,
    submitResult,
    loading,
    error,
    uploadAndExtract,
    runGateCheck,
    validate,
    submit,
    updateForm,
    updateFormSection,
    reset,
  } = useAccession();

  const handleOverride = (gateId, supervisorId, reason) => {
    // In a full implementation, this would update the gate result with override info
    console.log("Override:", gateId, supervisorId, reason);
  };

  return (
    <div className="mx-auto min-h-screen max-w-4xl p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          MiraVista Diagnostics
        </h1>
        <p className="text-sm text-gray-500">Accessioning Workstation</p>
      </header>

      {/* Step indicator */}
      <nav className="mb-8 flex gap-2">
        {Object.entries(STEP_LABELS).map(([key, label]) => (
          <div
            key={key}
            className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium ${
              step === key
                ? "bg-blue-600 text-white"
                : Object.keys(STEP_LABELS).indexOf(key) <
                    Object.keys(STEP_LABELS).indexOf(step)
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {label}
          </div>
        ))}
      </nav>

      {/* Error display */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Gate results (shown when available) */}
      <GateStatus gateResults={gateResults} onOverride={handleOverride} />

      {/* Step content */}
      <div className="mt-6">
        {step === "scan" && (
          <ScanUpload onUpload={uploadAndExtract} loading={loading} />
        )}

        {(step === "review" || step === "validate") && (
          <>
            <AccessionForm
              form={form}
              extraction={extraction}
              onUpdateSection={updateFormSection}
              onUpdateForm={updateForm}
              onValidate={async () => {
                await runGateCheck("before_submit");
                await validate();
              }}
              loading={loading}
            />
            {step === "validate" && (
              <div className="mt-6">
                <ValidationDisplay
                  validation={validation}
                  onBack={() => {}} // Stays on form with errors shown
                />
              </div>
            )}
          </>
        )}

        {step === "submit" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Validation passed. Ready to submit.
            </div>
            <button
              onClick={submit}
              disabled={loading}
              className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Accession"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <p className="text-lg font-semibold text-green-800">
                Accession {submitResult?.status === "submitted" ? "Submitted" : "Queued"}
              </p>
              {submitResult?.accession_id && (
                <p className="mt-1 font-mono text-sm text-green-600">
                  {submitResult.accession_id}
                </p>
              )}
              {submitResult?.queue_id && (
                <p className="mt-1 text-sm text-yellow-600">
                  Queued offline: {submitResult.queue_id}
                </p>
              )}
            </div>
            <button
              onClick={reset}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Next Specimen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
