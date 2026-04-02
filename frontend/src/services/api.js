/**
 * API client for the MVD Accessioning backend.
 * All calls go through the Vite proxy to http://localhost:5000.
 */

const API_BASE = "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

/** Upload a scanned document for OCR extraction */
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/scan/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Upload failed");
  }

  return response.json();
}

/** Run gate checks for a trigger point */
export async function checkGates(trigger, gateRequest) {
  return request(`/gates/check/${trigger}`, {
    method: "POST",
    body: JSON.stringify(gateRequest),
  });
}

/** Validate an accession payload locally */
export async function validateAccession(payload) {
  return request("/accession/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Submit a validated accession */
export async function submitAccession(payload) {
  return request("/accession/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Search customers for autocomplete */
export async function searchCustomers(query) {
  return request(`/lookup/customers?q=${encodeURIComponent(query)}`);
}

/** Search physicians for autocomplete */
export async function searchPhysicians(query) {
  return request(`/lookup/physicians?q=${encodeURIComponent(query)}`);
}

/** Get available tests */
export async function searchTests(query = "") {
  return request(`/lookup/tests?q=${encodeURIComponent(query)}`);
}
