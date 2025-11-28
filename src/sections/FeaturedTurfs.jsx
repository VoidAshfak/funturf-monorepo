import HeaderText from '@/components/HeaderText'
import VenueListWrapper from '@/components/VenueListWrapper'
import Link from 'next/link'

const FeaturedTurfs = () => {

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

            <VenueListWrapper max={6} />
        </div>
    )
}

export default FeaturedTurfs