export const getStatusColor = (status) => {
    switch (status) {
        case 'Active':
            return 'bg-green-100 text-green-800';
        case 'Under Maintenance':
            return 'bg-yellow-100 text-yellow-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

/**
 * Normalize a venue/ground sports value into a flat list of unique sport names.
 *
 * A ground's `sport_type` is a MultiSelect (an array like ["Football","Cricket"]),
 * and `sports_available` can arrive nested the same way. Rendering such a value
 * directly gives React a comma-joined key ("Football,Cricket") — a duplicate-key
 * warning — and builds broken asset URLs ("football,cricket.png"). Always run the
 * list through this before mapping it to chips.
 */
export const flattenSports = (value) =>
    [...new Set((Array.isArray(value) ? value : [value]).flat().filter(Boolean).map(String))];

export const getLocationString = (locationObject = {}) => {
    const { area, city, state, postal_code, country } = locationObject;
    const parts = [];

    if (area) parts.push(area);
    if (city) parts.push(city);

    if (state || postal_code) {
        let combined = "";
        if (state) combined += state;
        if (postal_code) combined += (state ? "-" : "") + postal_code;

        parts.push(combined);
    }

    if (country) parts.push(country);

    return parts.join(", ");
} 