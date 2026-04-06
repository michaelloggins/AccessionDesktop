/**
 * ManifestOrderForm — Inline card for adding/editing a single order
 * within a multi-order manifest. Contains Patient Info + Tests fields.
 */
import { useState } from "react";
import { MV } from "../theme";
import Field from "./Field";
import Select from "./Select";
import TestPicker from "./TestPicker";

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

const emptyVetOrder = () => ({
  patient: { name: "", owner_name: "", species: "", dob: "", mrn: "" },
  specimen: { collection_date: "", source: "" },
  ordering: { physician: "" },
  tests: [],
});

const emptyHumanOrder = () => ({
  patient: { name: "", first_name: "", middle_name: "", dob: "", accession_id: "" },
  specimen: { collection_date: "", source: "" },
  ordering: { physician: "", npi: "" },
  tests: [],
});

export default function ManifestOrderForm({ orderType, initialData, onOk, onCancel }) {
  const isVet = orderType === "veterinary";
  const [order, setOrder] = useState(
    initialData || (isVet ? emptyVetOrder() : emptyHumanOrder()),
  );

  const updPatient = (key) => (e) =>
    setOrder((o) => ({ ...o, patient: { ...o.patient, [key]: e.target.value } }));
  const updSpecimen = (key) => (e) =>
    setOrder((o) => ({ ...o, specimen: { ...o.specimen, [key]: e.target.value } }));
  const updOrdering = (key) => (e) =>
    setOrder((o) => ({ ...o, ordering: { ...o.ordering, [key]: e.target.value } }));

  const handleOk = () => {
    onOk(order);
  };

  return (
    <div
      className="rounded-lg mb-5"
      style={{ border: `2px solid ${MV.teal}`, boxShadow: "0 4px 16px rgba(126, 190, 197, 0.2)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ backgroundColor: MV.tealLight, borderBottom: `1px solid ${MV.teal}` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-sm" style={{ backgroundColor: MV.teal }} />
          <h3 className="text-[15px] font-bold m-0" style={{ color: MV.text }}>
            {initialData ? "Edit Order" : "New Order"}
          </h3>
        </div>
      </div>

      {/* Form body */}
      <div className="px-5 py-4" style={{ backgroundColor: MV.white }}>
        {/* Vet patient fields */}
        {isVet && (
          <div className="flex flex-col gap-4 mb-5">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Owner Last Name" value={order.patient.owner_name} required onChange={updPatient("owner_name")} />
              <Field label="Pet Name" value={order.patient.name} required onChange={updPatient("name")} />
              <Select label="Species" value={order.patient.species} options={SPECIES_OPTIONS} required onChange={updPatient("species")} placeholder="Select..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Date of Birth" value={order.patient.dob} onChange={updPatient("dob")} type="date" />
              <Field label="Specimen Collection Date" value={order.specimen.collection_date} onChange={updSpecimen("collection_date")} type="date" />
              <Select label="Specimen Storage Temp" value={order.specimen.source} options={STORAGE_TEMP_OPTIONS} onChange={updSpecimen("source")} placeholder="Select..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Specimen ID#" value={order.patient.mrn} onChange={updPatient("mrn")} />
              <Field label="Ordering Veterinarian" value={order.ordering.physician} required onChange={updOrdering("physician")} span={2} />
            </div>
          </div>
        )}

        {/* Human patient fields */}
        {!isVet && (
          <div className="flex flex-col gap-4 mb-5">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Last Name" value={order.patient.name} required onChange={updPatient("name")} />
              <Field label="First Name" value={order.patient.first_name} required onChange={updPatient("first_name")} />
              <Field label="Middle Name" value={order.patient.middle_name} onChange={updPatient("middle_name")} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Date of Birth" value={order.patient.dob} required onChange={updPatient("dob")} type="date" />
              <Field label="Accession ID#" value={order.patient.accession_id} onChange={updPatient("accession_id")} />
              <Select label="Specimen Storage Temp" value={order.specimen.source} options={STORAGE_TEMP_OPTIONS} onChange={updSpecimen("source")} placeholder="Select..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Specimen Collection Date" value={order.specimen.collection_date} onChange={updSpecimen("collection_date")} type="date" />
              <Field label="Ordering Physician" value={order.ordering.physician} required onChange={updOrdering("physician")} />
              <Field label="NPI" value={order.ordering.npi} onChange={updOrdering("npi")} placeholder="10-digit NPI" />
            </div>
          </div>
        )}

        {/* Tests */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-sm" style={{ backgroundColor: MV.warning }} />
            <span className="text-xs font-bold uppercase" style={{ color: MV.textMuted, letterSpacing: "0.04em" }}>
              Tests Ordered
            </span>
          </div>
          <TestPicker
            tests={order.tests}
            market={isVet ? "Veterinary" : "Human"}
            onAdd={(test) => setOrder((o) => ({ ...o, tests: [...o.tests, test] }))}
            onRemove={(i) => setOrder((o) => ({ ...o, tests: o.tests.filter((_, j) => j !== i) }))}
            onUpdateTest={(i, updates) => {
              setOrder((o) => {
                const newTests = [...o.tests];
                newTests[i] = { ...newTests[i], ...updates };
                return { ...o, tests: newTests };
              });
            }}
          />
        </div>
      </div>

      {/* Footer buttons */}
      <div
        className="flex items-center justify-end gap-3 px-5 py-3"
        style={{ backgroundColor: MV.gray50, borderTop: `1px solid ${MV.gray200}` }}
      >
        <button
          onClick={onCancel}
          className="px-5 py-2 rounded-md text-sm font-semibold cursor-pointer"
          style={{ backgroundColor: MV.white, color: MV.textMuted, border: `1px solid ${MV.gray200}` }}
        >
          Cancel
        </button>
        <button
          onClick={handleOk}
          className="px-6 py-2 rounded-md text-sm font-bold cursor-pointer border-none"
          style={{ background: MV.greenGrad, color: "#fff", boxShadow: "0 2px 8px rgba(40, 111, 31, 0.25)" }}
        >
          {initialData ? "Update Order" : "Add Order"}
        </button>
      </div>
    </div>
  );
}
