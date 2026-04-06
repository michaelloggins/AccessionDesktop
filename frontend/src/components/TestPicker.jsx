/**
 * TestPicker — Compendium search with specimen type per test.
 *
 * Each added test gets its own specimen type selector showing only
 * compatible types for that test.
 */
import { useState, useCallback, useRef } from "react";
import { MV } from "../theme";
import { searchTests } from "../services/api";

const ALL_SPECIMEN_TYPES = [
  { code: "UR", name: "Urine" },
  { code: "SER", name: "Serum" },
  { code: "PLS", name: "Plasma" },
  { code: "CSF", name: "CSF" },
  { code: "BAL", name: "BAL" },
  { code: "Other", name: "Other" },
];

export default function TestPicker({ tests, onAdd, onRemove, onUpdateTest, market }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    try {
      const data = await searchTests(q, market || "");
      const filtered = data.filter(
        (t) => !tests.find((s) => s.code === t.code),
      );
      setResults(filtered);
      setOpen(filtered.length > 0);
    } catch {
      setResults([]);
    }
  }, [tests, market]);

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
      {/* Selected tests with specimen type */}
      {tests.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {tests.map((t, i) => (
            <div
              key={`${t.code}-${i}`}
              className="rounded-md px-3.5 py-2.5"
              style={{
                backgroundColor: MV.tealLight,
                border: "1px solid rgba(126, 190, 197, 0.3)",
              }}
            >
              <div className="flex items-center justify-between">
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
              {/* Specimen type selector for this test */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase" style={{ color: MV.textMuted }}>
                  Specimen:
                </span>
                <div className="flex gap-1 flex-wrap">
                  {(t.compatible_specimens || ALL_SPECIMEN_TYPES.map(s => s.code)).map((st) => {
                    const selected = t.specimen_type === st;
                    return (
                      <button
                        key={st}
                        onClick={() => onUpdateTest(i, { specimen_type: st })}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all"
                        style={{
                          backgroundColor: selected ? MV.teal : "rgba(126, 190, 197, 0.15)",
                          color: selected ? "#fff" : MV.tealDark,
                          border: `1px solid ${selected ? MV.teal : "rgba(126, 190, 197, 0.3)"}`,
                        }}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>
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
            className="absolute top-full mt-1 left-0 right-0 z-50 rounded-md max-h-60 overflow-auto"
            style={{
              backgroundColor: MV.white,
              border: `1px solid ${MV.gray200}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            {results.slice(0, 10).map((t) => (
              <button
                key={t.code}
                onMouseDown={() => {
                  onAdd({
                    code: t.code,
                    name: t.name,
                    specimen_type: null,
                    compatible_specimens: t.specimen_types || [],
                  });
                  setQuery("");
                  setResults((r) => r.filter((x) => x.code !== t.code));
                }}
                className="flex items-center justify-between w-full px-3.5 py-2.5 text-left cursor-pointer bg-transparent hover:bg-gray-50"
                style={{ border: "none", borderBottom: `1px solid ${MV.gray100}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: MV.text }}>{t.name}</div>
                  <div className="text-[11px] mt-0.5 flex items-center gap-1 flex-wrap" style={{ color: MV.textMuted }}>
                    <span className="font-mono font-bold" style={{ color: MV.tealDark }}>{t.code}</span>
                    <span style={{ color: MV.gray300 }}>|</span>
                    <span>{t.organism}</span>
                    <span style={{ color: MV.gray300 }}>|</span>
                    <span>{t.specimen_types?.join(", ")}</span>
                  </div>
                  {t.tat && (
                    <div className="text-[10px] mt-0.5" style={{ color: MV.gray400 }}>
                      TAT: {t.tat}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: MV.gray400, backgroundColor: MV.gray100 }}
                  >
                    {t.category}
                  </span>
                  <span className="text-[10px]" style={{ color: MV.gray400 }}>
                    {t.methodology}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
