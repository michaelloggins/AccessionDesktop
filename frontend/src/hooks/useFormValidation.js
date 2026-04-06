/**
 * useFormValidation — Real-time inline validation for each form section.
 *
 * Returns a status per section: "complete" | "warning" | "error" | "empty"
 * Plus detail messages for each.
 */

import { useMemo } from "react";

/**
 * Validate a single field. Returns null if ok, or { severity, message }.
 */
function checkField(value, { required, pattern, patternMsg, warnEmpty, warnMsg }) {
  if (required && (!value || value.trim() === "")) {
    return { severity: "error", message: "Required" };
  }
  if (pattern && value && !new RegExp(pattern).test(value)) {
    return { severity: "error", message: patternMsg || "Invalid format" };
  }
  if (warnEmpty && (!value || value.trim() === "")) {
    return { severity: "warning", message: warnMsg || "Recommended" };
  }
  return null;
}

function summarizeSection(results) {
  const errors = results.filter((r) => r?.severity === "error");
  const warnings = results.filter((r) => r?.severity === "warning");
  const filled = results.filter((r) => r === null);

  if (errors.length > 0) {
    return {
      status: "error",
      detail: `${errors.length} issue${errors.length > 1 ? "s" : ""}`,
    };
  }
  if (warnings.length > 0) {
    return {
      status: "warning",
      detail: `${warnings.length} warning${warnings.length > 1 ? "s" : ""}`,
    };
  }
  // All fields either filled or not required
  const hasAnyValue = results.some((r) => r === null);
  if (!hasAnyValue && results.length > 0) {
    return { status: "empty", detail: "" };
  }
  return { status: "complete", detail: "Complete" };
}

export default function useFormValidation(form, orderType) {
  const isVet = orderType === "veterinary";

  return useMemo(() => {
    // --- Ordering Facility ---
    const facilityResults = [
      checkField(form.ordering.customer_id, { required: true }),
      checkField(form.ordering.facility_code, { warnEmpty: true, warnMsg: "Helps with matching" }),
    ];
    const facility = summarizeSection(facilityResults);

    // --- Patient Information ---
    const patientResults = isVet
      ? [
          checkField(form.patient.owner_name, { required: true }),
          checkField(form.patient.name, { required: true }),
          checkField(form.patient.species, { required: true }),
          checkField(form.ordering.physician, { required: true }),
          checkField(form.patient.dob, { warnEmpty: true, warnMsg: "Recommended" }),
          checkField(form.specimen.collection_date, { warnEmpty: true, warnMsg: "Recommended" }),
        ]
      : [
          checkField(form.patient.name, { required: true }),
          checkField(form.patient.first_name, { required: true }),
          checkField(form.ordering.physician, { required: true }),
          checkField(form.patient.dob, { required: true, pattern: "^(0[1-9]|1[0-2])/(0[1-9]|[12]\\d|3[01])/(19|20)\\d{2}$", patternMsg: "MM/DD/YYYY" }),
          checkField(form.patient.mrn, { warnEmpty: true, warnMsg: "Recommended" }),
        ];
    const patient = summarizeSection(patientResults);

    // --- Shipping ---
    const specimenResults = [
      checkField(form.specimen.tracking_number, { warnEmpty: true, warnMsg: "Recommended" }),
    ];
    const specimen = summarizeSection(specimenResults);

    // --- Tests Ordered ---
    const hasTests = form.tests.length > 0;
    const allHaveSpecimen = form.tests.every((t) => t.specimen_type);
    const testsResults = [];
    if (!hasTests) {
      testsResults.push({ severity: "error", message: "At least one test required" });
    } else if (!allHaveSpecimen) {
      testsResults.push({ severity: "warning", message: "Select specimen type for each test" });
    } else {
      testsResults.push(null); // all good
    }
    const tests = summarizeSection(testsResults);

    // --- Clinical Notes ---
    const notesResults = [
      checkField(form.diagnosis_codes?.join(","), { warnEmpty: true, warnMsg: "Recommended" }),
    ];
    const notes = summarizeSection(notesResults);

    return { facility, patient, specimen, tests, notes };
  }, [form, isVet]);
}
