/**
 * AccessionForm — Right panel form with sectioned layout,
 * per-field confidence badges, and compendium test picker.
 */
import { MV } from "../theme";
import Field from "./Field";
import TestPicker from "./TestPicker";
import CustomerAutocomplete from "./CustomerAutocomplete";

function Section({ color, title, children }) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-1 h-[18px] rounded-sm" style={{ background: color }} />
        <h3 className="text-[15px] font-bold m-0" style={{ color: MV.text }}>{title}</h3>
      </div>
      <div className="rounded-lg p-5" style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}` }}>
        {children}
      </div>
    </div>
  );
}

export default function AccessionForm({
  form,
  confidences,
  editedFields,
  onUpdateSection,
  onUpdateForm,
  onValidate,
  onSubmit,
  onReset,
  validation,
  loading,
  submitReady,
  submitResult,
  gateWarning,
}) {
  const upd = (section, key) => (e) => {
    onUpdateSection(section, { [key]: e.target.value });
  };

  const conf = (key) => confidences?.[key];
  const isEdited = (key) => editedFields?.has?.(key);

  return (
    <div className="flex-1 overflow-auto px-9 py-6 pb-16" style={{ backgroundColor: MV.offWhite }}>
      <div className="max-w-[900px] mx-auto">

        {/* Patient & Owner */}
        <Section color={MV.greenGrad} title="Patient & Owner Information">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Patient / Pet Name" value={form.patient.name} confidence={conf("patient_name")} edited={isEdited("patient_name")} required onChange={upd("patient", "name")} />
            <Field label="Species" value={form.patient.species} confidence={conf("species")} edited={isEdited("species")} required onChange={upd("patient", "species")} placeholder="Canine, Feline..." />
            <Field label="Breed" value={form.patient.breed} confidence={conf("breed")} edited={isEdited("breed")} onChange={upd("patient", "breed")} />
            <Field label="Owner Name" value={form.patient.owner_name} confidence={conf("owner_name")} edited={isEdited("owner_name")} required onChange={upd("patient", "owner_name")} />
            <Field label="Date of Birth" value={form.patient.dob} confidence={conf("dob")} edited={isEdited("dob")} onChange={upd("patient", "dob")} placeholder="MM/DD/YYYY" />
            <Field label="MRN / Specimen ID" value={form.patient.mrn} confidence={conf("mrn")} edited={isEdited("mrn")} onChange={upd("patient", "mrn")} />
          </div>
        </Section>

        {/* Ordering Info */}
        <Section color={MV.teal} title="Ordering Information">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <CustomerAutocomplete
                value={form.ordering.customer_id}
                facilityCode={form.ordering.facility_code}
                onSelect={(customer) =>
                  onUpdateSection("ordering", {
                    customer_id: customer.customer_id,
                    facility_code: customer.facility_code,
                  })
                }
              />
            </div>
            <Field label="Ordering Physician / Veterinarian" value={form.ordering.physician} confidence={conf("physician")} edited={isEdited("physician")} required onChange={upd("ordering", "physician")} />
            <Field label="NPI" value={form.ordering.npi} confidence={conf("npi")} edited={isEdited("npi")} onChange={upd("ordering", "npi")} placeholder="10-digit NPI" />
          </div>
        </Section>

        {/* Specimen */}
        <Section color={MV.blue} title="Specimen Details">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Specimen Type" value={form.specimen.type} confidence={conf("specimen_type")} edited={isEdited("specimen_type")} required onChange={upd("specimen", "type")} placeholder="Serum, Urine, BAL..." />
            <Field label="Collection Date" value={form.specimen.collection_date} confidence={conf("collection_date")} edited={isEdited("collection_date")} onChange={upd("specimen", "collection_date")} />
            <Field label="Tracking Number" value={form.specimen.tracking_number} edited={isEdited("tracking_number")} onChange={upd("specimen", "tracking_number")} />
          </div>
        </Section>

        {/* Tests Ordered */}
        <Section color={MV.warning} title="Tests Ordered">
          <TestPicker
            tests={form.tests}
            onAdd={(test) => onUpdateForm({ tests: [...form.tests, test] })}
            onRemove={(i) => onUpdateForm({ tests: form.tests.filter((_, j) => j !== i) })}
          />
        </Section>

        {/* Clinical Notes */}
        <div className="mb-7">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-[18px] rounded-sm" style={{ backgroundColor: MV.gray400 }} />
            <h3 className="text-[15px] font-bold m-0" style={{ color: MV.text }}>Clinical Notes</h3>
          </div>
          <textarea
            value={form.diagnosis_codes?.join(", ") || ""}
            onChange={(e) => onUpdateForm({ diagnosis_codes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            rows={3}
            placeholder="ICD-10 codes, clinical notes..."
            className="w-full px-3.5 py-3 text-sm rounded-lg outline-none resize-y leading-relaxed"
            style={{
              border: `1.5px solid ${MV.gray200}`,
              color: MV.text,
              backgroundColor: MV.white,
            }}
          />
        </div>

        {/* Validation errors */}
        {validation && !validation.valid && (
          <div className="mb-6 rounded-lg p-4" style={{ backgroundColor: MV.dangerLight, border: `1px solid ${MV.dangerBorder}` }}>
            <div className="text-sm font-semibold mb-2" style={{ color: MV.danger }}>Validation Errors</div>
            {validation.errors?.map((e, i) => (
              <div key={i} className="text-sm" style={{ color: MV.danger }}>
                <span className="font-mono text-xs">{e.field}</span>: {e.message}
              </div>
            ))}
          </div>
        )}

        {/* Submit result */}
        {submitResult && (
          <div className="mb-6 rounded-lg p-4" style={{ backgroundColor: MV.successLight, border: `1px solid ${MV.successBorder}` }}>
            <div className="text-base font-semibold" style={{ color: MV.success }}>
              Accession {submitResult.status === "submitted" ? "Submitted" : "Queued"}
            </div>
            {submitResult.accession_id && (
              <div className="font-mono text-sm mt-1" style={{ color: MV.success }}>{submitResult.accession_id}</div>
            )}
          </div>
        )}

        {/* Submit Bar */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-lg"
          style={{
            backgroundColor: MV.white,
            border: `1px solid ${MV.gray200}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <button
            onClick={onReset}
            className="px-5 py-2.5 rounded-md text-sm font-semibold cursor-pointer"
            style={{
              backgroundColor: MV.white,
              color: MV.textMuted,
              border: `1px solid ${MV.gray200}`,
            }}
          >
            Clear Form
          </button>
          <div className="flex items-center gap-3.5">
            {gateWarning && (
              <div className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: MV.warning }}>
                {"\u26A0"} {gateWarning}
              </div>
            )}
            <button
              onClick={submitReady ? onSubmit : onValidate}
              disabled={loading}
              className="px-8 py-2.5 rounded-md border-none cursor-pointer text-[15px] font-bold disabled:opacity-50"
              style={{
                background: MV.greenGrad,
                color: "#fff",
                boxShadow: "0 2px 10px rgba(40, 111, 31, 0.3)",
              }}
            >
              {loading ? "Processing..." : submitReady ? "Submit Accession" : "Validate & Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
