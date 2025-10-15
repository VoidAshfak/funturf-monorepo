"use client"

import InputField from "@/components/InputField";
import MultiSelect from "@/components/MultiSelect";
import RequiredSign from "@/components/RequiredSign";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

const players = [
    { id: 1, label: "Rizwan", value: "RIZWAN" },
    { id: 2, label: "Asif", value: "ASIF" },
    { id: 3, label: "Bappi", value: "BAPPI" },
];

export default function CreateNewEvent() {

    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
        watch
    } = useForm({
        defaultValues: {
            sport_type: 'football',
            event_type: '',
            title: '',
            description: '',
            venue_name: '',
            event_date: '',
            start_time: '',
            end_time: '',
            number_of_players_required: '',
            skill_level_required: 'any',
            current_players: []
        }
    });

    const onSubmit = (values) => {
        console.log(values)
    };

    return (
        <Dialog className="w-[500px]">
            <DialogTrigger asChild>
                <Button className="text-white bg-green-500 hover:cursor-pointer hover:bg-green-700 w-fit">
                    Create New Event
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-11/12 overflow-auto ">
                <DialogHeader className="sm:text-center">
                    <DialogTitle>Create Your Event</DialogTitle>
                    <DialogDescription>
                        Enter your information below to create your event
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="space-y-5"
                    onSubmit={handleSubmit(onSubmit)}
                >
                    <InputField errors={errors}>
                        <Controller
                            name="sport_type"
                            control={control}
                            rules={{ required: "First Select a sport" }}
                            render={({ field }) => (
                                <Select
                                    defaultValue={field.value}
                                    onValueChange={field.onChange}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select Sport" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cricket">Cricket</SelectItem>
                                        <SelectItem value="football">Football</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </InputField>

                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>Event Title <RequiredSign /> </Label>
                            <InputField errors={errors}>
                                <Input
                                    type="text"
                                    id="title"
                                    placeholder="Enter Event Title"
                                    className={`${errors?.title ? 'border-2 border-red-500' : ''}`}
                                    {...register("title", {
                                        required: "Event title is required"
                                    })}
                                />
                            </InputField>
                        </div>

                        <div className="space-y-2">
                            <Label>Event Type <RequiredSign /> </Label>
                            <InputField errors={errors}>
                                <Controller
                                    name="event_type"
                                    control={control}
                                    rules={{ required: "Select a type" }}
                                    render={({ field }) => (
                                        <Select
                                            defaultValue={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger
                                                className={`w-full ${errors?.event_type ? 'border-2 border-red-500' : ''}`}
                                            >
                                                <SelectValue placeholder="Select Event Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="friendly">Friendly</SelectItem>
                                                <SelectItem value="tournament">Tournament</SelectItem>
                                                <SelectItem value="practice">Practice</SelectItem>
                                                <SelectItem value="league">League</SelectItem>
                                                <SelectItem value="pickup">Pickup</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </InputField>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Event Details  </Label>
                        <InputField errors={errors}>
                            <Textarea
                                type="text"
                                id="description"
                                placeholder="Enter Event Details Here"
                                className={`${errors?.description ? 'border-2 border-red-500' : ''}`}
                                {...register("description")}
                            />
                        </InputField>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>Venue </Label>
                            <Controller
                                name="venue_name"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        defaultValue={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select Venue" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="venue1">Venue 1</SelectItem>
                                            <SelectItem value="venue2">Venue 2</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Date <RequiredSign /></Label>
                            <InputField errors={errors}>
                                <Controller
                                    name="event_date"
                                    control={control}
                                    rules={{ required: "Pick a date" }}
                                    render={({ field }) => (
                                        <Popover>
                                            <PopoverTrigger
                                                asChild
                                                className={`${errors?.event_date ? 'border-2 border-red-500' : ''}`}
                                            >
                                                <Button
                                                    variant="outline"
                                                    data-empty={!field.value}
                                                    className="data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal"
                                                >
                                                    <CalendarIcon />
                                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
                    </div>

                    <fieldset className="border border-gray-300 rounded-xl p-4">
                        <legend className="px-2 text-sm  text-gray-700">Select Slot</legend>
                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <InputField errors={errors}>
                                    <Input
                                        type="time"
                                        className={`${errors?.start_time ? 'border-2 border-red-500' : ''}`}
                                        {...register('start_time', {
                                            required: 'Start time is requires'
                                        })}
                                    />
                                </InputField>
                            </div>
                            <div className="space-y-2">
                                <Label>End Time</Label>
                                <InputField errors={errors}>
                                    <Input
                                        type="time"
                                        className={`${errors?.end_time ? 'border-2 border-red-500' : ''}`}
                                        {...register('end_time', {
                                            required: 'End time is requires'
                                        })}
                                    />
                                </InputField>
                            </div>
                        </div>
                    </fieldset>

                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label>Number of Players Required <RequiredSign /></Label>
                            <InputField errors={errors}>
                                <Input
                                    type="number"
                                    className={`${errors?.number_of_players_required ? 'border-2 border-red-500' : ''}`}
                                    {...register('number_of_players_required', {
                                        required: "Enter number of players required"
                                    })}
                                />
                            </InputField>
                        </div>
                        <div className="space-y-2">
                            <Label>Skill Level</Label>
                            <InputField errors={errors}>
                                <Controller
                                    name="skill_level_required"
                                    control={control}
                                    rules={{ required: "Select a skill" }}
                                    render={({ field }) => (
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select Venue" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="any">Any</SelectItem>
                                                <SelectItem value="beginner">Beginner</SelectItem>
                                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                                <SelectItem value="advanced">Advanced</SelectItem>
                                                <SelectItem value="professional">Professional</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </InputField>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="addPlayers">Add Players</Label>
                        <Controller
                            name="current_players"
                            control={control}
                            render={({ field }) => (
                                <MultiSelect
                                    options={players}
                                    values={field.value}
                                    onChange={field.onChange}
                                    placeholder="Search and select names..."
                                />
                            )}
                        />
                    </div>

                    <Button type="submit" className="w-full">Submit</Button>

                </form>
            </DialogContent>
        </Dialog>
    )
}