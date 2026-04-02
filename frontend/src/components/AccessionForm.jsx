/**
 * AccessionForm — The main data entry form pre-filled from OCR extraction.
 *
 * Operators review AI-extracted fields, correct errors, and complete
 * any missing information before validation and submission.
 */

import { useState, useEffect } from "react";
import CustomerAutocomplete from "./CustomerAutocomplete";

export default function AccessionForm({
  form,
  extraction,
  onUpdateSection,
  onUpdateForm,
  onValidate,
  loading,
}) {
  const confidence = extraction?.confidence ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">
          Accession Form
        </h2>
        {extraction && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              confidence >= 0.8
                ? "bg-green-100 text-green-800"
                : confidence >= 0.5
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
            }`}
          >
            AI Confidence: {Math.round(confidence * 100)}%
          </span>
        )}
      </div>

      {confidence < 0.5 && extraction && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Low AI confidence — please verify all fields manually.
        </div>
      )}

      {/* Patient / Animal Info */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-sm font-medium text-gray-700">
          Patient Information
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Patient / Pet Name"
            value={form.patient.name}
            onChange={(v) => onUpdateSection("patient", { name: v })}
          />
          <Field
            label="Owner Name"
            value={form.patient.owner_name}
            onChange={(v) => onUpdateSection("patient", { owner_name: v })}
            placeholder="Vet only"
          />
          <Field
            label="Species"
            value={form.patient.species}
            onChange={(v) => onUpdateSection("patient", { species: v })}
            placeholder="Canine, Feline, etc."
          />
          <Field
            label="Breed"
            value={form.patient.breed}
            onChange={(v) => onUpdateSection("patient", { breed: v })}
          />
          <Field
            label="Date of Birth"
            value={form.patient.dob}
            onChange={(v) => onUpdateSection("patient", { dob: v })}
            placeholder="MM/DD/YYYY"
          />
          <Field
            label="MRN / Specimen ID"
            value={form.patient.mrn}
            onChange={(v) => onUpdateSection("patient", { mrn: v })}
          />
        </div>
      </fieldset>

      {/* Ordering Info */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-sm font-medium text-gray-700">
          Ordering Information
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
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
          <Field
            label="Ordering Physician / Veterinarian"
            value={form.ordering.physician}
            onChange={(v) => onUpdateSection("ordering", { physician: v })}
          />
          <Field
            label="NPI"
            value={form.ordering.npi}
            onChange={(v) => onUpdateSection("ordering", { npi: v })}
            placeholder="10-digit NPI"
          />
        </div>
      </fieldset>

      {/* Specimen Info */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-sm font-medium text-gray-700">
          Specimen
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Specimen Type"
            value={form.specimen.type}
            onChange={(v) => onUpdateSection("specimen", { type: v })}
            placeholder="Serum, Urine, BAL, CSF, etc."
          />
          <Field
            label="Specimen Source"
            value={form.specimen.source}
            onChange={(v) => onUpdateSection("specimen", { source: v })}
          />
          <Field
            label="Collection Date"
            value={form.specimen.collection_date}
            onChange={(v) => onUpdateSection("specimen", { collection_date: v })}
          />
          <Field
            label="Tracking Number"
            value={form.specimen.tracking_number}
            onChange={(v) =>
              onUpdateSection("specimen", { tracking_number: v })
            }
          />
        </div>
      </fieldset>

      {/* Tests */}
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-2 text-sm font-medium text-gray-700">
          Tests Ordered
        </legend>
        {form.tests.length > 0 ? (
          <ul className="space-y-1">
            {form.tests.map((test, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono text-gray-500">{test.code}</span>{" "}
                  {test.name}
                </span>
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => {
                    const newTests = form.tests.filter((_, j) => j !== i);
                    onUpdateForm({ tests: newTests });
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No tests detected. Add tests manually or re-scan.
          </p>
        )}
      </fieldset>

      {/* Priority */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Priority:</label>
        <select
          value={form.priority}
          onChange={(e) => onUpdateForm({ priority: e.target.value })}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="Routine">Routine</option>
          <option value="STAT">STAT</option>
        </select>
      </div>

      {/* Validate button */}
      <button
        onClick={onValidate}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Validating..." : "Validate & Continue"}
      </button>
    </div>
  );
}

/** Reusable text input field */
function Field({ label, value, onChange, placeholder = "" }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
