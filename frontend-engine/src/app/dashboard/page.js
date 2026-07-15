import DashboardOverview from "@/components/DashboardOverview";

// Turf-admin landing. The overview data is admin-scoped and interaction-driven,
// so it's fetched client-side via RTK Query inside DashboardOverview.
export default function DashboardRoot() {
    return <DashboardOverview />;
}
