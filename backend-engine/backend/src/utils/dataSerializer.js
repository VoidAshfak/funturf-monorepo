export class VenueSerializer {
    // static toGroundDto(ground) {
    //     return {
    //         id: ground.id,
    //         name: ground.name,
    //         ground_type: ground.ground_type,
    //         sport_type: ground.sport_type,
    //         surface_type: ground.surface_type,
    //         dimensions_length_m: ground.dimensions_length_m,
    //         dimensions_width_m: ground.dimensions_width_m,
    //         capacity_players: ground.capacity_players,
    //         hourly_rate: ground.hourly_rate,
    //         weekend_hourly_rate: ground.weekend_hourly_rate,
    //         peak_hour_rate: ground.peak_hour_rate,
    //         off_peak_hour_rate: ground.off_peak_hour_rate,
    //         currency: ground.currency,
    //         minimum_booking_hours: ground.minimum_booking_hours,
    //         maximum_booking_hours: ground.maximum_booking_hours,
    //         status: ground.status,
    //         amenities: ground.amenities,
    //         images: ground.images,
    //         notes: ground.notes,
    //     };
    // }

    static toDto(venue, groundsOverride) {

        const groundsSource = groundsOverride ?? venue.grounds ?? [];

        return {
            id: venue.id,
            admin_user_id: venue.admin_user_id,
            name: venue.name,
            slug: venue.slug,
            description: venue.description,
            address_line_1: {
                city: venue.city,
                state: venue.state,
                postal_code: venue.postal_code,
                country: venue.country,
                latitude:
                    venue.latitude === null || venue.latitude === undefined
                        ? null
                        : Number(venue.latitude) || null,
                longitude:
                    venue.longitude === null || venue.longitude === undefined
                        ? null
                        : Number(venue.longitude) || null,
            },
            address_line_2: venue.address_line_2,
            phone: venue.phone,
            email: venue.email,
            website_url: venue.website_url,
            establishment_year: venue.establishment_year,
            total_grounds: venue.total_grounds,
            rules_and_regulations: venue.rules_and_regulations,
            cancellation_policy: venue.cancellation_policy,
            advance_booking_days: venue.advance_booking_days,
            status: venue.status,
            verified: venue.verified,
            total_bookings: venue.total_bookings,
            sports_available: venue.sports_available,
            facilities: venue.facilities,
            rating: Number(venue.rating) || 0,
            operating_hours: {
                opening_time: venue.operating_hours.open,
                closing_time: venue.operating_hours.close,
            },
            images: venue.images,
            grounds: groundsSource, //.map((ground) => this.toGroundDto(ground)),
            created_at: venue.created_at,
            updated_at: venue.updated_at
        };
    }

    static toVenueListDto(venue) {
        return {
            id: venue.id,
            name: venue.name,
            address_line_1: {
                city: venue.city,
                state: venue.state,
                postal_code: venue.postal_code,
                country: venue.country,
                latitude:
                    venue.latitude === null || venue.latitude === undefined
                        ? null
                        : Number(venue.latitude) || null,
                longitude:
                    venue.longitude === null || venue.longitude === undefined
                        ? null
                        : Number(venue.longitude) || null,
            },
            address_line_2: venue.address_line_2,
            status: venue.status,
            verified: venue.verified,
            sports_available: venue.sports_available,
            rating: Number(venue.rating) || 0,
            operating_hours: {
                opening_time: venue.operating_hours.open,
                closing_time: venue.operating_hours.close,
            },
            images: venue.images,
            grounds: venue.grounds
        };
    }
}

export class EventSerializer {
    static toDto(event) {
        if (!event) return null;

        return {
            id: event.id,
            title: event.title,
            description: event.description,
            sport_type: event.sport_type,

            event_date: event.event_date,
            start_time: event.start_time,
            end_time: event.end_time,

            min_players: event.min_players,
            max_players: event.max_players,
            current_players: event.current_players,

            organizer: event.users ? this.userToDto(event.users) : null,
            ground: event.grounds ? this.groundToDto(event.grounds) : null,

            participants: event.event_participants || [],
            comments: event.event_comments || []
        };
    }

    static userToDto(user) {
        return {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            profile_picture_url: user.profile_picture_url
        };
    }

    static groundToDto(ground) {
        return {
            id: ground.id,
            name: ground.name,
            turf: ground.turfs ? this.turfToDto(ground.turfs) : null
        };
    }

    static turfToDto(turf) {
        return {
            id: turf.id,
            name: turf.name,
            address_line_1: {
                city: turf.city,
                state: turf.state,
                postal_code: turf.postal_code,
                country: turf.country,
                latitude: turf.latitude,
                longitude: turf.longitude
            }
        };
    }
}

export class BookingPriceSerializer {
    static toDto(params) {
        const {
            isAvailable,
            reason = null,
            ground_id,
            slot,
            booking_date,
            slot_time,
            day_of_week,
            is_peak,
            is_weekend,
            base_rate,
            discount,
            final_price,
            promo_meta = null,
        } = params;

        return {
            isAvailable,
            reason,
            ground_id,
            slot,
            booking_date,
            slot_time,
            day_of_week,
            is_peak,
            is_weekend,
            base_rate,
            discount,
            final_price,
            promotion: promo_meta
                ? { id: promo_meta.id, code: promo_meta.code }
                : null,
        };
    }
}

