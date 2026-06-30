import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "./_components/AppSidebar";
import FunBreadcrumb from "@/components/FunBreadcrumb";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    };

    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
                <div className="border-b border-border p-2.5 flex items-center gap-3 sticky top-0 glass-nav z-10">
                    <SidebarTrigger />
                    <FunBreadcrumb />
                </div>
                <div className="p-5">
                    {children}
                </div>
            </main>
        </SidebarProvider>
    )
}