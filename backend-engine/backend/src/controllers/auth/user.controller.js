import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { uploadMedia } from "../../utils/mediaUpload.js"
import jwt from "jsonwebtoken"
import { mongoClient, pgClient } from "../../prisma.js"
import bcrypt from "bcrypt"
import userCache from "../../utils/cache.js";


const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            user_type: user.user_type
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

const isPasswordCorrect = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
}


const generateAccessAndRefreshTokens = async (userId) => {

    try {
        const user = await pgClient.users.findUnique({
            where: {
                id: userId
            },
            select: {
                id: true,
                email: true,
                user_type: true
            }
        })

        if (!user) {
            throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND);
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);


        const refreshTokenUpdateResponse = await pgClient.users.update({
            where: {
                id: userId
            },
            data: {
                refresh_token: refreshToken
            }
        })

        if (!refreshTokenUpdateResponse) {
            throw ApiError.fromCode(ERROR_CODES.TOKEN_GENERATION_FAILED);
        }

        return { accessToken, refreshToken }

    } catch (error) {
        // Preserve a meaningful ApiError; only wrap truly unexpected failures.
        if (error instanceof ApiError) throw error;
        throw ApiError.fromCode(ERROR_CODES.TOKEN_GENERATION_FAILED);
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const {
        email,
        phone,
        password_hash,
        first_name,
        last_name,
        date_of_birth,
        gender,
        profile_picture_url,
        bio,
        status,
        email_verified,
        phone_verified,
        preferred_language,
        timezone
    } = req.body;


    if (!first_name || !last_name || !email || !password_hash) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "first_name, last_name, email and password are required",
        });
    }

    const sports = req.body.sports || [];
    const teamsJoined = 0;
    const eventsJoined = 0;
    const friends = 0;
    const username = email.split("@")[0];

    // Self-service account type, but whitelisted: a signup may only choose
    // "player" or "turf_admin". "super_admin" is NEVER assignable via public
    // register (must be granted out-of-band). Anything else falls back to player.
    const ALLOWED_SIGNUP_ROLES = ["player", "turf_admin"];
    const user_type = ALLOWED_SIGNUP_ROLES.includes(req.body.user_type)
        ? req.body.user_type
        : "player";

    // email and phone are each individually unique, so findUnique can't take both
    // as one locator — use findFirst with OR to detect a clash on either field.
    const existingUser = await pgClient.users.findFirst({
        where: {
            OR: [
                { email },
                ...(phone ? [{ phone }] : []),
            ],
        },
    });

    if (existingUser) {
        throw ApiError.fromCode(ERROR_CODES.USER_ALREADY_EXISTS);
    }

    // const profilePictureLocalPath = req.files?.profilePicture[0].path;

    // const profilePictureUrl = await uploadMedia(profilePictureLocalPath);

    // if (!profilePictureUrl) {
    //     throw new ApiError(400, "Profile picture upload failed");
    // }

    const user = await pgClient.users.create({
        data: {
            email,
            phone,
            password_hash,
            first_name,
            last_name,
            date_of_birth,
            gender,
            profile_picture_url,
            bio,
            user_type,
            status,
            email_verified,
            phone_verified,
            preferred_language,
            timezone
        }
    })

    if (!user) {
        throw new ApiError(500, "Failed to create user");
    }

    const newlyCreatedUser = await pgClient.users.findUnique({
        where: {
            id: user.id
        },
        select: {
            id: true,
            email: true,
            password_hash: true,
            first_name: true,
            last_name: true,
            status: true,
            user_type: true,
            bio: true,
            email_verified: true,
            phone_verified: true,
            profile_picture_url: true
        }
    })

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(newlyCreatedUser.id);

    const serverResponse = {
        ...newlyCreatedUser,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }

    return res
        .status(201)
        .json(new ApiResponse(201, "User created successfully", serverResponse));

})

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // console.log("REQUEST: ",req);

    if (!email || !password) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "email and password are required",
        });
    }

    const user = await pgClient.users.findUnique({
        where: {
            email: email
        },
        select: {
            id: true,
            email: true,
            password_hash: true,
            first_name: true,
            last_name: true,
            status: true,
            user_type: true,
            bio: true,
            email_verified: true,
            phone_verified: true,
            profile_picture_url: true
        }
    })

    // Use the same generic error for "no such user" and "wrong password" so the
    // API doesn't leak which emails are registered (user-enumeration guard).
    if (!user) {
        throw ApiError.fromCode(ERROR_CODES.INVALID_CREDENTIALS);
    }

    const { password_hash, ...response } = user

    const isPasswordValid = await isPasswordCorrect(password, user.password_hash);

    if (!isPasswordValid) {
        throw ApiError.fromCode(ERROR_CODES.INVALID_CREDENTIALS);
    }

    const sports = req.body.sports || [];
    const teamsJoined = 0;
    const eventsJoined = 0;
    const friends = 0;
    const username = user.email.split("@")[0];

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id)

    // const options = {
    //     httpOnly: true,
    //     secure: true
    // }

    const userResponse = {
        ...response,
        sports,
        teamsJoined,
        eventsJoined,
        friends,
        username,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }

    return res
        .status(200)
        // .cookie("accessToken", accessToken, options)
        // .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                "User Logged In Successfully.",
                {
                    user: userResponse
                }
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {

    await pgClient.users.update({
        where: {
            id: req.user.id
        },
        data: {
            refreshToken: null
        }
    })


    // const options = {
    //     httpOnly: true,
    //     secure: true
    // }

    return res
        .status(200)
        // .clearCookie("accessToken", options)
        // .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                {},
                "User Logged Out Successfully."
            )
        )
})

const tokenRefresh = asyncHandler(async (req, res) => {
    const browserRefreshToken = req.body.refresh_token;

    if (!browserRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            browserRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await pgClient.users.findUnique({
            where: {
                id: decodedToken.id
            },
            select: {
                id: true,
                refresh_token: true
            }
        })

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (browserRefreshToken !== user.refresh_token) {
            throw new ApiError(401, "Refresh token is expired or invalid")
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id)
        // const options = {
        //     httpOnly: true,
        //     secure: true
        // }

        return res
            .status(200)
            // .cookie("accessToken", newAccessToken, options)
            // .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    "Token Refreshed Successfully.",
                    {
                        accessToken: accessToken,
                        refreshToken: refreshToken,
                        tokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRY
                    }
                )
            )
    } catch (error) {
        throw new ApiError(401, "Token refresh failed")
    }

})

const getUserById = asyncHandler(async (req, res) => {
    const { user_id } = req.params;

    const user = await pgClient.users.findUnique({
        where: { id: user_id },
        select: {
            id: true,
            email: true,
            phone: true,
            first_name: true,
            last_name: true,
            date_of_birth: true,
            gender: true,
            profile_picture_url: true,
            bio: true,
            user_type: true,
            status: true,
            email_verified: true,
            phone_verified: true,
            preferred_language: true,
            last_login_at: true,
            created_at: true,
            updated_at: true
        }
    });

    // Must return here — falling through on a missing user would crash on
    // `user.email` below and mask the real 404 as a 500.
    if (!user) {
        throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND);
    }

    // TODO: replace these placeholders with real aggregates once the
    // teams / events / connections features land.
    const userResponse = {
        ...user,
        sports: [],
        teamsJoined: 0,
        eventsJoined: 0,
        friends: 0,
        username: user.email.split("@")[0],
    };

    return res
        .status(200)
        .json(new ApiResponse(200, "User found", userResponse));
})


// Using node-cache | (Use redis in future)
const varifyLogin = asyncHandler(async (req, res) => {
    console.log("Varifying Login...");

    const accessToken = req.cookies.accessToken || req.body.accessToken
    if (!accessToken) {
        return res.status(401).json(new ApiResponse(401, "Unauthorized request"))
    }

    try {
        const decodedToken = jwt.verify(
            accessToken,
            process.env.ACCESS_TOKEN_SECRET
        )
        const userId = decodedToken.id

        // Check Cache first
        let cachedUser = userCache.get(userId)

        if (!cachedUser) {
            console.log("Cache miss");

            const user = await mongoClient.user.findUnique({
                where: {
                    id: decodedToken.id
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    address: true,
                    bio: true,
                    sportsPreferences: true,
                    eventsJoined: true,
                    role: true,
                    rating: true,
                    profilePicture: true
                }
            })

            if (!user) {
                return res.status(401).json(new ApiError(401, "Invalid access token"))
            }
            // cache the result
            userCache.set(userId, user)
            cachedUser = user
        }

        console.log("Cache hit");

        return res.
            status(200)
            .json(new ApiResponse(200, "User logged in successfully", { user: cachedUser }))


    } catch (error) {
        throw new ApiError(401, "Access token is expired or invalid")
    }
})

export {
    registerUser,
    loginUser,
    logoutUser,
    tokenRefresh,
    varifyLogin,
    getUserById
}