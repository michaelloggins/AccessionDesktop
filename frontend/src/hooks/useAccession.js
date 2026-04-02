/**
 * Core state management hook for the accessioning workflow.
 *
 * Manages the workflow steps: scan → extract → gate check → fill form → validate → submit
 */

import { useReducer, useCallback } from "react";
import * as api from "../services/api";

const STEPS = ["scan", "review", "validate", "submit", "done"];

const initialState = {
  step: "scan",
  extraction: null,
  gateResults: {},
  form: {
    patient: { name: "", dob: "", mrn: "", species: "", breed: "", owner_name: "" },
    ordering: { customer_id: "", facility_code: "", physician: "", npi: "" },
    specimen: { tracking_number: "", fulcrum_specimen_id: "", type: "", source: "", collection_date: "", received_date: "" },
    tests: [],
    priority: "Routine",
    diagnosis_codes: [],
  },
  validation: null,
  submitResult: null,
  loading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload, error: null };
    case "SET_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "SET_EXTRACTION":
      return {
        ...state,
        loading: false,
        extraction: action.payload,
        form: mergeExtraction(state.form, action.payload),
        step: "review",
      };
    case "SET_GATE_RESULTS":
      return { ...state, loading: false, gateResults: { ...state.gateResults, ...action.payload } };
    case "UPDATE_FORM":
      return { ...state, form: { ...state.form, ...action.payload } };
    case "UPDATE_FORM_SECTION":
      return {
        ...state,
        form: {
          ...state.form,
          [action.section]: { ...state.form[action.section], ...action.payload },
        },
      };
    case "SET_VALIDATION":
      return { ...state, loading: false, validation: action.payload, step: action.payload.valid ? "submit" : "validate" };
    case "SET_SUBMIT_RESULT":
      return { ...state, loading: false, submitResult: action.payload, step: "done" };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

/** Merge OCR extraction into the form, preserving any manual edits */
function mergeExtraction(form, extraction) {
  return {
    patient: { ...form.patient, ...stripEmpty(extraction.patient) },
    ordering: { ...form.ordering, ...stripEmpty(extraction.ordering) },
    specimen: { ...form.specimen, ...stripEmpty(extraction.specimen) },
    tests: extraction.tests.length > 0 ? extraction.tests : form.tests,
    priority: extraction.priority || form.priority,
    diagnosis_codes: extraction.diagnosis_codes.length > 0 ? extraction.diagnosis_codes : form.diagnosis_codes,
  };
}

/** Remove null/empty values so they don't overwrite manual entries */
function stripEmpty(obj) {
  if (!obj) return {};
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v !== ""));
}

export default function useAccession() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const uploadAndExtract = useCallback(async (file) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const extraction = await api.uploadDocument(file);
      dispatch({ type: "SET_EXTRACTION", payload: extraction });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    }
  }, []);

  const runGateCheck = useCallback(async (trigger) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const gateRequest = {
        station_id: "DEV-01",
        operator_id: "operator",
        specimen_id: state.form.specimen.fulcrum_specimen_id,
        tracking_number: state.form.specimen.tracking_number,
        context: {
          extracted_specimen_type: state.form.specimen.type,
          extracted_tests: state.form.tests.map((t) => t.code),
          customer_id: state.form.ordering.customer_id,
        },
      };
      const results = await api.checkGates(trigger, gateRequest);
      dispatch({ type: "SET_GATE_RESULTS", payload: results });
      return results;
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
      return {};
    }
  }, [state.form]);

  const validate = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const payload = buildPayload(state.form);
      const result = await api.validateAccession(payload);
      dispatch({ type: "SET_VALIDATION", payload: result });
      return result;
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    }
  }, [state.form]);

  const submit = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const payload = buildPayload(state.form);
      payload.gate_results = state.gateResults;
      const result = await api.submitAccession(payload);
      dispatch({ type: "SET_SUBMIT_RESULT", payload: result });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    }
  }, [state.form, state.gateResults]);

  const updateForm = useCallback((updates) => {
    dispatch({ type: "UPDATE_FORM", payload: updates });
  }, []);

  const updateFormSection = useCallback((section, updates) => {
    dispatch({ type: "UPDATE_FORM_SECTION", section, payload: updates });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    ...state,
    uploadAndExtract,
    runGateCheck,
    validate,
    submit,
    updateForm,
    updateFormSection,
    reset,
  };
}

function buildPayload(form) {
  return {
    station_id: "DEV-01",
    operator_id: "operator",
    timestamp: new Date().toISOString(),
    ...form,
  };
}
