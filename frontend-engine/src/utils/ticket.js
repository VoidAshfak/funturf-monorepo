// Ticket helpers shared by the player's printable receipt and the turf admin's
// verify/check-in screens. The booking id (a random UUID) is the ticket's real
// identity; the short reference and QR payload are derived from the booking.

/**
 * Human-readable booking reference, e.g. "FT-7K3QX9A1" — the first 8 hex of the
 * id. Shown on the receipt and typed in for MANUAL verification. It's a display
 * / lookup handle only; every actual confirm is done server-side against the
 * full id with turf-ownership checks.
 */
export function bookingRef(bookingId) {
    if (!bookingId) return "FT-—";
    return `FT-${String(bookingId).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/**
 * The exact booking, encoded as compact JSON for the ticket QR. Scanning it in
 * the admin panel yields the booking id (plus a snapshot for instant display).
 *
 * The snapshot is NOT trusted for the decision — the scanner resolves the id
 * against the backend, which re-checks turf ownership + confirmed status and is
 * single-use. So a hand-crafted QR can't check anyone in; the encoded data just
 * saves a round-trip for showing "who / when / which slot".
 */
export function ticketQrData(booking) {
    if (!booking?.id) return "";
    return JSON.stringify({
        v: 1, // payload version, so a future format change stays readable
        id: booking.id,
        ref: bookingRef(booking.id),
        d: booking.booking_date ?? null,
        s: booking.slot?.code ?? null,
        g: booking.grounds?.name ?? null,
        t: booking.grounds?.turfs?.name ?? null,
        amt: Number(booking.final_amount ?? 0),
    });
}

/**
 * Decode whatever a scanner produced back into a booking id.
 * Accepts our JSON payload, a bare UUID, or an old verify URL — returns the id
 * string or null if nothing usable is found.
 */
export function parseTicketScan(text) {
    if (!text) return null;
    const raw = String(text).trim();

    // 1) Our JSON payload.
    try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.id === "string") return obj.id;
    } catch {
        // not JSON — fall through
    }

    // 2) A verify URL like /dashboard/bookings/verify/<id>.
    const urlMatch = raw.match(/verify\/([0-9a-fA-F-]{36})/);
    if (urlMatch) return urlMatch[1];

    // 3) A bare UUID.
    const uuid = raw.match(/[0-9a-fA-F-]{36}/);
    return uuid ? uuid[0] : null;
}

/**
 * Normalize manual reference input into the 8-hex lookup code the backend
 * expects, or null if it isn't a valid reference. Accepts "FT-7K3QX9A1",
 * "7k3qx9a1", with or without spaces/dashes.
 */
export function normalizeRefInput(input) {
    if (!input) return null;
    const hex = String(input)
        .trim()
        .toLowerCase()
        .replace(/^ft/, "") // drop the FT prefix if present
        .replace(/[^0-9a-f]/g, ""); // keep hex only
    return /^[0-9a-f]{8}$/.test(hex) ? hex : null;
}
