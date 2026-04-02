/**
 * CustomerAutocomplete — Searches the local customer master for facility selection.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { searchCustomers } from "../services/api";

export default function CustomerAutocomplete({ value, facilityCode, onSelect }) {
  const [query, setQuery] = useState(facilityCode || value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    if (q.length < 1) {
      setResults([]);
      return;
    }
    try {
      const data = await searchCustomers(q);
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    }
  }, []);

  const handleChange = useCallback(
    (e) => {
      const val = e.target.value;
      setQuery(val);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(val), 200);
    },
    [search],
  );

  const handleSelect = useCallback(
    (customer) => {
      setQuery(`${customer.facility_code} — ${customer.name}`);
      setOpen(false);
      onSelect(customer);
    },
    [onSelect],
  );

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-600">
        Facility
      </label>
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search by name, facility code, or ID..."
        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg">
          {results.map((c) => (
            <li
              key={c.customer_id}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
              onMouseDown={() => handleSelect(c)}
            >
              <span className="font-medium">{c.facility_code}</span>
              {" — "}
              <span className="text-gray-600">{c.name}</span>
              <span className="ml-2 text-xs text-gray-400">
                {c.account_type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
