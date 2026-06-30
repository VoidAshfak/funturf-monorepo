import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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

                const res = await fetch('https://app4-osju.onrender.com/api/v1/users/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();

                if (data.success) {
                    return data.data.user
                }

                return null;
            }
        })
    ],
    callbacks: {
        async jwt({ token, user, account, profile, isNewUser }) {
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
            }
            return token
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
            return session
        },
    }
};

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST };
