import { Building2, MapPin, Clock, CheckCircle2 } from 'lucide-react';

export const SPORTS = [
    'Cricket',
    'Football',
    'Badminton',
    'Tennis',
    'Basketball',
    'Volleyball'
];

export const AMENITIES = [
    'Parking',
    'Changing Rooms',
    'Washrooms',
    'Cafeteria',
    'First Aid',
    'Equipment Rental',
    'Floodlights',
    'Seating Area'
];

export const TURF_TYPES = [
    { value: 'natural_grass', label: 'Natural Grass' },
    { value: 'artificial_turf', label: 'Artificial Turf' },
    { value: 'synthetic', label: 'Synthetic' },
    { value: 'indoor', label: 'Indoor Court' }
];

export const FORM_STEPS = [
    { number: 1, title: 'Basic Info', icon: Building2 },
    { number: 2, title: 'Venue Details', icon: MapPin },
    { number: 3, title: 'Pricing & Hours', icon: Clock },
    { number: 4, title: 'Review', icon: CheckCircle2 }
];

export const FIELDS_TO_VALIDATE = {
    1: ['venueName', 'address', 'city', 'state', 'pincode', 'contactPhone'],
    2: ['sports', 'turfType', 'width', 'length'],
    3: ['pricePerHour', 'openingTime', 'closingTime']
};