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

export const GROUND_TYPES = ['Indoor', 'Outdoor', 'Covered'];

export const TURF_TYPES = [
    { value: 'natural_grass', label: 'Natural Grass' },
    { value: 'artificial_turf', label: 'Artificial Turf' },
    { value: 'synthetic', label: 'Synthetic' },
    { value: 'indoor', label: 'Indoor Court' }
];

export const SURFACE_TYPES = ['Grass', 'Artificial Turf', 'Concrete', 'Wood', 'Clay'];

export const STATUS_TYPES = ['Active', 'Inactive', 'Under Maintenance'];

export const FORM_STEPS = [
    { number: 1, title: 'Basic Info', icon: Building2 },
    { number: 2, title: 'Venue Details', icon: MapPin },
    { number: 3, title: 'Ground Info', icon: MapPin },
    { number: 4, title: 'Pricing & Hours', icon: Clock },
    { number: 5, title: 'Review', icon: CheckCircle2 }
];

export const FIELDS_TO_VALIDATE = {
    1: ['venueName', 'address', 'city', 'state', 'pincode', 'contactPhone'],
    2: ['sports', 'turfType', 'width', 'length'],
    3: ['pricePerHour', 'openingTime', 'closingTime']
};

export const venuedata = {
    admin_user_id: '',
    name: '',
    slug: '',
    description: '',
    address_line_1: {
        city: '',
        state: '',
        postal_code: '',
        country: '',
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
    images: [],

    total_grounds: '',
    grounds: [
        {
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
            status: '', // ground_status_type
            amenities: [],
            images: [],
            notes: '',
        }
    ],

};

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