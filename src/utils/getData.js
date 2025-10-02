export async function getAllUser() {
    const userResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/data/users.json`);
    return userResponse.json();
};

export async function getIndividualUser(userId) {
    const individualUserResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/data/users.json/${userId}`);
    return individualUserResponse.json();
};

export async function getAllVenues() {
    const venueResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/data/venues.json`);
    return venueResponse.json();
};

export async function getIndividualVenue({ venueId }) {
    const individualVenueResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/data/venues.json/${venueId}`);
    return individualVenueResponse.json();
};

export async function getAllEvents() {
    const eventResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/data/events.json`);
    return eventResponse.json();
};

export async function getIndividualEvent({ eventId }) {
    const individualEventResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/data/events.json/${eventId}`);
    return individualEventResponse.json();
};