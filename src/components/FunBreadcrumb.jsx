"use client"

import { usePathname } from "next/navigation"

export default function FunBreadcrumb() {

    const pathname = usePathname();
    
    switch (pathname) {
        case '/dashboard':
            return <p className="text-gray-600 font-sans">Home</p>
        case '/dashboard/bookings':
            return <p className="text-gray-600 font-sans">Bookings</p>
        case '/dashboard/turfs':
            return <p className="text-gray-600 font-sans">Manage Turfs</p>
        case '/dashboard/turfs/add-new-turf':
            return <p className="text-gray-600 font-sans">Manage Turfs / Add</p>
    }
}