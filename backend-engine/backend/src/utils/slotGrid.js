/**
 * The fixed 90-minute slot grid — the one definition of what a bookable slot IS.
 *
 * Lives on its own (rather than inside bookingService) so both the booking layer
 * and the operating-hours gate can read it without importing each other. Keep the
 * frontend mirror `frontend-engine/src/utils/slots.js` in sync with this list.
 */

/** Slot keys, matching the boolean columns on the `slots` table. */
export const SLOT_CODES = Object.freeze([
    "t0000", "t0130", "t0300", "t0430", "t0600", "t0730", "t0900", "t1030",
    "t1200", "t1330", "t1500", "t1630", "t1800", "t1930", "t2100", "t2230",
]);

/** Every slot is 90 minutes long. */
export const SLOT_MINUTES = 90;

/** Is `code` a valid slot key on the grid? */
export const isValidSlotCode = (code) => SLOT_CODES.includes(code);

/** "t2230" -> 1350 (minutes since midnight). */
export const slotStartMinute = (code) =>
    Number(code.slice(1, 3)) * 60 + Number(code.slice(3, 5));

/** "t1800" + 90min -> "19:30:00" (end time of a slot, for display/storage). */
export function slotEndTime(slotCode) {
    const total = slotStartMinute(slotCode) + SLOT_MINUTES;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`;
}
