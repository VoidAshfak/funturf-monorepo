import TurfWizard from "@/app/dashboard/turfs/add-new-turf/_components/TurfWizard";

/**
 * Forced turf-creation onboarding for new turf owners. A turf_admin with no
 * venue is redirected here by the dashboard layout and must create their first
 * turf before the dashboard opens up. Lives outside the /dashboard segment so
 * that redirect can't loop. Renders the shared TurfWizard (a real component,
 * not a route page — importing a page.js as a component broke hydration here).
 */
export default function TurfOnboardingPage() {
    return (
        <TurfWizard
            redirectTo="/dashboard"
            heading="Set up your first turf"
            subheading="Add your venue and grounds to finish setting up your owner account."
        />
    );
}
