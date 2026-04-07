/**
 * ScannerSettings — Popout panel for TWAIN scanner configuration.
 *
 * Settings: Scanner device, Color mode, Paper size, DPI, Duplex, Source (flatbed/ADF)
 */
import { MV } from "../theme";
import Select from "./Select";

const COLOR_OPTIONS = [
  { value: "color", label: "Color" },
  { value: "grayscale", label: "Grayscale" },
  { value: "bw", label: "Black & White" },
];

const PAPER_OPTIONS = [
  { value: "letter", label: "Letter (8.5 x 11)" },
  { value: "legal", label: "Legal (8.5 x 14)" },
  { value: "a4", label: "A4 (210 x 297mm)" },
  { value: "auto", label: "Auto Detect" },
];

const DPI_OPTIONS = [
  { value: "150", label: "150 DPI (Draft)" },
  { value: "200", label: "200 DPI (Standard)" },
  { value: "300", label: "300 DPI (Quality)" },
  { value: "600", label: "600 DPI (High)" },
];

const SOURCE_OPTIONS = [
  { value: "adf", label: "ADF (Auto Document Feeder)" },
  { value: "flatbed", label: "Flatbed" },
];

export default function ScannerSettings({ settings, onChange, onClose, scannerSources }) {
  const upd = (key) => (e) => onChange({ ...settings, [key]: e.target.value });

  // Build device options from TWAIN enumeration
  const deviceOptions = (scannerSources || []).map((name) => ({
    value: name,
    label: name,
  }));

  return (
    <div
      className="absolute bottom-full mb-2 left-0 right-0 z-50 rounded-lg"
      style={{
        backgroundColor: MV.white,
        border: `1px solid ${MV.gray200}`,
        boxShadow: "0 -8px 24px rgba(0,0,0,0.15)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${MV.gray200}`, backgroundColor: MV.gray50 }}
      >
        <span className="text-xs font-bold uppercase" style={{ color: MV.textMuted, letterSpacing: "0.06em" }}>
          Scanner Settings
        </span>
        <button
          onClick={onClose}
          className="text-sm cursor-pointer bg-transparent border-none"
          style={{ color: MV.gray400 }}
        >
          {"\u2715"}
        </button>
      </div>

      {/* Settings grid */}
      <div className="px-4 py-3">
        {/* Scanner device selector — full width */}
        {deviceOptions.length > 0 && (
          <div className="mb-3">
            <Select
              label="Scanner Device"
              value={settings.deviceName || ""}
              options={deviceOptions}
              onChange={upd("deviceName")}
              placeholder="Select scanner..."
            />
          </div>
        )}

        {/* No scanners detected notice */}
        {deviceOptions.length === 0 && (
          <div
            className="mb-3 px-3 py-2 rounded text-xs"
            style={{ backgroundColor: MV.warningLight, border: `1px solid ${MV.warningBorder}`, color: MV.warning }}
          >
            No TWAIN scanners detected. Ensure Dynamsoft Service is running and a scanner is connected.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Select label="Color Mode" value={settings.colorMode} options={COLOR_OPTIONS} onChange={upd("colorMode")} />
          <Select label="Paper Size" value={settings.paperSize} options={PAPER_OPTIONS} onChange={upd("paperSize")} />
          <Select label="Resolution" value={settings.dpi} options={DPI_OPTIONS} onChange={upd("dpi")} />
          <Select label="Source" value={settings.source} options={SOURCE_OPTIONS} onChange={upd("source")} />
        </div>

        {/* Duplex toggle */}
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.duplex}
            onChange={(e) => onChange({ ...settings, duplex: e.target.checked })}
            className="w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: MV.green2 }}
          />
          <span className="text-xs font-semibold uppercase" style={{ color: MV.textMuted }}>
            Duplex (scan both sides)
          </span>
        </label>
      </div>
    </div>
  );
}

export const DEFAULT_SCANNER_SETTINGS = {
  colorMode: "grayscale",
  paperSize: "letter",
  dpi: "200",
  source: "adf",
  duplex: false,
  deviceName: "",  // Will be populated from TWAIN device enumeration
};
