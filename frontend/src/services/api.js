/**
 * API client for the MVD Accessioning backend.
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

/** Search compendium tests, filtered by market and optionally species */
export async function searchTests(query = "", market = "", species = "") {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (market) params.set("market", market);
  if (species) params.set("species", species);
  return request(`/lookup/tests?${params.toString()}`);
}

// ─── Address / Facility APIs ───

/** Azure Maps address autocomplete */
export async function addressAutocomplete(query) {
  return request(`/address/autocomplete?q=${encodeURIComponent(query)}`);
}

/** Search RASCLIENTS by name or address */
export async function facilitySearch(query) {
  return request(`/address/facility/search?q=${encodeURIComponent(query)}`);
}

/** Lookup facility by ExternalClientID */
export async function facilityLookup(id) {
  return request(`/address/facility/lookup?id=${encodeURIComponent(id)}`);
}

/** Validate/match facility by name + address */
export async function facilityValidate({ name, address, city, state, zip }) {
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (address) params.set("address", address);
  if (city) params.set("city", city);
  if (state) params.set("state", state);
  if (zip) params.set("zip", zip);
  return request(`/address/facility/validate?${params.toString()}`);
}
