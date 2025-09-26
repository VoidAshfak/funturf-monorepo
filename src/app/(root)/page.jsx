import Banner from "@/sections/Banner";
import FeaturedEvents from "@/sections/FeaturedEvents";
import FeaturedTurfs from "@/sections/FeaturedTurfs";
import Hero from "@/sections/Hero";


export default function Home() {
    return (
        <>
            <Hero />
            {/* <Turfmates /> */}
            <FeaturedTurfs />
            <FeaturedEvents />
            <Banner />
        </>
    );
}
