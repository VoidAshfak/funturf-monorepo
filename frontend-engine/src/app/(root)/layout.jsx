import Navbar from "@/components/Navbar"
import SmallScreenMenu from "@/components/SmallScreenMenu";
import BottomTabBar from "@/components/BottomTabBar";
import Footer from "@/components/Footer";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";

export default async function AppLayout({ children }) {
    const session = await getServerSession(authOptions);
    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="hidden md:block">
                <Navbar session={session} />
            </div>

            <div className="block md:hidden navbar sticky top-0 z-50">
                <SmallScreenMenu session={session} />
            </div>
            <div className="pb-[60px] md:pb-0">
                {children}
                <Footer />
            </div>
            <BottomTabBar userId={session?.user?.id} />
        </div>
    );
}
