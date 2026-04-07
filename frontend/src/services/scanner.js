/**
 * scanner.js — Web TWAIN service wrapper for Dynamsoft Web TWAIN SDK.
 *
 * Provides init, device enumeration, scanning with settings, and image retrieval.
 * Requires Dynamsoft Service to be installed on the workstation.
 *
 * Usage:
 *   import { scannerService } from "../services/scanner";
 *   await scannerService.init();
 *   const devices = scannerService.getSourceNames();
 *   const images = await scannerService.scan({ ... });
 */

import Dynamsoft from "dwt";

// Map our UI values to TWAIN pixel type enums
const PIXEL_TYPE_MAP = {
  color: Dynamsoft.DWT.EnumDWT_PixelType.TWPT_RGB,
  grayscale: Dynamsoft.DWT.EnumDWT_PixelType.TWPT_GRAY,
  bw: Dynamsoft.DWT.EnumDWT_PixelType.TWPT_BW,
};

// Map paper size strings to TWAIN page size enums
// See: Dynamsoft.DWT.EnumDWT_CapSupportedSizes
const PAGE_SIZE_MAP = {
  letter: 1,   // TWSS_USLETTER
  legal: 4,    // TWSS_USLEGAL
  a4: 11,      // TWSS_A4  (Note: actual enum value may vary; 1=letter, 4=legal, 11=A4 in TWAIN spec)
  auto: 0,     // TWSS_NONE — let scanner auto-detect
};

/**
 * Singleton scanner service that wraps a Dynamsoft Web TWAIN instance.
 */
class ScannerService {
  constructor() {
    this._dwt = null;           // The WebTwain object
    this._ready = false;
    this._initPromise = null;
    this._statusCallback = null; // Called with "online" | "offline" | "busy"
    this._containerId = "dwt-scanner-container";
  }

  /**
   * Register a callback that receives scanner status changes.
   * @param {(status: "online"|"offline"|"busy") => void} cb
   */
  onStatusChange(cb) {
    this._statusCallback = cb;
  }

  _setStatus(status) {
    if (this._statusCallback) {
      this._statusCallback(status);
    }
  }

  /**
   * Initialize the Web TWAIN SDK. Returns a promise that resolves when ready.
   * Safe to call multiple times — will only initialize once.
   */
  init() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      // Ensure the hidden container element exists in the DOM
      if (!document.getElementById(this._containerId)) {
        const el = document.createElement("div");
        el.id = this._containerId;
        el.style.display = "none";
        document.body.appendChild(el);
      }

      // Configure Dynamsoft before loading
      // Trial key — replace with production key for deployment
      Dynamsoft.DWT.ProductKey = "t0199AQEAAP6WT+6dn1ICd3GZh+wQMFFlTxdwkLAxQwJrxAAAAGR7VL5UbV0LgVDSfHl5wVm7BUPXHEJ/w6gq07GYHpzqGDG2y/Ic5iYeBsaKIRlc3RfYXBw";
      Dynamsoft.DWT.ResourcesPath = "/dwt-resources";
      Dynamsoft.DWT.AutoLoad = false;

      // Use CreateDWTObjectEx for headless (no visible viewer) operation
      Dynamsoft.DWT.CreateDWTObjectEx(
        { WebTwainId: "mvd-scanner" },
        (dwt) => {
          this._dwt = dwt;
          this._ready = true;
          this._setStatus("online");
          console.log("[ScannerService] Web TWAIN initialized successfully");
          resolve(dwt);
        },
        (errorMessage) => {
          this._ready = false;
          this._setStatus("offline");
          console.error("[ScannerService] Web TWAIN init failed:", errorMessage);
          // Don't reject — allow the app to work without scanner
          // The UI will show offline status
          resolve(null);
        }
      );
    });

    return this._initPromise;
  }

  /**
   * Check if the TWAIN instance is ready.
   */
  isReady() {
    return this._ready && this._dwt != null;
  }

  /**
   * Get the raw DWT object (for advanced usage).
   */
  getDWT() {
    return this._dwt;
  }

  /**
   * List available TWAIN scanner source names.
   * @returns {string[]} Array of scanner device names
   */
  getSourceNames() {
    if (!this._dwt) return [];
    try {
      return this._dwt.GetSourceNames() || [];
    } catch (e) {
      console.error("[ScannerService] GetSourceNames failed:", e);
      return [];
    }
  }

  /**
   * Select a scanner source by name.
   * @param {string} name - The TWAIN source name
   * @returns {boolean} success
   */
  selectSource(name) {
    if (!this._dwt) return false;
    try {
      const sources = this._dwt.GetSourceNames();
      const idx = sources.indexOf(name);
      if (idx >= 0) {
        this._dwt.SelectSourceByIndex(idx);
        return true;
      }
      return false;
    } catch (e) {
      console.error("[ScannerService] selectSource failed:", e);
      return false;
    }
  }

  /**
   * Perform a scan with the given settings.
   *
   * @param {Object} settings - Scanner settings from the UI
   * @param {string} settings.colorMode - "color" | "grayscale" | "bw"
   * @param {string} settings.dpi - DPI as string, e.g. "200"
   * @param {string} settings.paperSize - "letter" | "legal" | "a4" | "auto"
   * @param {string} settings.source - "adf" | "flatbed"
   * @param {boolean} settings.duplex - Enable duplex scanning
   * @param {string} [settings.deviceName] - Specific scanner to use (optional)
   *
   * @returns {Promise<{ images: Blob[], pageCount: number }>}
   */
  async scan(settings = {}) {
    if (!this._dwt) {
      throw new Error("Scanner not initialized. Is Dynamsoft Service running?");
    }

    this._setStatus("busy");

    try {
      // If a specific device is requested, select it
      if (settings.deviceName) {
        this.selectSource(settings.deviceName);
      }

      // Build acquisition config from settings
      const pixelType = PIXEL_TYPE_MAP[settings.colorMode] ?? PIXEL_TYPE_MAP.grayscale;
      const resolution = parseInt(settings.dpi, 10) || 200;
      const feederEnabled = settings.source !== "flatbed";
      const duplexEnabled = !!settings.duplex;

      // Open the source
      await this._dwt.SelectSourceAsync();

      // Acquire with settings
      await this._dwt.AcquireImageAsync({
        IfCloseSourceAfterAcquire: true,
        IfShowUI: false,
        PixelType: pixelType,
        Resolution: resolution,
        IfFeederEnabled: feederEnabled,
        IfDuplexEnabled: duplexEnabled,
      });

      // Retrieve scanned images from the buffer
      const pageCount = this._dwt.HowManyImagesInBuffer;
      console.log(`[ScannerService] Scanned ${pageCount} page(s)`);

      if (pageCount === 0) {
        this._setStatus("online");
        return { images: [], pageCount: 0 };
      }

      // Convert all pages to blobs (PNG format for preview)
      const images = [];
      for (let i = 0; i < pageCount; i++) {
        const blob = await this._getImageBlob(i);
        if (blob) images.push(blob);
      }

      this._setStatus("online");
      return { images, pageCount };
    } catch (error) {
      this._setStatus("online");
      throw new Error(`Scan failed: ${error.message || error}`);
    }
  }

  /**
   * Get a single image from the buffer as a Blob.
   * @param {number} index - Image index in the buffer
   * @returns {Promise<Blob>}
   */
  _getImageBlob(index) {
    return new Promise((resolve, reject) => {
      try {
        this._dwt.ConvertToBlob(
          [index],
          Dynamsoft.DWT.EnumDWT_ImageType.IT_PNG,
          (result) => {
            resolve(result);
          },
          (errorCode, errorString) => {
            console.error("[ScannerService] ConvertToBlob failed:", errorString);
            reject(new Error(errorString));
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Get a single image from the buffer as a base64 data URL.
   * @param {number} index - Image index in the buffer
   * @returns {Promise<string>} data:image/png;base64,...
   */
  getImageBase64(index) {
    return new Promise((resolve, reject) => {
      try {
        this._dwt.ConvertToBase64(
          [index],
          Dynamsoft.DWT.EnumDWT_ImageType.IT_PNG,
          (result) => {
            const base64 = result.getData(0, result.getLength());
            resolve(`data:image/png;base64,${base64}`);
          },
          (errorCode, errorString) => {
            reject(new Error(errorString));
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Clear all images from the buffer.
   */
  clearBuffer() {
    if (this._dwt) {
      try {
        this._dwt.RemoveAllImages();
      } catch (e) {
        console.error("[ScannerService] clearBuffer failed:", e);
      }
    }
  }

  /**
   * Get the number of images currently in the buffer.
   */
  getImageCount() {
    return this._dwt ? this._dwt.HowManyImagesInBuffer : 0;
  }

  /**
   * Destroy the Web TWAIN instance and clean up.
   */
  destroy() {
    if (this._dwt) {
      try {
        Dynamsoft.DWT.DeleteDWTObject(this._dwt.WebTwainId);
      } catch (e) {
        // Ignore cleanup errors
      }
      this._dwt = null;
      this._ready = false;
      this._initPromise = null;
      this._setStatus("offline");
    }
  }
}

// Export a singleton instance
export const scannerService = new ScannerService();
export default scannerService;
