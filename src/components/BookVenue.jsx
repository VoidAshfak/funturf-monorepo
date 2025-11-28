"use client"

import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from "@/components/ui/drawer";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useMediaQuery } from "@/hooks/use-media-query";
import { format } from "date-fns";
import { CalendarCheck2, CalendarIcon, Minus, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import InputField from "./InputField";
import { TimePicker } from "./TimePicker";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export default function BookVenue({ venue }) {
    const { id, name, address, sports_available } = venue;

    const isDesktop = useMediaQuery("(min-width: 768px)");

    const {
        register,
        control,
        setValue,
        watch,
        handleSubmit,
        formState: { errors }
    } = useForm({
        defaultValues: {
            ground_id: id,
            sport_type: sports_available[0].toLowerCase(),
            user_id: null, // check
            event_id: null, // check
            booking_date: null,
            start_time: null,
            end_time: null, // check
            duration_hours: 0.5,
            total_amount: null,
            discount_amount: null,
            final_amount: null,
            payment_method: null,
            transaction_id: null,
        }
    });

    const { duration_hours } = watch();

    const onSubmit = (values) => {
        console.log(values)
    };

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

                <form
                    className="h-full"
                    onSubmit={handleSubmit(onSubmit)}
                >
                    <div className="p-5 flex flex-col justify-between h-full space-y-5">
                        <div></div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2">
                                <Label>Sport</Label>
                                <Controller
                                    name="sport_type"
                                    control={control}
                                    rules={{ required: "First Select a sport" }}
                                    render={({ field }) => (
                                        <Select
                                            defaultValue={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select Sport" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sports_available.map((sport, index) => (
                                                    <SelectItem
                                                        key={index}
                                                        value={sport.toLowerCase()}
                                                    >{sport}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2">
                                <Label>Date</Label>
                                <InputField errors={errors}>
                                    <Controller
                                        name="booking_date"
                                        control={control}
                                        rules={{ required: 'Pick a date' }}
                                        render={({ field }) => (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        data-empty={!field.value}
                                                        className={`data-[empty=true]:text-muted-foreground w-[180px] justify-start text-left font-normal ${errors.booking_date ? 'border-2 border-red-500' : ''}`}
                                                    >
                                                        <CalendarIcon />
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a pick</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    />
                                </InputField>
                            </div>

                            <div className="grid grid-cols-2">
                                <Label>Start Time</Label>
                                <InputField errors={errors}>
                                    <Controller
                                        name="start_time"
                                        control={control}
                                        rules={{ required: 'Start time is required' }}
                                        render={({ field }) => (
                                            <TimePicker
                                                value={field.value}
                                                onChange={field.onChange}
                                                error={errors?.start_time}
                                            />
                                        )}
                                    />
                                </InputField>
                            </div>

                            <div className="grid grid-cols-2">
                                <Label>Duration</Label>
                                <div className="flex justify-between items-center">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        disabled={duration_hours === 0.5}
                                        onClick={() => setValue('duration_hours', duration_hours - 0.5)}
                                    >
                                        <Minus />
                                    </Button>
                                    <p>{duration_hours * 60}min</p>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setValue('duration_hours', duration_hours + 0.5)}
                                    >
                                        <Plus />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Button
                                type="submit"
                                className="w-full">Book</Button>
                            <DrawerClose asChild>
                                <Button variant="outline" className="w-full">Cancel</Button>
                            </DrawerClose>
                        </div>
                    </div>
                </form>
            </DrawerContent>
        </Drawer>
    )
}