import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { isAllowedOrigin } from "./utils/corsOrigins.js";
import { logger } from "../logs/logger.js";


const app = express();

// Cross Origin Resource Sharing (CORS) setup for APIs.
// Origins are whitelisted via the shared helper (CORS_ORIGINS env, see
// utils/corsOrigins.js) so REST and Socket.IO stay in sync. No longer "*".
const corsOptions = {
    origin: (origin, cb) => {
        if (isAllowedOrigin(origin)) return cb(null, true);
        // Log the rejected origin so misconfigured deploys are easy to spot.
        logger.warn(`CORS blocked origin: ${origin}`);
        return cb(new Error("Not allowed by CORS"));
    },
    // Auth is a Bearer token in the Authorization header, not cookies, so
    // credentials aren't strictly required — enabled defensively since
    // cookie-parser is in the stack and future flows may use cookies.
    credentials: true,
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
import teamRoute from "./routes/team/team.routes.js";
import venueRoute from "./routes/venue/venue.route.js";
import bookingRoute from "./routes/venue/booking.route.js"
import notificationRoute from "./routes/notification/notification.route.js";
import chatRoute from "./routes/chat/chat.route.js";
import promotionRoute from "./routes/venue/promotion.route.js";
import couponRoute from "./routes/venue/coupon.route.js";
import { mountDocs } from "./utils/swagger.js";
import { errorHandler } from "./utils/errorHandler.js";


// routes declare
app.use("/api/v1/users", userRoute);
app.use("/api/v1/turfmates", turfmateRoute);
app.use("/api/v1/events", eventRoute);
app.use("/api/v1/teams", teamRoute);
app.use("/api/v1/venues", venueRoute);
app.use("/api/v1/bookings", bookingRoute);
app.use("/api/v1/notifications", notificationRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/promotions", promotionRoute);
app.use("/api/v1/coupons", couponRoute);

// Interactive API docs at /api/v1/docs (dev only by default — see utils/swagger.js).
// Must sit before errorHandler, which is terminal.
mountDocs(app);

app.use(errorHandler);


export {app};