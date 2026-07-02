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