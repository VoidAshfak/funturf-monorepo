import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "./_components/AppSidebar";
import FunBreadcrumb from "@/components/FunBreadcrumb";

export default function DashboardLayout({ children }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
                <div className="border-b p-2.5 flex items-center gap-3 sticky top-0 bg-white">
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