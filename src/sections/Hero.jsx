import BannerCarousel from "@/components/BannerCarousel"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import Image from "next/image"

export default function Hero() {

    return (

        <div className="bg-gradient-to-r from-green-100 via-yellow-50 to-green-100 mb-10 rounded-b-[50px] md:grid grid-cols-2 gap-5 p-10 items-center">
            <div className="lg:w-2/3 mx-auto">
                <div className="flex items-center gap-2" >
                    <h1 className="text-gray-900 font-bold text-2xl lg:text-3xl">Built for players</h1>
                    <Image
                        src="https://landingfoliocom.imgix.net/store/collection/clarity-blog/images/hero/4/shape-1.svg"
                        alt="shape-1"
                        width={50}
                        height={50}
                        className="w-8"
                    />
                </div>

                <div className="flex items-center justify-center  gap-2 mt-3">
                    <h1 className="text-gray-900 font-bold text-2xl lg:text-3xl" >Made by players</h1>
                    <Image
                        src="https://landingfoliocom.imgix.net/store/collection/clarity-blog/images/hero/4/shape-2.svg"
                        alt="shape-2"
                        width={25}
                        height={25}
                        className="w-5"
                    />
                </div>

                <p className="leading-7 text-gray-900 text-center my-5">
                    Book matches, join teams, and explore venues near you with Funturf.
                </p>

                <InputGroup>
                    <InputGroupInput placeholder="Search your favourite turf ground" />
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton variant="default">Search</InputGroupButton>
                    </InputGroupAddon>
                </InputGroup>

            </div>

            <div className="rounded-2xl overflow-auto hidden md:block">
                <BannerCarousel />
            </div>
        </div>
    )
}