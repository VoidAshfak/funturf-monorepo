import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";


const app = express();

// Cross Origin Resource Sharing (CORS) setup for APIs
const whitelist = ['http://localhost:3000', 'https://funturf-frontend-git-dev-v2-personal-dev-team.vercel.app'];

const corsOptions = {
    // origin: (origin, cb) => {
    //     if(!origin) return cb(null, true); // for mobile and next auth server call

    //     if(whitelist.indexOf(origin) !== -1) {
    //         cb(null, true);
    //     } else {
    //         cb(new Error('Not allowed by CORS'))
    //     }
    // },
    // credentials: true

    origin: '*'
}

// We run behind nginx (see ../nginx/nginx.conf and render.yaml), so without this
// every request looks like it came from the proxy — rate limiters keyed on
// `req.ip` would put the whole internet in one bucket. `1` = trust exactly one
// hop (our nginx); do NOT set `true`, which would let a client spoof
// X-Forwarded-For and dodge the limiter entirely.
app.set("trust proxy", 1);

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
import notificationRoute from "./routes/notification/notification.route.js";
import { errorHandler } from "./utils/errorHandler.js";


// routes declare
app.use("/api/v1/users", userRoute);
app.use("/api/v1/turfmates", turfmateRoute);
app.use("/api/v1/events", eventRoute);
app.use("/api/v1/venues", venueRoute);
app.use("/api/v1/bookings", bookingRoute);
app.use("/api/v1/notifications", notificationRoute);

app.use(errorHandler);


export {app};