import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";


const app = express();

// Cross Origin Resource Sharing (CORS) setup for APIs
const whitelist = ['http://localhost:3000', 'https://funturf-frontend-git-dev-v2-personal-dev-team.vercel.app'];

const corsOptions = {
    origin: (origin, cb) => {
        if(!origin) return cb(null, true); // for mobile and next auth server call

        if(whitelist.indexOf(origin) !== -1) {
            cb(null, true);
        } else {
            cb(new Error('Not allowed by CORS'))
        }
    },
    credentials: true
}

app.use(cors(corsOptions));


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
import userRoute from "./routes/auth/user.route.js";
import turfmateRoute from "./routes/user/turfmate.route.js";
import eventRoute from "./routes/event/event.route.js";
import venueRoute from "./routes/venue/venue.route.js";
import bookingRoute from "./routes/venue/booking.route.js"
import { errorHandler } from "./utils/errorHandler.js";


// routes declare
app.use("/api/v1/users", userRoute);
app.use("/api/v1/turfmates", turfmateRoute);
app.use("/api/v1/events", eventRoute);
app.use("/api/v1/venues", venueRoute);
app.use("/api/v1/bookings", bookingRoute);

app.use(errorHandler);


export {app};