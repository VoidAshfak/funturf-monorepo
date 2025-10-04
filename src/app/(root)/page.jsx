import Banner from "@/sections/Banner";
import FeaturedEvents from "@/sections/FeaturedEvents";
import FeaturedTurfs from "@/sections/FeaturedTurfs";
import Hero from "@/sections/Hero";


export default function Home() {
    return (
        <>
            <Hero />
            {/* <Turfmates /> */}
            <div className="bg-white m-10 md:m-20 rounded-2xl p-5 md:p-10 space-y-20">
                <FeaturedTurfs />
                <FeaturedEvents />
            </div>
            <Banner />
        </>
    );
}
