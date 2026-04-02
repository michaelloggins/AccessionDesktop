/**
 * ScanUpload — Document capture component.
 *
 * Provides two input methods:
 *   1. File upload (drag & drop or click to browse)
 *   2. TWAIN scanner capture (when available)
 */

import { useState, useRef, useCallback } from "react";

export default function ScanUpload({ onUpload, loading }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) {
        onUpload(e.dataTransfer.files[0]);
      }
    },
    [onUpload],
  );

  const handleChange = useCallback(
    (e) => {
      if (e.target.files?.[0]) {
        onUpload(e.target.files[0]);
      }
    },
    [onUpload],
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">
        Scan or Upload Document
      </h2>

      {/* Drop zone */}
      <div
        className={`relative rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        } ${loading ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
          onChange={handleChange}
        />

        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-gray-600">
            <span className="font-medium text-blue-600">Click to upload</span>{" "}
            or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            PDF, PNG, JPEG, or TIFF
          </p>
        </div>
      </div>

      {/* TWAIN Scanner button */}
      <button
        disabled={loading}
        className="w-full rounded-lg bg-gray-800 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        onClick={() => {
          // TWAIN capture — calls /api/scan/capture
          alert("TWAIN scanner capture coming soon. Use file upload for now.");
        }}
      >
        Capture from Scanner (TWAIN)
      </button>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Processing document with AI...
        </div>
      )}
    </div>
  );
}
