/**
 * DeviceChip — Header status chip for a device with gear icon.
 * Shows status dot (green/red/yellow) + label + gear button.
 * Or a select dropdown for station ID.
 */

export default function DeviceChip({
  status,
  label,
  onGearClick,
  isSelect,
  selectValue,
  selectOptions,
  onSelectChange,
}) {
  if (isSelect) {
    return (
      <select
        value={selectValue}
        onChange={(e) => onSelectChange(e.target.value)}
        className="text-[11px] font-semibold rounded px-2 py-1 cursor-pointer outline-none"
        style={{
          backgroundColor: "rgba(255,255,255,0.15)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.25)",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='white' d='M2 3l3 3 3-3'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 5px center",
          paddingRight: "18px",
        }}
      >
        {selectOptions.map((o) => (
          <option key={o.value} value={o.value} style={{ color: "#333" }}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  const dotColor =
    status === "online" ? "bg-green-400" :
    status === "busy" ? "bg-yellow-400" :
    "bg-red-400";

  return (
    <div className="flex items-center gap-0.5">
      <div className="flex items-center gap-1 px-2 py-1 rounded-l bg-white/15">
        <div className={`w-[6px] h-[6px] rounded-full ${dotColor}`} />
        <span className="text-[11px] text-white font-medium">{label}</span>
      </div>
      <button
        onClick={onGearClick}
        className="px-1.5 py-1 rounded-r cursor-pointer border-none text-[11px] bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        title={`Configure ${label}`}
      >
        {"\u2699"}
      </button>
    </div>
  );
}
