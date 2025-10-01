"use client"

import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CalendarCheck2, CalendarIcon, Minus, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useState } from "react";
import { Calendar } from "./ui/calendar";
import { format } from "date-fns";

export default function BookVenue({ venue }) {
    const { name, address, sports } = venue;

    const [date, setDate] = useState();

    const isDesktop = useMediaQuery("(min-width: 768px)");

    console.log(venue)

    return (
        <Drawer direction={isDesktop ? "right" : "bottom"}>
            <DrawerTrigger className="w-full" asChild>
                <Button
                    className={`w-full bg-green-600 hover:bg-green-700 cursor-pointer`}
                >
                    <CalendarCheck2 />
                    Book Now
                </Button>
            </DrawerTrigger>

            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>{name}</DrawerTitle>
                    <DrawerDescription>{address}</DrawerDescription>
                </DrawerHeader>

                <div className="flex items-center justify-center h-full">
                    <div className="px-5 space-y-2">
                        <div className="grid grid-cols-2">
                            <Label>Sport</Label>
                            <Select>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select Sport" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(sports || []).map((sport, index) => <SelectItem key={index} value={sport.toLowerCase()}>{sport}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2">
                            <Label>Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        data-empty={!date}
                                        className="data-[empty=true]:text-muted-foreground w-[180px] justify-start text-left font-normal"
                                    >
                                        <CalendarIcon />
                                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={date} onSelect={setDate} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid grid-cols-2">
                            <Label>Start Time</Label>
                            <Select>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Time to Start" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="light">Light</SelectItem>
                                    <SelectItem value="dark">Dark</SelectItem>
                                    <SelectItem value="system">System</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2">
                            <Label>Duration</Label>
                            <div className="flex justify-between items-center">
                                <Button variant="ghost">
                                    <Minus />
                                </Button>
                                <p>30min</p>
                                <Button variant="ghost">
                                    <Plus />
                                </Button>

                            </div>
                        </div>
                    </div>
                </div>

                <DrawerFooter>
                    <Button>Book</Button>
                    <DrawerClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    )
}