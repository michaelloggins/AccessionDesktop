/**
 * DeviceConfig — Small popout for configuring a device (scanner, printer, etc).
 * Appears below the header when the gear icon is clicked.
 */
import { useState } from "react";
import { MV } from "../theme";

const CONNECTION_OPTIONS = [
  { value: "usb", label: "USB" },
  { value: "network", label: "Network" },
];

const PRINTER_CONNECTION_OPTIONS = [
  { value: "usb", label: "USB" },
  { value: "network", label: "Network" },
  { value: "universal", label: "Universal Print" },
];

function SelectRow({ label, value, options, onChange }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase block mb-1" style={{ color: MV.textMuted }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-xs rounded outline-none cursor-pointer"
        style={{ border: `1px solid ${MV.gray200}`, color: MV.text, backgroundColor: MV.white }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function InputRow({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase block mb-1" style={{ color: MV.textMuted }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-xs rounded outline-none"
        style={{ border: `1px solid ${MV.gray200}`, color: MV.text }}
      />
    </div>
  );
}

export function ScannerConfig({ config, onChange, onClose }) {
  return (
    <Popout title="Scanner Configuration" onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <SelectRow label="Connection" value={config.connection} options={CONNECTION_OPTIONS} onChange={(v) => onChange({ ...config, connection: v })} />
        {config.connection === "network" && (
          <InputRow label="IP Address / Hostname" value={config.host || ""} onChange={(v) => onChange({ ...config, host: v })} placeholder="192.168.1.100" />
        )}
        <InputRow label="Device Name" value={config.deviceName || ""} onChange={(v) => onChange({ ...config, deviceName: v })} placeholder="TWAIN device name" />
        <button
          className="mt-1 py-1.5 rounded text-xs font-semibold cursor-pointer border-none"
          style={{ backgroundColor: MV.teal, color: "#fff" }}
          onClick={() => alert("Test scan triggered")}
        >
          Test Connection
        </button>
      </div>
    </Popout>
  );
}

export function LabelPrinterConfig({ config, onChange, onClose }) {
  return (
    <Popout title="Label Printer" onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <SelectRow label="Connection" value={config.connection} options={PRINTER_CONNECTION_OPTIONS} onChange={(v) => onChange({ ...config, connection: v })} />
        {config.connection === "network" && (
          <InputRow label="IP Address / Hostname" value={config.host || ""} onChange={(v) => onChange({ ...config, host: v })} placeholder="192.168.1.101" />
        )}
        {config.connection === "universal" && (
          <InputRow label="Print Queue" value={config.queue || ""} onChange={(v) => onChange({ ...config, queue: v })} placeholder="\\\\server\\LabelPrinter" />
        )}
        <InputRow label="Printer Name" value={config.deviceName || ""} onChange={(v) => onChange({ ...config, deviceName: v })} placeholder="Zebra ZD420" />
        <button
          className="mt-1 py-1.5 rounded text-xs font-semibold cursor-pointer border-none"
          style={{ backgroundColor: MV.teal, color: "#fff" }}
          onClick={() => alert("Test print triggered")}
        >
          Test Print
        </button>
      </div>
    </Popout>
  );
}

export function LaserPrinterConfig({ config, onChange, onClose }) {
  return (
    <Popout title="Laser Printer" onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <SelectRow label="Connection" value={config.connection} options={PRINTER_CONNECTION_OPTIONS} onChange={(v) => onChange({ ...config, connection: v })} />
        {config.connection === "network" && (
          <InputRow label="IP Address / Hostname" value={config.host || ""} onChange={(v) => onChange({ ...config, host: v })} placeholder="192.168.1.102" />
        )}
        {config.connection === "universal" && (
          <InputRow label="Print Queue" value={config.queue || ""} onChange={(v) => onChange({ ...config, queue: v })} placeholder="\\\\server\\LaserPrinter" />
        )}
        <InputRow label="Printer Name" value={config.deviceName || ""} onChange={(v) => onChange({ ...config, deviceName: v })} placeholder="HP LaserJet" />
        <button
          className="mt-1 py-1.5 rounded text-xs font-semibold cursor-pointer border-none"
          style={{ backgroundColor: MV.teal, color: "#fff" }}
          onClick={() => alert("Test print triggered")}
        >
          Test Print
        </button>
      </div>
    </Popout>
  );
}

function Popout({ title, onClose, children }) {
  return (
    <div
      className="absolute top-full mt-1 right-0 z-50 rounded-lg w-64"
      style={{
        backgroundColor: MV.white,
        border: `1px solid ${MV.gray200}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${MV.gray200}`, backgroundColor: MV.gray50 }}
      >
        <span className="text-[11px] font-bold uppercase" style={{ color: MV.textMuted, letterSpacing: "0.04em" }}>
          {title}
        </span>
        <button onClick={onClose} className="text-sm cursor-pointer bg-transparent border-none" style={{ color: MV.gray400 }}>
          {"\u2715"}
        </button>
      </div>
      <div className="px-3 py-2.5">
        {children}
      </div>
    </div>
  );
}

export const DEFAULT_SCANNER_CONFIG = { connection: "usb", host: "", deviceName: "" };
export const DEFAULT_LABEL_CONFIG = { connection: "usb", host: "", queue: "", deviceName: "" };
export const DEFAULT_LASER_CONFIG = { connection: "network", host: "", queue: "", deviceName: "" };
