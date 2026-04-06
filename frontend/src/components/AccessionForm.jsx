/**
 * AccessionForm — Right panel form with collapsible validated sections.
 *
 * Single mode: Ordering Facility → Patient → Tests → Shipping → Notes
 * Manifest mode: Ordering Facility → Orders table with inline add/edit
 */
import { useState } from "react";
import { MV } from "../theme";
import Field from "./Field";
import Select from "./Select";
import Section from "./Section";
import TestPicker from "./TestPicker";
import ManifestOrderForm from "./ManifestOrderForm";
import ManifestOrderTable from "./ManifestOrderTable";
import ManifestReview from "./ManifestReview";
import FacilityLookup from "./FacilityLookup";
import { COUNTRY_OPTIONS } from "../data/countries";
import { validateSpecimens, validateOrder } from "../services/specimenValidator";

const SPECIES_OPTIONS = [
  { value: "Canine", label: "Canine" },
  { value: "Feline", label: "Feline" },
  { value: "Equine", label: "Equine" },
  { value: "Avian", label: "Avian" },
  { value: "Other", label: "Other" },
];

const STORAGE_TEMP_OPTIONS = [
  { value: "Ambient", label: "Ambient" },
  { value: "Refrigerated", label: "Refrigerated" },
  { value: "Frozen", label: "Frozen" },
  { value: "Thawed", label: "Thawed" },
];
import useFormValidation from "../hooks/useFormValidation";

function ModeToggle({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold uppercase" style={{ color: MV.textMuted, letterSpacing: "0.04em" }}>
        {label}
      </span>
      <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${MV.gray200}` }}>
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="px-3 py-1.5 text-xs font-semibold cursor-pointer border-none transition-all"
            style={{
              backgroundColor: value === opt.id ? MV.green2 : MV.white,
              color: value === opt.id ? "#fff" : MV.textMuted,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AccessionForm({
  form,
  orderType,
  manifestMode,
  manifestIndex,
  confidences,
  editedFields,
  onUpdateSection,
  onUpdateForm,
  onSetOrderType,
  onSetManifestMode,
  onValidate,
  onSubmit,
  onReset,
  onNextManifestOrder,
  validation,
  loading,
  submitReady,
  submitResult,
  gateWarning,
  manifestOrders,
  onManifestOrdersChange,
}) {
  // Specimen validation errors (single order mode)
  const [specimenErrors, setSpecimenErrors] = useState([]);

  // Facility field mismatches from RASCLIENTS comparison
  const [facilityMismatches, setFacilityMismatches] = useState({});

  // Manifest state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrderIndex, setEditingOrderIndex] = useState(null);
  const [showManifestReview, setShowManifestReview] = useState(false);

  const orders = manifestOrders || [];

  const handleAddOrder = (order) => {
    if (editingOrderIndex !== null) {
      const updated = [...orders];
      updated[editingOrderIndex] = order;
      onManifestOrdersChange(updated);
      setEditingOrderIndex(null);
    } else {
      onManifestOrdersChange([...orders, order]);
    }
    setShowOrderForm(false);
  };

  const handleEditOrder = (index) => {
    setEditingOrderIndex(index);
    setShowOrderForm(true);
  };

  const handleDeleteOrder = (index) => {
    onManifestOrdersChange(orders.filter((_, i) => i !== index));
  };

  const handleCancelOrder = () => {
    setShowOrderForm(false);
    setEditingOrderIndex(null);
  };

  const upd = (section, key) => (e) => {
    onUpdateSection(section, { [key]: e.target.value });
  };

  const conf = (key) => confidences?.[key];
  const isEdited = (key) => editedFields?.has?.(key);
  const isVet = orderType === "veterinary";
  const isManifestShared = manifestMode && manifestIndex > 0;

  // Real-time section validation
  const sectionStatus = useFormValidation(form, orderType);

  return (
    <div className="flex-1 overflow-auto px-9 py-6 pb-16" style={{ backgroundColor: MV.offWhite }}>
      <div className="max-w-[900px] mx-auto">

        {/* Mode Toggles Bar */}
        <div
          className="flex items-center justify-between mb-6 px-5 py-3 rounded-lg"
          style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}` }}
        >
          <ModeToggle
            label="Order Type"
            options={[
              { id: "human", label: "Human" },
              { id: "veterinary", label: "Veterinary" },
            ]}
            value={orderType}
            onChange={onSetOrderType}
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={manifestMode}
                onChange={(e) => onSetManifestMode(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: MV.green2 }}
              />
              <span className="text-xs font-semibold uppercase" style={{ color: MV.textMuted, letterSpacing: "0.04em" }}>
                Multi-Order Manifest
              </span>
            </label>
            {manifestMode && (
              <span
                className="text-xs font-bold px-2 py-1 rounded"
                style={{ color: MV.green2, backgroundColor: MV.successLight, border: `1px solid ${MV.successBorder}` }}
              >
                Order #{manifestIndex + 1}
              </span>
            )}
          </div>
        </div>

        {/* === Section 1: Ordering Facility === */}
        <Section
          color={MV.teal}
          title="Ordering Facility"
          status={sectionStatus.facility.status}
          statusDetail={sectionStatus.facility.detail}
          locked={isManifestShared}
        >
          <div className="flex flex-col gap-4">
            {/* Facility Name + ID with autocomplete (Azure Maps + RASCLIENTS) */}
            <FacilityLookup form={form} onUpdateSection={onUpdateSection} onMismatchesChange={setFacilityMismatches} />
            {/* Address 2 (Address 1 is handled by FacilityLookup above) */}
            <Field label="Address 2" value={form.ordering.address2 || ""} edited={isEdited("address2")} onChange={upd("ordering", "address2")} mismatch={facilityMismatches.address2} onUseMismatch={facilityMismatches.address2 ? () => onUpdateSection("ordering", { address2: facilityMismatches.address2.expected }) : undefined} />
            {/* Row: City, State, Zip, Country */}
            <div className="grid grid-cols-4 gap-4">
              <Field label="City" value={form.ordering.city || ""} edited={isEdited("city")} onChange={upd("ordering", "city")} mismatch={facilityMismatches.city} onUseMismatch={facilityMismatches.city ? () => onUpdateSection("ordering", { city: facilityMismatches.city.expected }) : undefined} />
              <Field label="State" value={form.ordering.state || ""} edited={isEdited("state")} onChange={upd("ordering", "state")} mismatch={facilityMismatches.state} onUseMismatch={facilityMismatches.state ? () => onUpdateSection("ordering", { state: facilityMismatches.state.expected }) : undefined} />
              <Field label="Zip" value={form.ordering.zip || ""} edited={isEdited("zip")} onChange={upd("ordering", "zip")} mismatch={facilityMismatches.zip} onUseMismatch={facilityMismatches.zip ? () => onUpdateSection("ordering", { zip: facilityMismatches.zip.expected }) : undefined} />
              <Select label="Country" value={form.ordering.country || ""} options={COUNTRY_OPTIONS} onChange={upd("ordering", "country")} placeholder="Select..." />
            </div>
            {/* Row: Email, Phone, Fax */}
            <div className="grid grid-cols-3 gap-4">
              <Field label="Email" value={form.ordering.email || ""} edited={isEdited("email")} onChange={upd("ordering", "email")} mismatch={facilityMismatches.email} onUseMismatch={facilityMismatches.email ? () => onUpdateSection("ordering", { email: facilityMismatches.email.expected }) : undefined} />
              <Field label="Phone" value={form.ordering.phone || ""} edited={isEdited("phone")} onChange={upd("ordering", "phone")} mismatch={facilityMismatches.phone} onUseMismatch={facilityMismatches.phone ? () => onUpdateSection("ordering", { phone: facilityMismatches.phone.expected }) : undefined} />
              <Field label="Fax" value={form.ordering.fax || ""} edited={isEdited("fax")} onChange={upd("ordering", "fax")} mismatch={facilityMismatches.fax} onUseMismatch={facilityMismatches.fax ? () => onUpdateSection("ordering", { fax: facilityMismatches.fax.expected }) : undefined} />
            </div>
            {/* Row: Laboratory Contact (full width) */}
            <Field label="Laboratory Contact" value={form.ordering.lab_contact || ""} edited={isEdited("lab_contact")} onChange={upd("ordering", "lab_contact")} />
          </div>
        </Section>

        {/* ========== SINGLE ORDER MODE ========== */}
        {!manifestMode && (
        <>
        {/* === Section 2: Patient Information (Vet) === */}
        {isVet && (
          <Section
            color={MV.greenGrad}
            title="Patient Information"
            status={sectionStatus.patient.status}
            statusDetail={sectionStatus.patient.detail}
          >
            <div className="flex flex-col gap-4">
              {/* Row: Owner Last Name, Pet Name, Species */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Owner Last Name" value={form.patient.owner_name} confidence={conf("owner_name")} edited={isEdited("owner_name")} required onChange={upd("patient", "owner_name")} />
                <Field label="Pet Name" value={form.patient.name} confidence={conf("patient_name")} edited={isEdited("patient_name")} required onChange={upd("patient", "name")} />
                <Select label="Species" value={form.patient.species} options={SPECIES_OPTIONS} onChange={upd("patient", "species")} required placeholder="Select..." />
              </div>
              {/* Row: DOB (standalone) */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Date of Birth" value={form.patient.dob} confidence={conf("dob")} edited={isEdited("dob")} onChange={upd("patient", "dob")} type="date" />
              </div>
              {/* Row: Specimen Collection Date, Storage Temp, Specimen ID# */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Specimen Collection Date" value={form.specimen.collection_date} confidence={conf("collection_date")} edited={isEdited("collection_date")} onChange={upd("specimen", "collection_date")} type="date" />
                <Select label="Specimen Storage Temp" value={form.specimen.source} options={STORAGE_TEMP_OPTIONS} onChange={upd("specimen", "source")} placeholder="Select..." />
                <Field label="Specimen ID#" value={form.patient.mrn} confidence={conf("mrn")} edited={isEdited("mrn")} onChange={upd("patient", "mrn")} />
              </div>
              {/* Row: Ordering Veterinarian (full width) */}
              <Field label="Ordering Veterinarian" value={form.ordering.physician} confidence={conf("physician")} edited={isEdited("physician")} required onChange={upd("ordering", "physician")} />
            </div>
          </Section>
        )}

        {/* === Section 2: Patient Information (Human) === */}
        {!isVet && (
          <Section
            color={MV.greenGrad}
            title="Patient Information"
            status={sectionStatus.patient.status}
            statusDetail={sectionStatus.patient.detail}
          >
            <div className="flex flex-col gap-4">
              {/* Row: Last Name, First Name, Middle Name */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Last Name" value={form.patient.name} confidence={conf("patient_name")} edited={isEdited("name")} required onChange={upd("patient", "name")} />
                <Field label="First Name" value={form.patient.first_name} confidence={conf("first_name")} edited={isEdited("first_name")} required onChange={upd("patient", "first_name")} />
                <Field label="Middle Name" value={form.patient.middle_name} confidence={conf("middle_name")} edited={isEdited("middle_name")} onChange={upd("patient", "middle_name")} />
              </div>
              {/* Row: DOB, Accession ID# */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Date of Birth" value={form.patient.dob} confidence={conf("dob")} edited={isEdited("dob")} required onChange={upd("patient", "dob")} type="date" />
                <Field label="Accession ID#" value={form.patient.accession_id} confidence={conf("accession_id")} edited={isEdited("accession_id")} onChange={upd("patient", "accession_id")} />
              </div>
              {/* Row: Specimen Collection Date, Storage Temp */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Specimen Collection Date" value={form.specimen.collection_date} confidence={conf("collection_date")} edited={isEdited("collection_date")} onChange={upd("specimen", "collection_date")} type="date" />
                <Select label="Specimen Storage Temp" value={form.specimen.source} options={STORAGE_TEMP_OPTIONS} onChange={upd("specimen", "source")} placeholder="Select..." />
              </div>
              {/* Row: Ordering Physician, NPI */}
              <div className="grid grid-cols-3 gap-4">
                <Field label="Ordering Physician" value={form.ordering.physician} confidence={conf("physician")} edited={isEdited("physician")} required onChange={upd("ordering", "physician")} span={2} />
                <Field label="NPI" value={form.ordering.npi} confidence={conf("npi")} edited={isEdited("npi")} onChange={upd("ordering", "npi")} placeholder="10-digit NPI" />
              </div>
            </div>
          </Section>
        )}

        {/* === Section 3: Tests Ordered === */}
        <Section
          color={MV.warning}
          title="Tests Ordered"
          status={sectionStatus.tests.status}
          statusDetail={sectionStatus.tests.detail}
        >
          <TestPicker
            tests={form.tests}
            market={isVet ? "Veterinary" : "Human"}
            validationErrors={specimenErrors}
            onAdd={(test) => { onUpdateForm({ tests: [...form.tests, test] }); setSpecimenErrors([]); }}
            onRemove={(i) => { onUpdateForm({ tests: form.tests.filter((_, j) => j !== i) }); setSpecimenErrors([]); }}
            onUpdateTest={(i, updates) => {
              const newTests = [...form.tests];
              newTests[i] = { ...newTests[i], ...updates };
              onUpdateForm({ tests: newTests });
              setSpecimenErrors([]);
            }}
          />
        </Section>

        {/* === Section 4: Shipping === */}
        <Section
          color={MV.blue}
          title="Shipping"
          status={sectionStatus.specimen.status}
          statusDetail={sectionStatus.specimen.detail}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tracking Number" value={form.specimen.tracking_number} edited={isEdited("tracking_number")} onChange={upd("specimen", "tracking_number")} placeholder="Optional" />
            <Field label="Box ID (Fulcrum)" value={form.specimen.fulcrum_specimen_id} edited={isEdited("fulcrum_specimen_id")} onChange={upd("specimen", "fulcrum_specimen_id")} placeholder="Optional" />
          </div>
        </Section>

        {/* === Section 5: Clinical Notes & Diagnosis === */}
        <Section
          color={MV.gray400}
          title="Clinical Notes & Diagnosis"
          status={sectionStatus.notes.status}
          statusDetail={sectionStatus.notes.detail}
          defaultOpen={false}
        >
          <textarea
            value={form.diagnosis_codes?.join(", ") || ""}
            onChange={(e) => onUpdateForm({ diagnosis_codes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            rows={3}
            placeholder="ICD-10 codes, clinical notes..."
            className="w-full px-3.5 py-3 text-sm rounded-lg outline-none resize-y leading-relaxed"
            style={{ border: `1.5px solid ${MV.gray200}`, color: MV.text, backgroundColor: MV.white }}
          />
        </Section>

        </>
        )}

        {/* ========== MANIFEST MODE ========== */}
        {manifestMode && (
          <div className="mb-5">
            {/* New Order button + order count */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-[15px] font-bold m-0" style={{ color: MV.text }}>
                  Orders ({orders.length})
                </h3>
              </div>
              {!showOrderForm && (
                <button
                  onClick={() => { setEditingOrderIndex(null); setShowOrderForm(true); }}
                  className="px-4 py-2 rounded-md text-sm font-bold cursor-pointer border-none"
                  style={{ background: MV.greenGrad, color: "#fff", boxShadow: "0 2px 8px rgba(40, 111, 31, 0.25)" }}
                >
                  + New Order
                </button>
              )}
            </div>

            {/* Inline order form (add or edit) */}
            {showOrderForm && (
              <ManifestOrderForm
                orderType={orderType}
                initialData={editingOrderIndex !== null ? orders[editingOrderIndex] : null}
                onOk={handleAddOrder}
                onCancel={handleCancelOrder}
              />
            )}

            {/* Orders table */}
            <ManifestOrderTable
              orders={orders}
              orderType={orderType}
              onEdit={handleEditOrder}
              onDelete={handleDeleteOrder}
            />
          </div>
        )}

        {/* ========== MANIFEST REVIEW SCREEN ========== */}
        {manifestMode && showManifestReview && (
          <ManifestReview
            orders={orders}
            orderType={orderType}
            onBack={() => setShowManifestReview(false)}
            onSubmitApproved={(approvedOrders) => {
              // TODO: submit each approved order to backend
              alert(`Submitting ${approvedOrders.length} approved orders`);
              setShowManifestReview(false);
            }}
          />
        )}

        {/* Validation errors from backend */}
        {validation && !validation.valid && (
          <div className="mb-6 rounded-lg p-4" style={{ backgroundColor: MV.dangerLight, border: `1px solid ${MV.dangerBorder}` }}>
            <div className="text-sm font-semibold mb-2" style={{ color: MV.danger }}>Server Validation Errors</div>
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
              {manifestMode && ` (Order #${manifestIndex + 1})`}
            </div>
            {submitResult.accession_id && (
              <div className="font-mono text-sm mt-1" style={{ color: MV.success }}>{submitResult.accession_id}</div>
            )}
          </div>
        )}

        {/* Submit Bar */}
        <div
          className="flex items-center justify-between px-5 py-4 rounded-lg"
          style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <button
            onClick={onReset}
            className="px-5 py-2.5 rounded-md text-sm font-semibold cursor-pointer"
            style={{ backgroundColor: MV.white, color: MV.textMuted, border: `1px solid ${MV.gray200}` }}
          >
            Clear Form
          </button>
          <div className="flex items-center gap-3.5">
            {gateWarning && (
              <div className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: MV.warning }}>
                {"\u26A0"} {gateWarning}
              </div>
            )}
            {manifestMode && submitResult && (
              <button
                onClick={onNextManifestOrder}
                className="px-6 py-2.5 rounded-md text-sm font-bold cursor-pointer"
                style={{ backgroundColor: MV.teal, color: "#fff", border: "none" }}
              >
                Next Order (#{manifestIndex + 2})
              </button>
            )}
            <button
              onClick={() => {
                if (manifestMode) {
                  // Show manifest review screen
                  setShowManifestReview(true);
                } else if (submitReady) {
                  onSubmit();
                } else {
                  // Single order: validate specimens first
                  const errors = validateSpecimens(form.tests);
                  setSpecimenErrors(errors);
                  if (errors.length === 0) {
                    onValidate();
                  }
                }
              }}
              disabled={loading || (manifestMode && orders.length === 0)}
              className="px-8 py-2.5 rounded-md border-none cursor-pointer text-[15px] font-bold disabled:opacity-50"
              style={{ background: MV.greenGrad, color: "#fff", boxShadow: "0 2px 10px rgba(40, 111, 31, 0.3)" }}
            >
              {loading ? "Processing..." : submitReady ? "Submit Accession" : "Validate & Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
