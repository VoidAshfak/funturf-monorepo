import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllVenuesByAdminId } from "@/utils/getData";

// A turf_admin owns exactly one turf, so there's no list to show — "Manage
// Grounds" goes straight to that turf's detail (its grounds). If somehow no turf
// exists yet, fall back to onboarding (the dashboard layout also guards this).
export default async function DashboardTurfsPage() {
    const session = await getServerSession(authOptions);
    const { data: venues } = await getAllVenuesByAdminId(session.user.id);

    if (venues?.length) {
        redirect(`/dashboard/turfs/${venues[0].id}`);
    }
    redirect("/onboarding/turf");
}
