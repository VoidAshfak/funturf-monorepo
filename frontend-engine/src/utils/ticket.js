// Ticket helpers shared by the player's printable receipt and the turf admin's
// verify/check-in screens. The booking id is the ticket's real identity; the QR
// payload is built from the booking, and the short reference comes from the API.

/**
 * Human-readable booking reference, e.g. "FT-7K3QX9A1". Shown on the receipt and
 * typed in for MANUAL verification. It's a display / lookup handle only; every
 * actual confirm is done server-side against the full id with turf-ownership
 * checks.
 *
 * The API sends this as `booking.ref` — it used to be derived here from the id,
 * but the id on the wire is now a masked public token rather than the database
 * UUID the reference is a prefix of, so only the server can compute it. See
 * `withBookingRef` in the backend's utils/bookingService.js.
 */
export function bookingRef(booking) {
    return booking?.ref ?? "FT-—";
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
        id: booking.id, // the masked public id — the scanner sends it straight back
        ref: bookingRef(booking),
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

    // 2) A verify URL like /dashboard/bookings/verify/<id>. Both id forms are
    //    accepted: the 22-char masked token that current links carry, and the
    //    36-char UUID that older printed tickets still have on them. The API
    //    takes either, so an already-printed ticket keeps scanning.
    const urlMatch = raw.match(/verify\/([A-Za-z0-9_-]{22}|[0-9a-fA-F-]{36})/);
    if (urlMatch) return urlMatch[1];

    // 3) A bare id, in either form. UUID is tried first so that a 36-char string
    //    is never chopped down to its first 22 characters.
    const bare = raw.match(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}/) ?? raw.match(/^[A-Za-z0-9_-]{22}$/);
    return bare ? bare[0] : null;
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
