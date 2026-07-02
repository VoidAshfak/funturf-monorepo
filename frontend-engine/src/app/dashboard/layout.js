import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "./_components/AppSidebar";
import FunBreadcrumb from "@/components/FunBreadcrumb";
import NotificationBell from "@/components/NotificationBell";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { getAllVenuesByAdminId } from "@/utils/getData";

export default async function DashboardLayout({ children }) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const role = session.user?.user_type;

    // Players have no dashboard (defense-in-depth; middleware also blocks them).
    if (role === "player") {
        redirect("/");
    }

    // A turf owner must finish turf creation before the dashboard opens.
    // super_admin (platform moderator) is exempt — they own no turf.
    if (role === "turf_admin") {
        const { data: venues } = await getAllVenuesByAdminId(session.user.id);
        if (!venues || venues.length === 0) {
            redirect("/onboarding/turf");
        }
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
                <div className="border-b border-border p-2.5 flex items-center gap-3 sticky top-0 glass-nav z-10">
                    <SidebarTrigger />
                    <FunBreadcrumb />
                    <div className="ml-auto">
                        <NotificationBell />
                    </div>
                </div>
                <div className="p-5">
                    {children}
                </div>
            </main>
        </SidebarProvider>
    )
}