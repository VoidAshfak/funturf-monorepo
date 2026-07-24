import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./_components/AppSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { getAllVenuesByAdminId } from "@/utils/getData";
import { turfThemeCss } from "@/utils/turfTheme";

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
    let turf = null;
    if (role === "turf_admin") {
        const { data: venues } = await getAllVenuesByAdminId(session.user.id);
        if (!venues || venues.length === 0) {
            redirect("/onboarding/turf");
        }
        turf = venues[0];
    }

    // The panel wears the turf's brand: its logo and name in the chrome, its
    // accent colour on buttons/nav/focus rings. Resolved on the SERVER so the
    // first paint is already branded — deriving it client-side would flash the
    // default green first. An empty string (no colour set, or a super_admin who
    // owns no turf) means no rule at all, so the stylesheet defaults win.
    //
    // It targets :root rather than a wrapper because dialogs and toasts portal to
    // document.body; scoping it to the wrapper would leave every modal green. The
    // rule unmounts with this layout, so the public site never sees it.
    const themeCss = turfThemeCss(turf?.theme_color);

    // Only the fields the chrome needs — the sidebar and header are client
    // components, and passing the whole turf DTO would ship grounds, policies and
    // contact details into the client bundle for nothing.
    const brand = turf ? { id: turf.id, name: turf.name, logo_url: turf.logo_url ?? null } : null;

    return (
        <>
            {themeCss && <style>{themeCss}</style>}
            <SidebarProvider>
                <AppSidebar brand={brand} />
                <main className="w-full">
                    <DashboardHeader brand={brand} />
                    <div className="p-5">
                        {children}
                    </div>
                </main>
            </SidebarProvider>
        </>
    )
}
