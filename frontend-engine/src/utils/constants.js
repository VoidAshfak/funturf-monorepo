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