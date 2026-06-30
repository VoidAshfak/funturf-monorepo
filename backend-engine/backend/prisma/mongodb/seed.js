// import dotenv from 'dotenv';
import {PrismaClient} from "../../src/generated/prisma/client.js"

// dotenv.config();
const prisma = new PrismaClient();

async function main() {
    // Create Users
    const users = await Promise.all([
        prisma.user.create({
            data: {
                email: "admin@example.com",
                password: "securepassword",
                name: "Admin User",
                address: "123 Admin St",
                phone: "01234567890",
                role: "ADMIN",
                sportsPreferences: "FOOTBALL",
                eventsJoined: [],
                refreshToken: "xyz",
            },
        }),
        ...[1, 2, 3, 4].map(i =>
            prisma.user.create({
                data: {
                    email: `player${i}@example.com`,
                    password: "password123",
                    name: `Player ${i}`,
                    phone: `0190000000${i}`,
                    sportsPreferences: i % 2 === 0 ? "CRICKET" : "BADMINTON",
                    eventsJoined: [],
                    refreshToken: `token${i}`,
                },
            })
        ),
    ]);

    // Create Venues
    const venues = await Promise.all(
        [1, 2, 3].map(i =>
            prisma.venue.create({
                data: {
                    name: `Turf ${i}`,
                    address: `Address ${i}`,
                    sportsAvailable: i % 2 === 0 ? "CRICKET" : "FOOTBALL",
                    pricePerSlot: 500 + i * 100,
                    availability: "9AM - 9PM",
                    facilities: ["Lights", "Parking"],
                    contactInfo: `0170000000${i}`,
                },
            })
        )
    );

    // Create Events
    const events = await Promise.all(
        venues.map((venue, i) =>
            prisma.event.create({
                data: {
                    title: `Match ${i + 1}`,
                    sport: "FOOTBALL",
                    date: new Date(Date.now() + (i + 1) * 86400000),
                    playersRequired: 10,
                    playersJoined: 5,
                    status: i % 2 === 0 ? "PENDING" : "ENDED",
                    organizerId: users[i + 1].id,
                    venueId: venue.id,
                },
            })
        )
    );

    // Create turfmate (Friend Requests)
    await Promise.all([
        prisma.turfmate.create({
            data: {
                uid1: users[1].id,
                uid2: users[2].id,
                status: "REQ_UID1",
            },
        }),
        prisma.turfmate.create({
            data: {
                uid1: users[2].id,
                uid2: users[3].id,
                status: "FRIEND",
            },
        }),
    ]);

    // Create Bookings
    await Promise.all(
        events.map((event, i) =>
            prisma.booking.create({
                data: {
                    userId: users[i + 1].id,
                    eventId: event.id,
                    venueId: event.venueId,
                    date: new Date(Date.now() + (i + 1) * 86400000),
                    status: i % 2 === 0 ? "PAID" : "UNPAID",
                },
            })
        )
    );

    console.log("🌱 Seed data inserted successfully!");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });