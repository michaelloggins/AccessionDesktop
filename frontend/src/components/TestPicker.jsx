/**
 * TestPicker — Compendium search with dropdown for adding tests.
 */
import { useState, useCallback, useRef } from "react";
import { MV } from "../theme";
import { searchTests } from "../services/api";

export default function TestPicker({ tests, onAdd, onRemove }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    try {
      const data = await searchTests(q);
      // Filter out already-selected tests
      const filtered = data.filter(
        (t) => !tests.find((s) => s.code === t.code),
      );
      setResults(filtered);
      setOpen(filtered.length > 0);
    } catch {
      setResults([]);
    }
  }, [tests]);

  const handleChange = useCallback(
    (e) => {
      const val = e.target.value;
      setQuery(val);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(val), 150);
    },
    [search],
  );

  const handleFocus = useCallback(() => {
    if (results.length > 0) setOpen(true);
    else search(query);
  }, [results, query, search]);

  return (
    <div>
      {/* Selected tests */}
      {tests.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {tests.map((t, i) => (
            <div
              key={t.code}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-md"
              style={{
                backgroundColor: MV.tealLight,
                border: "1px solid rgba(126, 190, 197, 0.3)",
              }}
            >
              <div>
                <div className="text-sm font-semibold" style={{ color: MV.text }}>{t.name}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: MV.tealDark }}>{t.code}</div>
              </div>
              <button
                onClick={() => onRemove(i)}
                className="px-2 py-0.5 rounded text-base cursor-pointer bg-transparent"
                style={{ border: "1px solid rgba(126, 190, 197, 0.4)", color: MV.tealDark }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search compendium to add tests..."
          className="w-full px-3 py-2.5 text-sm rounded-[5px] outline-none"
          style={{ border: `1.5px solid ${MV.gray200}`, color: MV.text }}
        />
        {open && results.length > 0 && (
          <div
            className="absolute top-full mt-1 left-0 right-0 z-20 rounded-md max-h-60 overflow-auto"
            style={{
              backgroundColor: MV.white,
              border: `1px solid ${MV.gray200}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            {results.slice(0, 8).map((t) => (
              <button
                key={t.code}
                onMouseDown={() => {
                  onAdd({ code: t.code, name: t.name });
                  setQuery("");
                  setResults((r) => r.filter((x) => x.code !== t.code));
                }}
                className="flex items-center justify-between w-full px-3.5 py-2.5 text-left cursor-pointer bg-transparent hover:bg-gray-50"
                style={{ border: "none", borderBottom: `1px solid ${MV.gray100}` }}
              >
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: MV.text }}>{t.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: MV.textMuted }}>
                    <span className="font-mono" style={{ color: MV.tealDark }}>{t.code}</span>
                    <span className="mx-1.5" style={{ color: MV.gray300 }}>|</span>
                    {t.specimen_types?.join(", ")}
                  </div>
                </div>
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ color: MV.gray400, backgroundColor: MV.gray100 }}
                >
                  {t.category}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
