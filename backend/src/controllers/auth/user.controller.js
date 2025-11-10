import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
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
            throw new ApiError(404, "User not found");
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
            throw new ApiError(500, "Token update failed");
        }

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens", error);
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
        user_type,
        status,
        email_verified,
        phone_verified,
        preferred_language,
        timezone
    } = req.body;


    if (!first_name || !last_name || !email || !password_hash || !user_type) {
        throw new ApiError(400, "All fields are required");
    }

    console.log("Request Body: ", req.body);



    const existingUser = await pgClient.users.findUnique({
        where: {
            email: email,
            phone: phone
        }
    })

    if (existingUser) {
        throw new ApiError(409, "User already exists");
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
        .status(200)
        .json(new ApiResponse(200, "User created successfully", serverResponse));

})

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // console.log("REQUEST: ",req);

    if (!email || !password) {
        throw new ApiError(400, "All fields are required");
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

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const { password_hash, ...response } = user

    const isPasswordValid = await isPasswordCorrect(password, user.password_hash);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id)

    // const options = {
    //     httpOnly: true,
    //     secure: true
    // }

    const userResponse = {
        ...response,
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

    try {
        const user = await pgClient.users.findUnique({
            where: { id: user_id },
            select: {
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

        if (!user) {
            res.status(404).json({ error: "User not found" });
        }

        return res
            .status(200)
            .json(new ApiResponse(
                200,
                "User found",
                user
            ));

    } catch (error) {
        throw new ApiError(500, "Error getting the user");
    }
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