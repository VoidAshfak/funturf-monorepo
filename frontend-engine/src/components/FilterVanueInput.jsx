"use client"

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Calendar } from "./ui/calendar";

export default function FilterVenueInput({title}) {

    const [date, setDate] = useState();
    const [open, setOpen] = useState(false)

    return (
        <div className="glass-neutral p-5 rounded-2xl">
            <p className="font-semibold mb-1 text-foreground">{title}</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Select>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Sport" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="cricket">Cricket</SelectItem>
                        <SelectItem value="football">Football</SelectItem>
                    </SelectContent>
                </Select>

                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            id="date"
                            className="justify-between font-normal"
                        >
                            {date ? date.toLocaleDateString() : "Select date"}
                            <ChevronDownIcon />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={date}
                            captionLayout="dropdown"
                            onSelect={(date) => {
                                setDate(date)
                                setOpen(false)
                            }}
                        />
                    </PopoverContent>
                </Popover>

                <Select>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Area" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                </Select>

                <Button>Search</Button>
            </div>
        </div>
    )
}