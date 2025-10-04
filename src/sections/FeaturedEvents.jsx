import React from 'react'
import Link from 'next/link'
import HeaderText from '@/components/HeaderText'
import EventCard from '@/components/EventCard'
import events from "../../public/data/events.json"

const FeaturedEvents = () => {

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
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
                {events.map((event) => (
                    <Link href={`/events/${event._id}`} key={event._id}>
                        <EventCard event={event} />
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default FeaturedEvents