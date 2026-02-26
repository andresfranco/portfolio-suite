/**
 * Client-side image compression utilities for the public website.
 *
 * Uses the browser Canvas API — no external libraries required.
 *
 * Supported input formats: JPEG, PNG, WebP.
 * GIF files are returned unchanged (animated GIF frames cannot be
 * reliably round-tripped through Canvas).
 */

/** Threshold in bytes below which we skip compression (already small). */
const SKIP_THRESHOLD = 200 * 1024; // 200 KB

/**
 * Format a byte count as a human-readable string (e.g. "1.4 MB", "340 KB").
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Return a compression hint object for the given file without modifying anything.
 *
 * @param {File} file
 * @returns {{ willCompress: boolean, severity: 'none' | 'info' | 'warning', label: string }}
 */
export function getCompressionHint(file) {
  if (!file) return { willCompress: false, severity: 'none', label: '' };

  const isGif = file.type === 'image/gif';
  const isSvg = file.type === 'image/svg+xml';

  if (isGif || isSvg || file.size <= SKIP_THRESHOLD) {
    return { willCompress: false, severity: 'none', label: '' };
  }

  if (file.size > 1024 * 1024) {
    return {
      willCompress: true,
      severity: 'warning',
      label: `Large image (${formatBytes(file.size)}) — will be compressed before upload`,
    };
  }

  return {
    willCompress: true,
    severity: 'info',
    label: `Image (${formatBytes(file.size)}) will be optimised before upload`,
  };
}

/**
 * Compress and resize an image file using the browser Canvas API.
 *
 * PNG files that contain an alpha channel are kept as PNG; all others
 * (including PNG without transparency) are re-encoded as JPEG for better
 * compression.  GIF files are returned unchanged.
 *
 * @param {File} file - The original image file.
 * @param {object} [options]
 * @param {number} [options.maxWidth=1920]  - Maximum output width in pixels.
 * @param {number} [options.maxHeight=1080] - Maximum output height in pixels.
 * @param {number} [options.quality=0.85]   - JPEG quality (0.0 – 1.0).
 * @returns {Promise<{ file: File, originalSize: number, compressedSize: number }>}
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
  } = options;

  const originalSize = file.size;

  // Pass GIF and SVG through unchanged
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return { file, originalSize, compressedSize: file.size };
  }

  // Small files can skip compression
  if (file.size <= SKIP_THRESHOLD) {
    return { file, originalSize, compressedSize: file.size };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // ── Determine output dimensions ───────────────────────────────────────
      let { naturalWidth: w, naturalHeight: h } = img;

      if (w > maxWidth || h > maxHeight) {
        const ratio = Math.min(maxWidth / w, maxHeight / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      // ── Draw onto canvas ──────────────────────────────────────────────────
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // ── Detect alpha (PNG only) ───────────────────────────────────────────
      let outputType = 'image/jpeg';
      if (file.type === 'image/png') {
        const pixelData = ctx.getImageData(0, 0, w, h).data;
        let hasAlpha = false;
        for (let i = 3; i < pixelData.length; i += 4) {
          if (pixelData[i] < 255) {
            hasAlpha = true;
            break;
          }
        }
        outputType = hasAlpha ? 'image/png' : 'image/jpeg';
      }

      // ── Encode ────────────────────────────────────────────────────────────
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ file, originalSize, compressedSize: file.size });
            return;
          }

          const ext = outputType === 'image/jpeg' ? '.jpg' : '.png';
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const newName = `${baseName}${ext}`;

          const compressedFile = new File([blob], newName, {
            type: outputType,
            lastModified: Date.now(),
          });

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize: compressedFile.size,
          });
        },
        outputType,
        outputType === 'image/png' ? undefined : quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ file, originalSize, compressedSize: file.size });
    };

    img.src = objectUrl;
  });
}

/**
 * Return (maxWidth, maxHeight) based on the image category name.
 *
 * Mirrors the server-side logic in ``image_utils.py :: get_dimensions_for_category``.
 *
 * @param {string} [categoryCode]
 * @returns {[number, number]}
 */
export function getDimensionsForCategory(categoryCode) {
  if (!categoryCode) return [1920, 1080];

  const code = categoryCode.toUpperCase();

  if (code.includes('LOGO') || code.includes('ICON')) return [800, 800];
  if (code.includes('THUMB') || code.includes('THUMBNAIL')) return [800, 600];

  return [1920, 1080];
}
