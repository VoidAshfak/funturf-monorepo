// Canvas helpers behind the profile photo croppers.
//
// The cover/avatar are stored ALREADY CROPPED — the user frames the shot here and
// we upload the result, so rendering is a plain `object-cover` with no focal-point
// maths and the picture fits every screen by construction.
//
// RESOLUTION POLICY: the crop is exported at its NATIVE pixel size. Whatever
// region the user selected out of the original file is what gets uploaded, pixel
// for pixel — no resampling at all in the common case. We only ever scale DOWN,
// never up, and only when the result would be too large to upload (see
// `MAX_UPLOAD_BYTES`). Delivery-side resizing is Next.js's job: `next/image`
// serves a right-sized variant per breakpoint, so storing a large original costs
// nothing at render time and keeps the banner sharp on HiDPI screens.

/** Above this the upload gets progressively degraded rather than rejected. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Absolute ceiling on a stored image's width — a guard, not a target. */
const HARD_MAX_WIDTH = 5000;

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
 * reasonable image up front.
 *
 * The limit is generous on purpose — we WANT the full-resolution original here,
 * because that's what the crop is cut from. Shrinking at this stage would throw
 * away the detail the whole policy above exists to keep.
 *
 * @param {File} file
 * @param {number} [maxBytes] default 25MB
 * @returns {string} object URL — caller must URL.revokeObjectURL it when done
 */
export function readImageFile(file, maxBytes = 25 * 1024 * 1024) {
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
 * What the exported image will actually measure, given the selected region.
 * Used by the crop dialog to show the user the output resolution before they
 * commit — so "did this lose quality?" is answerable on screen, not a guess.
 *
 * @param {{width:number, height:number}} pixelCrop
 * @param {number} [maxWidth]
 * @returns {{ width:number, height:number, scaled:boolean }}
 */
export function cropOutputSize(pixelCrop, maxWidth = HARD_MAX_WIDTH) {
    if (!pixelCrop?.width) return { width: 0, height: 0, scaled: false };

    // Only ever shrink. Upscaling adds bytes and blur without adding detail.
    const scale = Math.min(1, maxWidth / pixelCrop.width);
    return {
        width: Math.round(pixelCrop.width * scale),
        height: Math.round(pixelCrop.height * scale),
        scaled: scale < 1,
    };
}

/** Draw the selected region onto a canvas of the given output width. */
function renderCrop(image, pixelCrop, outWidth) {
    const ratio = outWidth / pixelCrop.width;
    const outHeight = Math.round(pixelCrop.height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not process that image");

    // Browsers default to fast/low-quality resampling. When we DO have to scale
    // (an oversized source, or a size-driven retry), this is the difference
    // between a crisp banner and a soft one.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Flatten onto white: the source may have transparency and we export JPEG,
    // where transparent pixels would otherwise come out black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outWidth, outHeight);

    ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, outWidth, outHeight
    );

    return canvas;
}

/** Promise wrapper around canvas.toBlob. */
function toBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image"))),
            type,
            quality
        );
    });
}

/**
 * Crop `src` to `pixelCrop` (the `croppedAreaPixels` react-easy-crop hands back)
 * and return it as a JPEG blob at the crop's native resolution.
 *
 * If the result would be too big to upload, it degrades in the order that costs
 * the least visible quality: first the JPEG quality, and only then the pixel
 * dimensions. Dimensions are the last thing sacrificed because that's the loss
 * you can actually see on a wide banner.
 *
 * @param {string} src         object URL of the original image
 * @param {{x,y,width,height}} pixelCrop
 * @param {Object} [options]
 * @param {number} [options.maxWidth] ceiling on output width (default: none beyond the hard guard)
 * @param {number} [options.quality]  starting JPEG quality 0..1
 * @param {number} [options.maxBytes] upload size budget
 * @returns {Promise<Blob>}
 */
export async function getCroppedBlob(
    src,
    pixelCrop,
    { maxWidth = HARD_MAX_WIDTH, quality = 0.95, maxBytes = MAX_UPLOAD_BYTES } = {}
) {
    const image = await loadImage(src);
    const { width } = cropOutputSize(pixelCrop, Math.min(maxWidth, HARD_MAX_WIDTH));

    let canvas = renderCrop(image, pixelCrop, width);
    let blob = await toBlob(canvas, "image/jpeg", quality);

    // 1) Trade encoder quality first — cheap, and far less visible than resizing.
    for (const q of [0.88, 0.8, 0.72]) {
        if (blob.size <= maxBytes) break;
        blob = await toBlob(canvas, "image/jpeg", q);
    }

    // 2) Only if that wasn't enough, start giving up pixels.
    let currentWidth = width;
    while (blob.size > maxBytes && currentWidth > 1280) {
        currentWidth = Math.round(currentWidth * 0.8);
        canvas = renderCrop(image, pixelCrop, currentWidth);
        blob = await toBlob(canvas, "image/jpeg", 0.85);
    }

    return blob;
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
