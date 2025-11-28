import BookVenue from "@/components/BookVenue"
import HeaderText from "@/components/HeaderText"
import { ImageCarousel } from "@/components/ImageCarousel"
import RatingText from "@/components/RatingText"
import { Button } from "@/components/ui/button"
import VenueListWrapper from "@/components/VenueListWrapper"
import { getIndividualVenueByVenueId } from "@/utils/getData"
import { Clock, Share2 } from 'lucide-react'
import AvailableSports from "./_components/AvailableSports"
import VenueFacilities from "./_components/VenueFacilities"

const VenueDetails = async ({ params }) => {
    const { venueId } = await params;
    const { data: venue } = await getIndividualVenueByVenueId(venueId);

    const { name, address_line_1, rating, ratingCount = 105, images, sports_available, facilities, operating_hours, description, grounds = [] } = venue;
    const venueImages = [images.cover, ...grounds.flatMap(ground => ground.images)];

    return (

        <div className="w-[90%] mx-auto">
            <div className="md:flex justify-between my-10">
                <HeaderText
                    title={name}
                    subtitle={address_line_1}
                    mapIcon={true}
                />
                <RatingText rating={rating} ratingCount={ratingCount} />
            </div>

            <div className="lg:grid grid-cols-3">
                <div className="col-span-2">
                    <ImageCarousel images={venueImages} />
                </div>

                <div className="space-y-3 mt-5 lg:mt-0">
                    <div className="shadow-sm shadow-gray-300 rounded-lg p-4 ">
                        <div className="grid grid-cols-2 grid-rows-2 gap-4">
                            <div className="col-span-2 ">
                                <BookVenue venue={venue} />
                            </div>

                            <div className="row-start-2">
                                <Button
                                    className={`w-full hover:bg-green-200 cursor-pointer`}
                                    variant={"outline"}
                                >
                                    <Share2 />
                                    Share
                                </Button>
                            </div>
                            <div className="row-start-2">
                                <Button
                                    className={`w-full hover:bg-green-200 cursor-pointer`}
                                    variant={"outline"}
                                >
                                    Corporate/Bulk
                                </Button>
                            </div>
                        </div>

                    </div>

                    <div className="shadow-sm shadow-gray-300 rounded-lg p-4 ">
                        <h1 className="font-bold items-center flex pb-5"> <Clock className="mr-2" /> Open Time</h1>
                        <p> {operating_hours.opening_time} - {operating_hours.closing_time} </p>
                    </div>

                    <div className="shadow-sm shadow-gray-300 rounded-lg p-4 ">
                        <h1 className="font-bold">Location</h1>
                        <p>{address_line_1}</p>
                    </div>
                </div>
            </div>

            <div className="shadow-sm shadow-gray-300 rounded-lg p-4 my-5">
                <h1 className="font-bold text-2xl">
                    Available Sports at {name}
                </h1>
                <p className="text-gray-500">(Click on sports to view price chart)</p>

                <AvailableSports
                    sports_available={sports_available ?? []}
                />
            </div>

            <div className="shadow-sm shadow-gray-300 rounded-lg p-4 my-5">
                <h1 className="font-bold text-2xl">
                    Facilities
                </h1>

                <VenueFacilities
                    facilities={facilities ?? []}
                />
            </div>

            <div className="shadow-sm shadow-gray-300 rounded-lg p-4 my-5">
                <h1 className="font-bold text-2xl">
                    About {name}
                </h1>
                <pre className="whitespace-pre-wrap text-sm text-gray-800 py-10">{description}</pre>
            </div>

            <div className="mt-10">
                <h1 className="font-bold text-2xl">
                    Related Venues
                </h1>

                <VenueListWrapper />
            </div>
        </div>
    )
}

export default VenueDetails