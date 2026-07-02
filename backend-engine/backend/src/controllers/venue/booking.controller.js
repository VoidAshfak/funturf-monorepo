import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { logger } from "../../../logs/logger.js";
import { pgClient } from "../../prisma.js";
import { minutesToTimeString, slotKeyToMinutes, parseSlotCodeToTime } from "../../utils/timeAndDateFormatting.js";

export const getAvailableSlots = asyncHandler(async (req, res) => {
    const { ground, date } = req.query;
    logger.info(`Received request to get available slots for ground ${ground} on ${date}`);

    if (!ground || !date) {
        // NOTE: winston's method is `warn`, not `warning` — calling `warning`
        // throws a TypeError and turned this into a 500 instead of a 400.
        logger.warn(`Did not receive query parameters properly`);
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "ground and date query parameters are required",
        });
    } else {
        logger.info(`Received request to get available slots for ground ${ground} on ${date}`);
    }

    const availableSlots = await pgClient.slots.findUnique({
        where: {
            ground_id_date: {
                ground_id: ground,
                date: new Date(date)
            }
        }
    });

    if (!availableSlots) {
        logger.warn(`No available slots found for ground ${ground} on ${date}`);
        throw ApiError.fromCode(ERROR_CODES.SLOT_NOT_FOUND);
    } else {
        logger.info(`Available slots found for ground ${ground} on ${date}`);
    }

    return res.status(200).json(
        new ApiResponse(200, "Available slots found", availableSlots)
    );

})

export const calculateBookingPrice = asyncHandler(async (req, res) => {

    const { ground_id, slot, booking_date, promo_code } = req.query;
    // const user_id = req.user?.id || '8806583a-1630-4ab3-a93b-94f5f432cc14'

    if (!ground_id || !slot || !booking_date) {
        logger.warn(`Did not receive query parameters properly`);
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "ground_id, slot and booking_date query parameters are required",
        });
    } else {
        logger.info(`Received request to get booking price for ground ${ground_id} on ${booking_date}`);
    }

    const slot_row = await pgClient.slots.findUnique({
        where: {
            ground_id_date: {
                ground_id,
                date: new Date(booking_date)
            }
        }
    })

    if (!slot_row) {
        logger.error(JSON.stringify({ isAvailable: false, reason: "slot_disabled" }));
        throw ApiError.fromCode(ERROR_CODES.SLOT_NOT_FOUND);
    }

    const slot_available = Boolean((slot_row)[slot]);
    if (!slot_available) {
        logger.info(JSON.stringify({ isAvailable: false, reason: "slot_already_booked" }))
        throw ApiError.fromCode(ERROR_CODES.SLOT_UNAVAILABLE);
    }

    const slot_time = parseSlotCodeToTime(slot);
    const js_date = new Date(booking_date + "T00:00:00");
    const day_of_week = js_date.getUTCDay();

    const ground = await pgClient.grounds.findUnique({
        where: { id: ground_id },
    });

    if (!ground) {
        logger.error(JSON.stringify({ isAvailable: false, reason: "ground_not_found" }));
        throw ApiError.fromCode(ERROR_CODES.GROUND_NOT_FOUND);
    }

    const hourly_rate = Number(ground.hourly_rate);

    const weekend_rate = ground.weekend_hourly_rate
        ? Number(ground.weekend_hourly_rate)
        : hourly_rate;

    const peak_rate = ground.peak_hour_rate
        ? Number(ground.peak_hour_rate)
        : hourly_rate;

    const off_peak_rate = ground.off_peak_hour_rate
        ? Number(ground.off_peak_hour_rate)
        : hourly_rate;

    const is_weekend = [5, 6].includes(day_of_week);

    const peak_setting = await pgClient.peak_hour_settings.findFirst({
        where: {
            ground_id,
            day_of_week,
            is_active: true,
            start_time: { lte: new Date(`1970-01-01T${slot_time}`)},
            end_time: { gt: new Date(`1970-01-01T${slot_time}`) },
        },
    });
    const is_peak = !!peak_setting;


    let base_rate;
    if (is_peak) base_rate = peak_rate;
    else if (is_weekend) base_rate = weekend_rate;
    else base_rate = off_peak_rate;



    let discount = 0;
    let promo_meta = null;

    if (promo_code) {
        const candidate_promos = await pgClient.promotions.findMany({
            where: {
                ground_id,
                code: promo_code,
                status: 'active',
                valid_from: { lte: new Date() },
                valid_until: { gte: new Date() },
                usage_limit: { gt: 1 }
            },
        })

        logger.info(JSON.stringify(candidate_promos));

        const promo = candidate_promos.find((p) => {
            if (p.applicable_days) {
                const days = p.applicable_days;
                if (!days.includes(day_of_week)) return false;
            }
            return true;
        })

        if (promo) {
            // if (
            //     promo.usage_limit != null &&
            //     promo.used_count != null &&
            //     promo.used_count >= promo.usage_limit
            // ) {
            //     // exhausted – ignore
            // } 
            if (
                !promo.minimum_booking_amount ||
                base_rate >= Number(promo.minimum_booking_amount)
            ) {
                let raw_discount = 0;
                if (promo.discount_type === "percentage") {
                    raw_discount = base_rate * (Number(promo.discount_value) / 100);
                } else {
                    raw_discount = Number(promo.discount_value);
                }

                if (promo.maximum_discount_amount != null) {
                    raw_discount = Math.min(
                        raw_discount,
                        Number(promo.maximum_discount_amount)
                    );
                }

                if(raw_discount > 0) {
                    logger.info(`Promo code applied`);
                }

                discount = raw_discount;
                promo_meta = { id: promo.id, code: promo.code };

            }
        }
    }
    const final_price = Math.max(base_rate - discount, 0);

    logger.info(JSON.stringify(
        {
            isAvailable: true,
            reason: null,
            slot,
            booking_date,
            slot_time,
            day_of_week,
            is_peak,
            is_weekend,
            base_rate,
            discount,
            final_price,
            promotion: promo_meta,
        }
    ))

    return res.json(
        new ApiResponse(200, "Success", {
            isAvailable: true,
            reason: null,
            slot,
            booking_date,
            slot_time,
            day_of_week,
            is_peak,
            is_weekend,
            base_rate,
            discount,
            final_price,
            promotion: promo_meta,
        })
    );

})

export const createBooking = asyncHandler(async (req, res) => {});