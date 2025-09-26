import { users } from "@/lib/users";
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

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

                const userFound = users.find(user => user.email === email);
                if (userFound && userFound.password === password) {
                    return userFound;
                }

                return null;
            }
        })
    ],
    callbacks: {
        async jwt({ token, user, account, profile, isNewUser }) {
            if (user) {
                token.id = user._id;
                token.name = user.username;
                token.fullName = user.fullName;
                token.bio = user.bio;
                token.image = user.profilePicture;
                token.role = user.role;
                token.sports = user.sports;
                token.teams = user.teams;
                token.eventsJoined = user.eventsJoined;
                token.friends = user.friends;

            }
            return token
        },
        async session({ session, user, token }) {
            session.user.id = token.id;
            session.user.fullName = token.fullName;
            session.user.image = token.image;
            session.user.bio = token.bio;
            session.user.role = token.role;
            session.user.sports = token.sports;
            session.user.teams = token.teams;
            session.user.eventsJoined = token.eventsJoined;
            session.user.friends = token.friends;
            return session
        },
    }
};

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }