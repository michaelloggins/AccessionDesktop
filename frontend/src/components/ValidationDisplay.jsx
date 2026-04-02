/**
 * ValidationDisplay — Shows validation errors and warnings before submit.
 */

export default function ValidationDisplay({ validation, onBack }) {
  if (!validation) return null;

  const errors = validation.errors?.filter((e) => e.severity === "error") || [];
  const warnings =
    validation.errors?.filter((e) => e.severity === "warning") || [];

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-800">
            Errors (must fix before submit)
          </h3>
          <ul className="space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="text-sm text-red-700">
                <span className="font-mono text-xs">{e.field}</span>: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-yellow-800">
            Warnings
          </h3>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-sm text-yellow-700">
                <span className="font-mono text-xs">{w.field}</span>:{" "}
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <button
          onClick={onBack}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Form
        </button>
      )}
    </div>
  );
}
