import users from '@/../public/data/users.json';
import venues from '@/../public/data/venues.json';
import events from '@/../public/data/events.json';

export async function getAllUser() {
    // const userResponse = await fetch(`/data/users.json`);
    // return userResponse.json();
    return users;
};

export async function getAllVenues() {
    // const venueResponse = await fetch(`/data/venues.json`);
    // return venueResponse.json();
    return venues;
};

export async function getAllEvents() {
    // const eventResponse = await fetch(`/data/events.json`);
    // return eventResponse.json();
    return events;
};