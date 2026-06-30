import {PrismaClient as MongoClient} from "./generated/prisma/mongo/client.js";
import { PrismaClient as PostgresClient } from "./generated/prisma/pg/client.js";


const mongoClient = new MongoClient()
const pgClient = new PostgresClient()


export {
    mongoClient,
    pgClient
}