"use client"

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function AddButton({ buttonText = "Add New" }) {

    const router = useRouter();

    return (
        <Button
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-5 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 inline-flex items-center gap-2"
            onClick={() => router.push('/dashboard/turfs/add-new-turf')}
        >+ {buttonText}</Button>
    )
}