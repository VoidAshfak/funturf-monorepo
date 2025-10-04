import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { InfoIcon } from "lucide-react"

export default function ErrorTooltip({ message }) {
    return (
        <Tooltip>
            <TooltipTrigger>
                <InfoIcon className="text-red-500"/>
            </TooltipTrigger>
            <TooltipContent>
                <p>{message}</p>
            </TooltipContent>
        </Tooltip>
    )
}