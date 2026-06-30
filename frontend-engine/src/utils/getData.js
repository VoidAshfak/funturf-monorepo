import users from '@/../public/data/users.json';

export async function getAllUser() {
    // const userResponse = await fetch(`/data/users.json`);
    // return userResponse.json();
    return users;
};

export async function getUserByUserId(userId) {
    const res = await fetch(`https://app4-osju.onrender.com/api/v1/users/${userId}`);

    if (!res.ok) {
        return {
            ok: false,
            status: res.status,
            message: "No user found",
        };
    }

    const data = await res.json();
    return {
        ok: true,
        data: data.data,
    };
};


export async function getAllVenues() {
    try {
        const res = await fetch(`https://app4-osju.onrender.com/api/v1/venues`);
        return res.json();
    } catch (error) {
        return { data: [] }
    }
};

export async function getAllVenuesByAdminId(adminId) {
    try {
        const res = await fetch(`https://app4-osju.onrender.com/api/v1/venues/get-venues-by-admin/${adminId}`);
        return res.json();
    } catch (error) {
        return { data: [] }
    }
};

export async function getIndividualVenueByVenueId(venueId) {
    try {
        const res = await fetch(`https://app4-osju.onrender.com/api/v1/venues/${venueId}`);
        return res.json();
    } catch (error) {
        return { data: {} }
    }
};

export async function getAllEvents() {
    try {
        const res = await fetch(`https://app4-osju.onrender.com/api/v1/events`);
        return res.json();
    } catch (error) {
        return { data: [] }
    }
};

export async function getIndividualEventByEventId(eventId) {
    try {
        const res = await fetch(`https://app4-osju.onrender.com/api/v1/events/${eventId}`);
        return res.json();
    } catch (error) {
        return { data: {} }
    }
};