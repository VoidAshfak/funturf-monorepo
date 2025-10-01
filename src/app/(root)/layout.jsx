import Navbar from "@/components/Navbar"
import SmallScreenMenu from "@/components/SmallScreenMenu";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";

export const metadata = {
    title: "Funturf",
    description: "Your go-to app for managing turf",
};

export default async function AppLayout({ children }) {
    const session = await getServerSession(authOptions);
    return (
        <div>
            <div className="hidden md:block">
                <nav className={"navbar"}>
                    <Navbar session={session} />
                </nav>
            </div>

            <div className="block md:hidden navbar">
                <SmallScreenMenu session={session} />
            </div>
            {children}
        </div>
    );
}
