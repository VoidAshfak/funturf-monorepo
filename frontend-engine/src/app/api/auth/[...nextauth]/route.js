import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * Parse the backend's expiry string (e.g. "1d", "15m", "3600s", or a raw number
 * of seconds) into milliseconds. Falls back to 1 day if the format is unknown so
 * we never end up with a NaN expiry that would refresh on every single request.
 */
function expiryToMs(value) {
    if (typeof value === "number") return value * 1000; // treat bare number as seconds
    const match = String(value ?? "").trim().match(/^(\d+)\s*([smhd])?$/i);
    if (!match) return 24 * 60 * 60 * 1000; // default: 1 day
    const amount = Number(match[1]);
    const unit = (match[2] || "s").toLowerCase();
    const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return amount * (multipliers[unit] ?? 1_000);
}

/**
 * Exchange the stored refresh token for a fresh access token via the backend.
 * The backend rotates the refresh token too, so we persist whichever it returns.
 * On any failure we flag the JWT with `error` so the client can force a logout
 * (see AuthSync.jsx) — a refresh token that no longer works means the session is
 * effectively dead.
 */
async function refreshAccessToken(token) {
    try {
        if (!token.refresh_token) throw new Error("No refresh token on session");

        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_BASE_URL}/users/refresh`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: token.refresh_token }),
            }
        );

        const data = await res.json();
        if (!res.ok || !data?.success) {
            throw new Error(data?.message || "Token refresh failed");
        }

        const refreshed = data.data; // { accessToken, refreshToken, tokenExpiresIn }
        return {
            ...token,
            access_token: refreshed.accessToken,
            // Backend rotates the refresh token on every refresh — keep the new one.
            refresh_token: refreshed.refreshToken ?? token.refresh_token,
            access_token_expires: Date.now() + expiryToMs(refreshed.tokenExpiresIn),
            error: undefined,
        };
    } catch (error) {
        // Signal the client to sign out; the old token stays put but is unusable.
        return { ...token, error: "RefreshAccessTokenError" };
    }
}

export const authOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: 'jwt'
    },
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "text", placeholder: "jsmith@gmail.com" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req) {
                const { email, password } = credentials;
                if (!email || !password) {
                    return null;
                }

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    return data.data.user
                }

                // Surface the backend's error message to the client. NextAuth
                // exposes a thrown Error's message on `result.error` (redirect:false).
                throw new Error(data?.message || "Invalid email or password");
            }
        })
    ],
    callbacks: {
        async jwt({ token, user, account, profile, isNewUser }) {
            // 1) Initial sign-in: seed identity + both tokens + the access-token expiry.
            if (user) {
                token.id = user.id;
                token.username = user.username ?? user.email.split('@')[0];
                token.first_name = user.first_name;
                token.last_name = user.last_name;
                token.phone = user.phone;
                token.date_of_birth = user.date_of_birth;
                token.gender = user.gender;
                token.image = user.profile_picture_url;
                token.bio = user.bio;
                token.user_type = user.user_type;
                token.status = user.status;
                token.access_token = user.accessToken;
                token.refresh_token = user.refreshToken;
                token.access_token_expires = Date.now() + expiryToMs(user.tokenExpiresIn);
                return token;
            }

            // 2) Access token still valid (60s clock-skew margin) — nothing to do.
            if (
                token.access_token_expires &&
                Date.now() < token.access_token_expires - 60_000
            ) {
                return token;
            }

            // 3) Expired (or expiry unknown) — try to refresh it silently.
            return await refreshAccessToken(token);
        },
        async session({ session, user, token }) {
            session.user.id = token.id;
            session.user.username = token.username;
            session.user.first_name = token.first_name;
            session.user.last_name = token.last_name;
            session.user.phone = token.phone;
            session.user.date_of_birth = token.date_of_birth;
            session.user.gender = token.gender;
            session.user.image = token.image;
            session.user.bio = token.bio;
            session.user.user_type = token.user_type;
            session.user.status = token.status;
            session.user.access_token = token.access_token;
            // Surface a failed refresh to the client so it can sign the user out
            // (a dead refresh token = the session can no longer be kept alive).
            session.error = token.error;
            return session
        },
    }
};

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST };
