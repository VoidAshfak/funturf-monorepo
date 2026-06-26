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
import { getLocationString } from "@/utils/utility-functions"

const VenueDetails = async ({ params }) => {
    const { venueId } = await params;
    const { data: venue } = await getIndividualVenueByVenueId(venueId);

    const { name, address_line_1, address_line_2, rating, ratingCount = 105, images, sports_available, facilities, operating_hours, description, grounds = [] } = venue;
    const venueImages = [images[0], ...grounds.flatMap(ground => ground.images)];

    return (

        <div className="w-[90%] mx-auto md:pt-24">
            <div className="md:flex justify-between my-10">
                <HeaderText
                    title={name}
                    subtitle={getLocationString(address_line_1)}
                    mapIcon={true}
                />
                <RatingText rating={rating} ratingCount={ratingCount} />
            </div>

            <div className="lg:grid grid-cols-3">
                <div className="col-span-2">
                    <ImageCarousel images={venueImages} />
                </div>

                <div className="space-y-3 mt-5 lg:mt-0">
                    <div className="glass-card rounded-2xl p-4 ">
                        <div className="grid grid-cols-2 grid-rows-2 gap-4">
                            <div className="col-span-2 ">
                                <BookVenue venue={venue} />
                            </div>

                            <div className="row-start-2">
                                <Button
                                    className={`w-full cursor-pointer`}
                                    variant={"outline"}
                                >
                                    <Share2 />
                                    Share
                                </Button>
                            </div>
                            <div className="row-start-2">
                                <Button
                                    className={`w-full cursor-pointer`}
                                    variant={"outline"}
                                >
                                    Corporate/Bulk
                                </Button>
                            </div>
                        </div>

                    </div>

                    <div className="glass-card rounded-2xl p-4 ">
                        <h1 className="font-bold items-center flex pb-5"> <Clock className="mr-2" /> Open Time</h1>
                        <p> {operating_hours.opening_time} - {operating_hours.closing_time} </p>
                    </div>

                    <div className="glass-card rounded-2xl p-4 ">
                        <h1 className="font-bold">Location</h1>
                        <p>{getLocationString(address_line_1)}</p>
                        <p className=" text-muted-foreground">({address_line_2})</p>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-2xl p-4 my-5">
                <h1 className="font-bold text-2xl">
                    Available Sports at {name}
                </h1>
                <p className="text-muted-foreground">(Click on sports to view price chart)</p>

                <AvailableSports
                    sports_available={sports_available ?? []}
                />
            </div>

            <div className="glass-card rounded-2xl p-4 my-5">
                <h1 className="font-bold text-2xl">
                    Facilities
                </h1>

                <VenueFacilities
                    facilities={facilities ?? []}
                />
            </div>

            <div className="glass-card rounded-2xl p-4 my-5">
                <h1 className="font-bold text-2xl">
                    About {name}
                </h1>
                <pre className="whitespace-pre-wrap text-sm text-foreground/90 py-10">{description}</pre>
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