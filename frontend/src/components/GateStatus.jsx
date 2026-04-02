/**
 * GateStatus — Displays gate check results with pass/warn/fail indicators.
 *
 * Shows a supervisor override modal when a gate returns "warn" with allow_override.
 */

import { useState } from "react";

const STATUS_STYLES = {
  pass: "bg-green-100 text-green-800 border-green-200",
  warn: "bg-yellow-100 text-yellow-800 border-yellow-200",
  fail: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_ICONS = {
  pass: "\u2713",
  warn: "\u26A0",
  fail: "\u2717",
};

export default function GateStatus({ gateResults, onOverride }) {
  const [overrideModal, setOverrideModal] = useState(null);

  if (!gateResults || Object.keys(gateResults).length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Gate Checks</h3>

      {Object.entries(gateResults).map(([gateId, gate]) => (
        <div
          key={gateId}
          className={`rounded-lg border p-3 ${STATUS_STYLES[gate.result] || STATUS_STYLES.fail}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {STATUS_ICONS[gate.result]} {gate.gate_id}
            </span>

            {gate.result === "warn" && gate.allow_override && !gate.override && (
              <button
                onClick={() => setOverrideModal(gateId)}
                className="rounded bg-yellow-600 px-2 py-1 text-xs text-white hover:bg-yellow-700"
              >
                Supervisor Override
              </button>
            )}

            {gate.override && (
              <span className="text-xs">
                Overridden by {gate.override.override_by}
              </span>
            )}
          </div>

          {gate.checks?.map((check, i) => (
            <p key={i} className="mt-1 text-xs">
              {STATUS_ICONS[check.result]} {check.message}
            </p>
          ))}
        </div>
      ))}

      {/* Override Modal */}
      {overrideModal && (
        <OverrideModal
          gateId={overrideModal}
          onConfirm={(supervisorId, reason) => {
            onOverride(overrideModal, supervisorId, reason);
            setOverrideModal(null);
          }}
          onCancel={() => setOverrideModal(null)}
        />
      )}
    </div>
  );
}

function OverrideModal({ gateId, onConfirm, onCancel }) {
  const [supervisorId, setSupervisorId] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">Supervisor Override</h3>
        <p className="mb-4 text-sm text-gray-600">
          Gate <strong>{gateId}</strong> requires supervisor approval to
          continue.
        </p>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Supervisor ID
          </label>
          <input
            type="text"
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Override Reason
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(supervisorId, reason)}
            disabled={!supervisorId || !reason}
            className="flex-1 rounded bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            Approve Override
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
