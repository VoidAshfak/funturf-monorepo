import {PrismaClient as MongoClient} from "./generated/prisma/mongo/client.js";
import { PrismaClient as PostgresClient, Prisma } from "./generated/prisma/pg/client.js";


const mongoClient = new MongoClient()
const pgClient = new PostgresClient()


export {
    mongoClient,
    pgClient,
    // Prisma namespace (pg) — needed for building parameterised raw SQL with
    // Prisma.sql / Prisma.join / Prisma.empty (e.g. the events ranking query).
    Prisma,
}