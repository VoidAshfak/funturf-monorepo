import { Clock, Star, MapPin } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import Image from "next/image"

export function VenueCard({ className, venue }) {
    return (
        <Card className={`border-0 transition-all duration-300 will-change-transform hover:shadow-lg hover:-translate-y-2 hover:z-10 cursor-pointer ${className}`}>
            <CardHeader>
                <CardTitle className="min-h-6 w-10/12 bg-gradient-to-r from-black via-blue-500 to-green-500 inline-block text-transparent bg-clip-text"> {venue?.name} </CardTitle>
                <CardDescription className="flex gap-1 items-center">
                    <MapPin className="w-4 shrink-0" />
                    <span className="line-clamp-1">
                        {venue?.address_line_1}
                    </span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Image
                    src={venue.images?.cover || "/assets/images/venue-v1"}
                    alt="Venue Image"
                    width={300}
                    height={300}
                    className="w-full h-[180px] object-cover rounded-2xl"
                />
            </CardContent>
            <CardFooter className="flex justify-between">
                <div className="flex items-center gap-1">
                    <Clock className="w-4" />
                    {/* <p className="text-sm font-semibold"> {venue?.availability} </p> */}
                </div>
                <div className="flex items-center gap-1">
                    <Star className="w-4 text-yellow-500" />
                    <p className="text-sm font-semibold"> {venue?.rating} </p>
                </div>
            </CardFooter>

        </Card>
    )
}
