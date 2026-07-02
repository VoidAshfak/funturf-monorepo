import { pgClient } from "../prisma.js";
import { parseSlotCodeToTime } from "./timeAndDateFormatting.js";

/**
 * Booking domain helpers — centralised so the controller stays thin and pricing
 * is computed the SAME way for both the quote endpoint and real bookings (DRY).
 */

// The 90-minute discrete slot grid (matches the boolean columns on `slots`).
export const SLOT_CODES = Object.freeze([
    "t0000", "t0130", "t0300", "t0430", "t0600", "t0730", "t0900", "t1030",
    "t1200", "t1330", "t1500", "t1630", "t1800", "t1930", "t2100", "t2230",
]);

const SLOT_MINUTES = 90;

/** Is `code` a valid slot key on the grid? */
export const isValidSlotCode = (code) => SLOT_CODES.includes(code);

/** "18:00:00" + 90min -> "19:30:00" (end time of a slot, for display/storage). */
export function slotEndTime(slotCode) {
    const hh = parseInt(slotCode.slice(1, 3), 10);
    const mm = parseInt(slotCode.slice(3, 5), 10);
    const total = hh * 60 + mm + SLOT_MINUTES;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`;
}

/**
 * Compute the price of a single 90-min slot, applying peak/weekend rates and an
 * optional promo code. Pure pricing — availability is checked separately.
 *
 * @param {Object}  params
 * @param {Object}  params.ground       loaded grounds row
 * @param {string}  params.slotCode     e.g. "t1800"
 * @param {string}  params.bookingDate  "YYYY-MM-DD"
 * @param {string} [params.promoCode]
 * @returns {Promise<{slot_time,day_of_week,is_peak,is_weekend,base_rate,discount,final_price,promotion}>}
 */
export async function computeSlotPricing({ ground, slotCode, bookingDate, promoCode }) {
    const slot_time = parseSlotCodeToTime(slotCode);
    const js_date = new Date(bookingDate + "T00:00:00");
    const day_of_week = js_date.getUTCDay();

    const hourly_rate = Number(ground.hourly_rate);
    const weekend_rate = ground.weekend_hourly_rate ? Number(ground.weekend_hourly_rate) : hourly_rate;
    const peak_rate = ground.peak_hour_rate ? Number(ground.peak_hour_rate) : hourly_rate;
    const off_peak_rate = ground.off_peak_hour_rate ? Number(ground.off_peak_hour_rate) : hourly_rate;

    // BD weekend = Fri/Sat (day indices 5,6).
    const is_weekend = [5, 6].includes(day_of_week);

    const peak_setting = await pgClient.peak_hour_settings.findFirst({
        where: {
            ground_id: ground.id,
            day_of_week,
            is_active: true,
            start_time: { lte: new Date(`1970-01-01T${slot_time}`) },
            end_time: { gt: new Date(`1970-01-01T${slot_time}`) },
        },
    });
    const is_peak = !!peak_setting;

    let base_rate;
    if (is_peak) base_rate = peak_rate;
    else if (is_weekend) base_rate = weekend_rate;
    else base_rate = off_peak_rate;

    let discount = 0;
    let promotion = null;

    if (promoCode) {
        const candidate_promos = await pgClient.promotions.findMany({
            where: {
                ground_id: ground.id,
                code: promoCode,
                status: "active",
                valid_from: { lte: new Date() },
                valid_until: { gte: new Date() },
                usage_limit: { gt: 1 },
            },
        });

        const promo = candidate_promos.find((p) => {
            if (p.applicable_days) {
                const days = p.applicable_days;
                if (!days.includes(day_of_week)) return false;
            }
            return true;
        });

        if (promo && (!promo.minimum_booking_amount || base_rate >= Number(promo.minimum_booking_amount))) {
            let raw_discount =
                promo.discount_type === "percentage"
                    ? base_rate * (Number(promo.discount_value) / 100)
                    : Number(promo.discount_value);
            if (promo.maximum_discount_amount != null) {
                raw_discount = Math.min(raw_discount, Number(promo.maximum_discount_amount));
            }
            discount = raw_discount;
            promotion = { id: promo.id, code: promo.code };
        }
    }

    const final_price = Math.max(base_rate - discount, 0);

    return { slot_time, day_of_week, is_peak, is_weekend, base_rate, discount, final_price, promotion };
}

/**
 * Trust snapshot for an event attached to a booking — lets the turf admin judge
 * how real the game is before confirming (how many players joined, capacity,
 * organizer). Returns null if the event no longer exists.
 */
export async function getEventTrust(eventId) {
    if (!eventId) return null;

    const event = await pgClient.events.findUnique({
        where: { id: eventId },
        select: {
            id: true,
            title: true,
            event_date: true,
            start_time: true,
            end_time: true,
            min_players: true,
            max_players: true,
            current_players: true,
            status: true,
            users: {
                select: { id: true, first_name: true, last_name: true, profile_picture_url: true },
            },
        },
    });
    if (!event) return null;

    // Approved players are the confirmed squad — the strongest trust signal.
    const approved_count = await pgClient.event_participants.count({
        where: { event_id: eventId, status: "approved" },
    });

    const { users, ...rest } = event;
    return { ...rest, organizer: users, approved_count };
}
