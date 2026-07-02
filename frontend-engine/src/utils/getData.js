import users from '@/../public/data/users.json';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function getAllUser() {
    // const userResponse = await fetch(`/data/users.json`);
    // return userResponse.json();
    return users;
};

export async function getUserByUserId(userId) {
    const res = await fetch(`${API_BASE_URL}/users/${userId}`);

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
        const res = await fetch(`${API_BASE_URL}/venues`);
        return res.json();
    } catch (error) {
        return { data: [] }
    }
};

export async function getAllVenuesByAdminId(adminId) {
    try {
        const res = await fetch(`${API_BASE_URL}/venues/get-venues-by-admin/${adminId}`);
        return res.json();
    } catch (error) {
        return { data: [] }
    }
};

export async function getIndividualVenueByVenueId(venueId) {
    try {
        const res = await fetch(`${API_BASE_URL}/venues/${venueId}`);
        return res.json();
    } catch (error) {
        return { data: {} }
    }
};

export async function getAllEvents() {
    try {
        const res = await fetch(`${API_BASE_URL}/events`);
        return res.json();
    } catch (error) {
        return { data: [] }
    }
};

export async function getIndividualEventByEventId(eventId) {
    try {
        const res = await fetch(`${API_BASE_URL}/events/${eventId}`);
        return res.json();
    } catch (error) {
        return { data: {} }
    }
};