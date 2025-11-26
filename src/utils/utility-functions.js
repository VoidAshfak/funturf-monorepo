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