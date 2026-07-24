// Canvas helpers behind the profile photo croppers.
//
// The cover/avatar are stored ALREADY CROPPED — the user frames the shot here and
// we upload the result, so rendering is a plain `object-cover` with no focal-point
// maths anywhere and the picture fits every screen by construction.

/** Load a data/blob URL into an <img> we can draw to a canvas. */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img));
        img.addEventListener("error", () => reject(new Error("Could not read that image")));
        // Local object URLs don't need CORS, but setting this keeps the canvas
        // untainted if the source is ever swapped for a remote URL.
        img.crossOrigin = "anonymous";
        img.src = src;
    });
}

/**
 * Read a File into an object URL for the cropper, rejecting anything that isn't a
 * reasonable image up front — a 40MB photo straight off a phone would otherwise
 * be decoded, cropped and uploaded before anyone noticed.
 *
 * @param {File} file
 * @param {number} [maxBytes] default 10MB
 * @returns {string} object URL — caller must URL.revokeObjectURL it when done
 */
export function readImageFile(file, maxBytes = 10 * 1024 * 1024) {
    if (!file) throw new Error("No file selected");
    if (!file.type?.startsWith("image/")) {
        throw new Error("Please choose an image file");
    }
    if (file.size > maxBytes) {
        throw new Error(`Image must be under ${Math.round(maxBytes / 1024 / 1024)}MB`);
    }
    return URL.createObjectURL(file);
}

/**
 * Crop `src` to `pixelCrop` (the `croppedAreaPixels` react-easy-crop hands back)
 * and return it as a JPEG blob, downscaled so we never upload a needlessly huge
 * banner.
 *
 * @param {string} src         object URL of the original image
 * @param {{x,y,width,height}} pixelCrop
 * @param {Object} [options]
 * @param {number} [options.maxWidth]  cap on the output width (height follows the crop aspect)
 * @param {number} [options.quality]   JPEG quality 0..1
 * @returns {Promise<Blob>}
 */
export async function getCroppedBlob(src, pixelCrop, { maxWidth = 1600, quality = 0.9 } = {}) {
    const image = await loadImage(src);

    // Keep the crop's aspect exactly; only scale down, never up (upscaling adds
    // bytes and blur without adding detail).
    const scale = Math.min(1, maxWidth / pixelCrop.width);
    const outWidth = Math.round(pixelCrop.width * scale);
    const outHeight = Math.round(pixelCrop.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not process that image");

    // Flatten onto white: the source may have transparency and we export JPEG,
    // where transparent pixels would otherwise come out black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outWidth, outHeight);

    ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, outWidth, outHeight
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image"))),
            "image/jpeg",
            quality
        );
    });
}

/**
 * Crop, then push the result through the existing `/api/upload` route (imgbb).
 * Returns the hosted https URL — the only thing the profile API accepts, since it
 * allowlists the image host server-side.
 *
 * @returns {Promise<string>} hosted image URL
 */
export async function cropAndUpload(src, pixelCrop, options) {
    const blob = await getCroppedBlob(src, pixelCrop, options);

    const formData = new FormData();
    // imgbb needs a filename on the part; a bare Blob is rejected.
    formData.append("image", blob, "upload.jpg");

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Image upload failed");
    }
    return data.url;
}
