import { pgClient } from "../prisma.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";


const checkAvailability = asyncHandler(async (req, res, next) => {    
    const { ground_id, date, start_time, end_time } = req.body;
    

    if (!ground_id || !date || !start_time || !end_time) {
        throw new ApiError(400, "Missing required fields: ground_id, date, start_time, end_time");
    }

    const bookingDate = new Date(date);

    if (isNaN(bookingDate.getTime())) {
        throw new ApiError(400, "Invalid date format");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
        throw new ApiError(400, "Cannot check availability for past dates");
    }

    try {
        const ground = await pgClient.grounds.findUnique({
            where: { id: ground_id },
            include: {
                turfs: {
                    select: {
                        operating_hours: true,
                        advance_booking_days: true,
                        holiday_dates: true
                    }
                }
            }
        });

        if (!ground) {
            throw new ApiError(404, "Ground not found");
        }

        if (ground.status !== 'available') {
            return res.status(200).json(
                new ApiResponse(200, "Ground is not available", {
                    available: false,
                    reason: `Ground is currently ${ground.status}`
                })
            );
        }


        const maxBookingDate = new Date();

        maxBookingDate.setDate(maxBookingDate.getDate() + ground.turfs.advance_booking_days);
        if (bookingDate > maxBookingDate) {
            throw new ApiError(400, `Cannot book more than ${ground.turfs.advance_booking_days} days in advance`);
        }

        const holidays = ground.turfs.holiday_dates || [];

        const dateStr = bookingDate.toISOString().split('T')[0];
        if (holidays.includes(dateStr)) {
            return res.status(200).json(
                new ApiResponse(200, "Turf is closed on this date", {
                    available: false,
                    reason: "Holiday"
                })
            );
        }


        const opening_time = new Date(`1970-01-01T${ground.turfs.operating_hours.open}:00`);
        const closing_time = new Date(`1970-01-01T${ground.turfs.operating_hours.open}:00`);
        const booking_start_time = new Date(`1970-01-01T${start_time}`);
        const booking_end_time = new Date(`1970-01-01T${end_time}`);

        if (booking_start_time < opening_time || booking_end_time > closing_time) {
            return res.status(200).json(
                new ApiResponse(200, "Time slot outside operating hours", {
                    available: false,
                    reason: `Operating hours: ${ground.turfs.operating_hours.open} - ${ground.turfs.operating_hours.close}`
                })
            );
        }


        const existingBookings = await pgClient.bookings.findMany({
            where: {
                ground_id,
                booking_date: bookingDate,
                booking_status: {
                    in: ['confirmed', 'pending']
                },
                OR: [
                    {
                        AND: [
                            { start_time: { lte: start_time } },
                            { end_time: { gt: start_time } }
                        ]
                    },
                    {
                        AND: [
                            { start_time: { lt: end_time } },
                            { end_time: { gte: end_time } }
                        ]
                    },
                    {
                        AND: [
                            { start_time: { gte: start_time } },
                            { end_time: { lte: end_time } }
                        ]
                    }
                ]
            }
        });

        const isAvailable = existingBookings?.length === 0;


        // const dayBookings = await pgClient.bookings.findMany({
        //     where: {
        //         ground_id,
        //         booking_date: bookingDate,
        //         booking_status: {
        //             in: ['confirmed', 'pending']
        //         }
        //     },
        //     orderBy: { start_time: 'asc' },
        //     select: {
        //         start_time: true,
        //         end_time: true,
        //         booking_status: true
        //     }
        // });

        req.availability = {
            available: isAvailable,
            requested_slot: { date, start_time, end_time },
            // existing_bookings: dayBookings,
            // available_slots: availableSlots,
            pricing: {
                hourly_rate: ground.hourly_rate,
                weekend_rate: ground.weekend_hourly_rate,
                peak_rate: ground.peak_hour_rate,
                off_peak_rate: ground.off_peak_hour_rate
            }
        }


        next();
    } catch (error) {
        console.log(error);
    }
})


export {
    checkAvailability
}