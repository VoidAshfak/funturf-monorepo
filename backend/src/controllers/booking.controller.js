import { pgClient } from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";


const getAvailableSlots = asyncHandler(async (req, res) => {
    const { ground_id, booking_date } = req.body;

    if (!ground_id || !booking_date) {
        console.log("Parameters not provided");
        throw new ApiError(401, "Bad Request");
    }

    const slotStatus = await pgClient.slots.findUnique({
        where: {
            ground_id: ground_id,
            date: new Date(booking_date)
        },
        select: {
            t0000: true,
            t0130: true,
            t0300: true,
            t0430: true,
            t0600: true,
            t0730: true,
            t0900: true,
            t1030: true,
            t1200: true,
            t1330: true,
            t1500: true,
            t1630: true,
            t1800: true,
            t1930: true,
            t2100: true,
            t2230: true
        }
    })

    if (!slotStatus) {
        console.log("No slots found!");
        throw new ApiError(404, "No Slot Found!");
    }

    const available_slots = Object.keys(slotStatus).filter((key) => slotStatus[key]);


    console.log(available_slots);

    function formatTime(t) {
        let h = parseInt(t.slice(1, 3), 10);
        let m = t.slice(3, 5);
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${h.toString().padStart(2, "0")}:${m} ${ampm}`;
    }

    // Build slots
    const timeSlots = [];
    for (let i = 0; i < available_slots.length - 1; i++) {
        const start = formatTime(available_slots[i]);
        const end = formatTime(available_slots[i + 1]);
        timeSlots.push(`${start} - ${end}`);
    }
    
    console.log(timeSlots);
    

    return res.status(200).json(new ApiResponse(200, `${Object.keys(available_slots).length} slots are available.`, available_slots));
})

const createBooking = asyncHandler(async (req, res) => {
    if (req.user.user_type !== 'player') {
        return res.status(403).json({
            message: "Unauthorized Request",
            redirect: "/login"
        })
    }

    const {
        ground_id,
        booking_date,
        start_time,
        end_time,
        event_id,
        payment_method,
        notes,
        promo_code
    } = req.body;

    const { available, requested_slot, pricing } = req.availability;

    const booking = await pgClient.$transaction(async (prisma) => {

        // 1. Check ground availability again (double-check)
        const ground = await prisma.grounds.findUnique({
            where: { id: ground_id },
            include: {
                turfs: {
                    select: {
                        admin_user_id: true,
                        name: true,
                        cancellation_policy: true
                    }
                }
            }
        });

        if (!ground || ground.status !== 'available') {
            throw new ApiError(400, "Ground is not available");
        }

        // 2. Check for conflicting bookings (with lock)
        if (available === false) {
            throw new ApiError(400, "This time slot is no longer available");
        }


        // // 3. Calculate pricing
        // const duration = calculateDuration(start_time, end_time);
        // const pricing = calculateBookingPrice(
        //     ground,
        //     bookingDateObj,
        //     start_time,
        //     end_time,
        //     duration
        // );

        // 4. Apply promo code if provided
        // let discount = 0;
        // let appliedPromotion = null;

        // if (promo_code) {
        //     const promotion = await validateAndApplyPromoCode(
        //         prisma,
        //         promo_code,
        //         ground.turf_id,
        //         pricing.totalAmount,
        //         bookingDateObj,
        //         userId
        //     );

        //     if (promotion) {
        //         discount = promotion.discountAmount;
        //         appliedPromotion = promotion;
        //     }
        // }

        // const finalAmount = pricing.totalAmount - discount;

        // 5. Create the booking
        const newBooking = await prisma.bookings.create({
            data: {
                ground_id,
                user_id: userId,
                event_id,
                booking_date: requested_slot.date,
                start_time: requested_slot.start_time,
                end_time: requested_slot.end_time,
                duration_hours: duration,
                total_amount: pricing.totalAmount,
                discount_amount: discount,
                final_amount: finalAmount,
                payment_status: 'pending',
                booking_status: 'pending',
                payment_method,
                notes
            },
            include: {
                ground: {
                    include: {
                        turf: true
                    }
                },
                user: {
                    select: {
                        first_name: true,
                        last_name: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });

        // 6. Record promo code usage if applied
        if (appliedPromotion) {
            await prisma.promotion_usage.create({
                data: {
                    promotion_id: appliedPromotion.id,
                    user_id: userId,
                    booking_id: newBooking.id,
                    discount_amount: discount
                }
            });

            // Update promotion usage count
            await prisma.promotions.update({
                where: { id: appliedPromotion.id },
                data: { used_count: { increment: 1 } }
            });
        }

        // 7. Create initial payment record
        const payment = await prisma.payments.create({
            data: {
                user_id: userId,
                booking_id: newBooking.id,
                amount: finalAmount,
                payment_method,
                status: 'initiated',
                payment_gateway: payment_method === 'cash' ? 'manual' : 'stripe'
            }
        });

        // 8. Send notifications
        await sendNotification(prisma, {
            user_id: ground.turf.admin_user_id,
            type: 'booking_pending',
            title: 'New Booking Request',
            message: `New booking request for ${ground.name} on ${booking_date}`,
            data: {
                booking_id: newBooking.id,
                ground_name: ground.name,
                customer_name: `${newBooking.user.first_name} ${newBooking.user.last_name}`,
                date: booking_date,
                time: `${start_time} - ${end_time}`
            },
            priority: 'high'
        });

        // 9. Log activity
        await prisma.activity_logs.create({
            data: {
                user_id: userId,
                entity_type: 'booking',
                entity_id: newBooking.id,
                action: 'create',
                new_values: {
                    booking_id: newBooking.id,
                    ground_id,
                    amount: finalAmount
                }
            }
        });

        return newBooking;
    });


})

export {
    createBooking,
    getAvailableSlots
}