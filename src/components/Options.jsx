"use client"

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useState } from "react"

export function Options({ placeholder, className, options, name, id }) {
    const [value, setValue] = useState("")
    return (
        <>
            <Select onValueChange={setValue}>
                <SelectTrigger className={`${className}`}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {options.map((item) =>
                            <SelectItem key={item.id} value={item.value}> {item.name} </SelectItem>
                        )}
                    </SelectGroup>
                </SelectContent>
            </Select>
            <input type="hidden" id={id} name={name} value={value} />
        </>
    )
}
