import EventListWrapper from '@/components/EventListWrapper'
import HeaderText from '@/components/HeaderText'
import Link from 'next/link'

export default function FeaturedEvents() {

    return (
        <div>
            <HeaderText title="Discover Games" subtitle="Pick a game to play" center={true} className="" />
            <div className='flex justify-end items-center my-5'>
                <Link
                    className='text-gray-700 underline hover:text-green-600 cursor-pointer font-bold'
                    href="/events"
                >
                    See all Matches →
                </Link>
            </div>

            <EventListWrapper />
        </div>
    )
}