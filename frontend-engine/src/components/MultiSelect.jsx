"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";

export default function MultiSelect({
    options = [],
    values = [],
    onChange,
    placeholder = "Select items...",
    maxBadges = 2,
}) {
    const [open, setOpen] = useState(false);

    const allSelected = values.length === options.length;

    const toggleSelect = (option) => {
        const exists = values.find((item) => item.value === option.value);
        if (exists) {
            const updated = values.filter((item) => item.value !== option.value);
            onChange(updated);
        } else {
            const updated = [...values, option];
            onChange(updated);
        }
    };

    const handleSelectAll = () => {
        if (allSelected) {
            onChange([]);
        } else {
            onChange(options);
        }
    };

    const visibleBadges = values.slice(0, maxBadges);
    const remainingCount = values.length - maxBadges;

    return (
        <div className="w-full">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        <div className="flex flex-wrap items-center gap-1 text-left">
                            {values.length > 0 ? (
                                <>
                                    {visibleBadges.map((item) => (
                                        <Badge
                                            key={item.value}
                                            variant="secondary"
                                            className="flex items-center gap-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {item.label}
                                            <X
                                                className="h-3 w-3 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelect(item);
                                                }}
                                            />
                                        </Badge>
                                    ))}
                                    {remainingCount > 0 && (
                                        <Badge variant="secondary" className="px-2">
                                            +{remainingCount} more
                                        </Badge>
                                    )}
                                </>
                            ) : (
                                <span className="text-muted-foreground">{placeholder}</span>
                            )}
                        </div>
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>

                <PopoverContent className="w-full p-0 bg-background">
                    <Command>
                        <CommandInput placeholder="Search..." />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>

                            <CommandGroup>
                                <CommandItem onSelect={handleSelectAll}>
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            allSelected ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {allSelected ? "Deselect All" : "Select All"}
                                </CommandItem>
                            </CommandGroup>

                            <CommandGroup>
                                {options.map((option) => {
                                    const isSelected = values.some(
                                        (item) => item.value === option.value
                                    );
                                    return (
                                        <CommandItem
                                            key={option.value}
                                            onSelect={() => toggleSelect(option)}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    isSelected ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {option.label}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
