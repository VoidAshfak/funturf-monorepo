import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";


const app = express();

// Cross Origin Resource Sharing (CORS) setup for APIs
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))
// json data setup
app.use(express.json({
    limit: "56kb"
}));
// url encoded data setup
app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}));
app.use(express.static("public")); // assets setup
app.use(cookieParser()); // cookie parser setup


// routes import
import userRoute from "./routes/user.route.js";
import turfmateRoute from "./routes/turfmate.route.js";
import eventRoute from "./routes/event.route.js";
import venueRoute from "./routes/venue.route.js";
import bookingRoute from "./routes/booking.route.js"


// routes declare
app.use("/api/v1/users", userRoute);
app.use("/api/v1/turfmates", turfmateRoute);
app.use("/api/v1/event", eventRoute);
app.use("/api/v1/venue", venueRoute);
app.use("/api/v1/booking", bookingRoute)

export {app};