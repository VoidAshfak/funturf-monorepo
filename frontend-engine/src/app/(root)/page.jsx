import Banner from "@/sections/Banner";
import FeaturedEvents from "@/sections/FeaturedEvents";
import FeaturedTurfs from "@/sections/FeaturedTurfs";
import Hero from "@/sections/Hero";


export default function Home() {
    return (
        <>
            <Hero />
            {/* <Turfmates /> */}
            <div className="m-6 md:mx-16 md:my-16">
                <FeaturedTurfs />
            </div>
            <div className="m-6 md:mx-16 md:mb-16">
                <FeaturedEvents />
            </div>
            {/* <Banner /> */}
        </>
    );
}
