"use client"

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EventCreationForm from "./EventCreationForm";

export default function CreateNewEvent() {

    return (
        <Dialog className="w-[500px]">
            <DialogTrigger asChild>
                <Button className="text-white bg-green-500 hover:cursor-pointer hover:bg-green-700 w-fit">
                    Create New Event
                </Button>
            </DialogTrigger>

            <DialogContent className="max-h-11/12 overflow-auto ">
                <DialogHeader className="sm:text-center">
                    <DialogTitle>Create Your Event </DialogTitle>
                    <DialogDescription>
                        Enter your information below to create your event
                    </DialogDescription>
                </DialogHeader>

                <EventCreationForm />
            </DialogContent>
        </Dialog>
    )
}