"use client"

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function AddButton() {

    const router = useRouter();

    return (
        <Button onClick={() => router.push('/dashboard/turfs/add-new-turf')}>Add New Turf</Button>
    )
}