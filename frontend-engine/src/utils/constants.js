import { Building2, MapPin, Clock, CheckCircle2 } from 'lucide-react';

export const SPORTS = [
    'Cricket',
    'Football',
    'Badminton',
    'Tennis',
    'Basketball',
    'Volleyball'
];

export const FACILITIES = [
    'Parking',
    'Changing Rooms',
    'Washrooms',
    'Cafeteria',
    'First Aid',
    'Equipment Rental',
    'Floodlights',
    'Seating Area'
];

export const AMENITIES = [
    'Parking',
    'Changing Room',
    'Washroom',
    'Lighting',
    'Seating',
    'Scoreboard',
    'First Aid',
    'Cafeteria',
    'WiFi',
];

export const GROUND_TYPES = ['v5x5', 'v6x6', 'v7x7', 'v11x11', 'cricket_pitch', 'tennis_court', 'badminton_court', 'custom'];

export const SURFACE_TYPES = ['natural_grass', 'artificial_grass', 'clay', 'concrete', 'synthetic', 'other'];

export const STATUS_TYPES = ['available', 'maintenance', 'unavailable'];

// The 8 administrative divisions of Bangladesh (used instead of "state").
export const BD_DIVISIONS = [
    'Dhaka',
    'Chattogram',
    'Rajshahi',
    'Khulna',
    'Barishal',
    'Sylhet',
    'Rangpur',
    'Mymensingh',
];

// --- Player profile options -----------------------------------------------
// These MUST match the Prisma enums of the same name in
// `backend-engine/backend/prisma/postgresql/schema.prisma` — the profile API
// (`PATCH /users/me`) validates every value against them and rejects anything
// else, so adding an option here without adding it there just produces a 400.

/** users.gender -> gender_type */
export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];

/** player_profiles.skill_level -> skill_level_type */
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'professional', 'any'];

/** player_profiles.preferred_foot -> preferred_foot_type */
export const PREFERRED_FEET = ['left', 'right', 'both'];

/** player_profiles.preferred_play_time -> play_time_type */
export const PLAY_TIMES = ['morning', 'afternoon', 'evening', 'night', 'flexible'];

// Positions a player can pick (stored as a free JSON array, so this list is a
// convenience, not a constraint). Football-first because that's what most
// FunTurf matches are, with generic entries for the other sports.
export const PLAYER_POSITIONS = [
    'goalkeeper',
    'defender',
    'midfielder',
    'winger',
    'forward',
    'striker',
    'batter',
    'bowler',
    'all_rounder',
    'wicket_keeper',
    'setter',
    'libero',
    'any',
];

// Ground booking-availability options, framed around whether the ground accepts
// bookings. Maps to the grounds.status DB column.
export const GROUND_BOOKING_STATUS = [
    { value: 'available', label: 'Open for booking', hint: 'Players can book this ground' },
    { value: 'maintenance', label: 'Under maintenance', hint: 'Temporarily not bookable' },
    { value: 'unavailable', label: 'Unavailable', hint: 'Hidden and not bookable' },
];

export const FORM_STEPS = [
    { number: 1, title: 'Basic Info', icon: Building2 },
    { number: 2, title: 'Venue Details', icon: MapPin },
    { number: 3, title: 'Ground Info', icon: MapPin },
    { number: 4, title: 'Pricing & Hours', icon: Clock },
    { number: 5, title: 'Review', icon: CheckCircle2 }
];

export const groundData = {
    name: '',
    ground_type: '',
    sport_type: '',
    surface_type: '',
    dimensions_length_m: '',
    dimensions_width_m: '',
    capacity_players: '',
    hourly_rate: '',
    weekend_hourly_rate: '',
    peak_hour_rate: '',
    off_peak_hour_rate: '',
    currency: 'BDT',
    minimum_booking_hours: '',
    maximum_booking_hours: '',
    status: '',
    amenities: [],
    images: [],
    notes: '',
};

export const venuedata = {
    admin_user_id: '',
    name: '',
    description: '',
    // BD-friendly address. Keys map to DB columns:
    //   area   -> address_line_1 (street/area)   | city  -> district
    //   state  -> division                        | country defaults to Bangladesh
    address_line_1: {
        area: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'Bangladesh',
        latitude: '',
        longitude: '',
    },
    address_line_2: '',
    phone: '',
    email: '',
    website_url: '',
    establishment_year: '',

    rules_and_regulations: '',
    cancellation_policy: '',
    advance_booking_days: '',
    sports_available: [],
    facilities: [],
    rating: 0.0,
    operating_hours: {
        opening_time: '',
        closing_time: '',
    },
    images: null,

    grounds: [
        {
            ...groundData
        }
    ],

};