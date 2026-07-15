"use client"

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function AddButton({ buttonText = "Add New", href = "/dashboard/turfs/add-new-turf" }) {

    const router = useRouter();

    return (
        <Button
            className="px-8 py-5 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 inline-flex items-center gap-2"
            onClick={() => router.push(href)}
        >+ {buttonText}</Button>
    )
}