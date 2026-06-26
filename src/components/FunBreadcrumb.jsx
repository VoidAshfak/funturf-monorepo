"use client"

import { usePathname } from "next/navigation";

const getBreadCrumbText = (pathname) => {
    switch (pathname) {
        case '/dashboard':
            return "Home"
        case '/dashboard/bookings':
            return "Bookings"
        case '/dashboard/turfs':
            return "Manage Turfs"
        case '/dashboard/turfs/add-new-turf':
            return "Manage Turfs / Add"
    };
};

export default function FunBreadcrumb() {

    const pathname = usePathname();

    return (
        <p className="text-muted-foreground font-sans">{getBreadCrumbText(pathname)}</p>

    )
}