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

// GET /events is now paginated + filtered. `data` is { events, pagination, stats }.
// Pass params like { page, limit, sport, timeframe, q, openOnly }.
export async function getAllEvents(params = {}) {
    try {
        const qs = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
        ).toString();
        const res = await fetch(`${API_BASE_URL}/events${qs ? `?${qs}` : ""}`);
        return res.json();
    } catch (error) {
        return { data: { events: [], pagination: { page: 1, hasMore: false, total: 0 } } };
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