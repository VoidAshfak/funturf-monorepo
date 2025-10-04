import HeaderText from '@/components/HeaderText'
import { VenueCard } from '@/components/VenueCard'
import Link from 'next/link'
import venues from "../../public/data/venues.json"

const FeaturedTurfs =  () => {

    return (
        <div>
            <HeaderText title="Featured Turfs" subtitle="Check out our featured turfs" center={true} className="" />
            <div className='flex justify-end items-center my-5'>
                <Link
                    className='text-gray-700 underline hover:text-green-600 cursor-pointer font-bold'
                    href="/venues"
                >
                    See all Turfs →
                </Link>
            </div>
            <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-5'>
                {venues.map((venue) => (
                    <Link href={`/venues/${venue._id}`} key={venue._id}>
                        <VenueCard venue={venue} />
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default FeaturedTurfs