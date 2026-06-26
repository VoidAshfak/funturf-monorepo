"use client"

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EventCreationForm from "./EventCreationForm";
import { useState } from "react";

export default function CreateNewEvent() {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <Button
                className="hover:cursor-pointer w-fit"
                onClick={() => setOpen(true)}
            >
                Create New Event
            </Button>

            {open && (
                <Dialog
                    open={open}
                    onOpenChange={setOpen}
                    className="w-[500px]"
                >
                    <DialogContent className="max-h-11/12 overflow-auto ">
                        <DialogHeader className="sm:text-center">
                            <DialogTitle>Create Your Event </DialogTitle>
                            <DialogDescription>
                                Enter your information below to create your event
                            </DialogDescription>
                        </DialogHeader>

                        <EventCreationForm setOpen={setOpen} />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}