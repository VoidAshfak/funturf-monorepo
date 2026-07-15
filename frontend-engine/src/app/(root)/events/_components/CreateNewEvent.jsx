import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

// The match form now lives on its own full page (/events/create) — too many
// fields for a dialog. This is just the entry point from the events hub.
export default function CreateNewEvent() {
    return (
        <Button asChild className="green-glow w-fit gap-2 font-medium">
            <Link href="/events/create">
                <Plus className="h-4 w-4" />
                Create New Event
            </Link>
        </Button>
    );
}
