/**
 * FacilityLookup — Combined Azure Maps + RASCLIENTS facility search.
 *
 * Two input modes:
 * 1. Facility ID field — if they type an ExternalClientID, lookup and auto-fill
 * 2. Facility Name / Address — searches both Azure Maps (address autocomplete)
 *    and RASCLIENTS (facility database). Shows combined results.
 *
 * When a RASCLIENTS match is selected, auto-fills all facility fields.
 * When an Azure Maps result is selected, fills address only.
 */
import { useState, useCallback, useRef } from "react";
import { MV } from "../theme";
import { addressAutocomplete, facilitySearch, facilityLookup } from "../services/api";

export default function FacilityLookup({ form, onUpdateSection }) {
  const [nameQuery, setNameQuery] = useState(form.ordering.customer_id || "");
  const [idQuery, setIdQuery] = useState(form.ordering.facility_code || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  // Search both RASCLIENTS and Azure Maps
  const searchCombined = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const [facilities, addresses] = await Promise.all([
        facilitySearch(q).catch(() => []),
        addressAutocomplete(q).catch(() => []),
      ]);

      const combined = [];

      // RASCLIENTS results first (database matches)
      facilities.forEach((f) => {
        combined.push({
          type: "facility",
          label: f.ClientName || f.clientName,
          sublabel: `${f.Address1 || ""}, ${f.City || ""}, ${f.State || ""} ${f.ZipCode || ""}`.trim(),
          id: f.ExternalClientID || f.externalClientID,
          data: f,
        });
      });

      // Azure Maps results (address suggestions)
      addresses.forEach((a) => {
        combined.push({
          type: "address",
          label: a.formatted,
          sublabel: "Azure Maps",
          data: a,
        });
      });

      setResults(combined);
      setOpen(combined.length > 0);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }, []);

  const handleNameChange = useCallback((e) => {
    const val = e.target.value;
    setNameQuery(val);
    onUpdateSection("ordering", { customer_id: val });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCombined(val), 250);
  }, [searchCombined, onUpdateSection]);

  // Facility ID lookup — when they type an ID, lookup and auto-fill
  const handleIdChange = useCallback(async (e) => {
    const val = e.target.value;
    setIdQuery(val);
    onUpdateSection("ordering", { facility_code: val });

    if (val.length >= 2) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await facilityLookup(val);
          if (result && !result.error) {
            applyFacility(result);
          }
        } catch { /* ignore */ }
      }, 500);
    }
  }, [onUpdateSection]);

  const applyFacility = (f) => {
    const name = f.ClientName || f.clientName || "";
    const updates = {
      customer_id: name,
      facility_code: f.ExternalClientID || f.externalClientID || "",
      address1: f.Address1 || f.address1 || "",
      address2: f.Address2 || f.address2 || "",
      city: f.City || f.city || "",
      state: f.State || f.state || "",
      zip: f.ZipCode || f.zipCode || "",
      country: f.Country || f.country || "US",
      phone: f.Phone || f.phone || "",
      fax: f.Fax || f.fax || "",
      email: f.Email || f.email || "",
      lab_contact: f.ContactName || f.contactName || "",
    };
    onUpdateSection("ordering", updates);
    setNameQuery(name);
    setIdQuery(updates.facility_code);
    setOpen(false);
  };

  const applyAddress = (a) => {
    onUpdateSection("ordering", {
      address1: a.address1 || "",
      city: a.city || "",
      state: a.state || "",
      zip: a.zip || "",
      country: a.country || "US",
    });
    setOpen(false);
  };

  const handleSelect = (item) => {
    if (item.type === "facility") {
      applyFacility(item.data);
    } else {
      applyAddress(item.data);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Row: Facility Name + Facility ID */}
      <div className="grid grid-cols-3 gap-4">
        {/* Facility Name with autocomplete */}
        <div className="col-span-2 relative">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: MV.textMuted }}>
              Facility Name<span style={{ color: MV.danger }}>*</span>
            </label>
            {searching && (
              <span className="text-[10px]" style={{ color: MV.tealDark }}>searching...</span>
            )}
          </div>
          <input
            type="text"
            value={nameQuery}
            onChange={handleNameChange}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 250)}
            placeholder="Type facility name or address..."
            className="w-full px-[11px] py-[9px] text-sm rounded-[5px] outline-none transition-all"
            style={{ border: `1.5px solid ${MV.gray200}`, color: MV.text }}
          />
          {/* Dropdown */}
          {open && results.length > 0 && (
            <div
              className="absolute top-full mt-1 left-0 right-0 z-50 rounded-md max-h-72 overflow-auto"
              style={{
                backgroundColor: MV.white,
                border: `1px solid ${MV.gray200}`,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
            >
              {results.map((item, i) => (
                <button
                  key={`${item.type}-${i}`}
                  onMouseDown={() => handleSelect(item)}
                  className="flex items-center justify-between w-full px-3.5 py-2.5 text-left cursor-pointer bg-transparent hover:bg-gray-50"
                  style={{ border: "none", borderBottom: `1px solid ${MV.gray100}` }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: MV.text }}>
                      {item.label}
                    </div>
                    <div className="text-[11px] mt-0.5 truncate" style={{ color: MV.textMuted }}>
                      {item.sublabel}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ml-2"
                    style={{
                      color: item.type === "facility" ? MV.success : MV.tealDark,
                      backgroundColor: item.type === "facility" ? MV.successLight : MV.tealLight,
                      border: `1px solid ${item.type === "facility" ? MV.successBorder : MV.teal}`,
                    }}
                  >
                    {item.type === "facility" ? `ID: ${item.id}` : "Address"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Facility ID — direct lookup */}
        <div>
          <div className="mb-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: MV.textMuted }}>
              Facility ID
            </label>
          </div>
          <input
            type="text"
            value={idQuery}
            onChange={handleIdChange}
            placeholder="ExternalClientID"
            className="w-full px-[11px] py-[9px] text-sm rounded-[5px] outline-none transition-all"
            style={{ border: `1.5px solid ${MV.gray200}`, color: MV.text }}
          />
        </div>
      </div>
    </div>
  );
}
