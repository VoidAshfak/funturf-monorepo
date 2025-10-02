import React from 'react'
import Link from 'next/link'
import EventCard from '@/components/EventCard'
import events from "../../../../../public/data/events.json"
import { users } from '@/lib/users'
import { getIndividualUser } from '@/utils/getData'
import ProfileCard from '@/components/ProfileCard'
import Image from 'next/image'

const UserProfile = async ({ params }) => {

    const { userId } = await params
    const user = users.find(user => user._id === userId)

    // const user = await getIndividualUser(userId);

    return (
        <>
            <div className='relative'>
                <div className="relative w-full h-[500px]">
                    <Image
                        src="/assets/images/bg3.jpg"
                        alt="banner image"
                        fill
                        priority
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl"></div>
                </div>

                <div className='bg-white w-4/5 md:w-2/3 absolute left-[11%] -bottom-[35%] md:left-[17%] md:-bottom-[20%] rounded-2xl'>
                    <ProfileCard user={user} />
                </div>
            </div>

            <div className="w-4/5 mx-auto mt-60 md:mt-40">
                <h1 className="font-bold text-3xl text-gray-700 pb-4"> Events </h1>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
                    {events.map((event) => (
                        <Link href={`/events/${event._id}`} key={event._id}>
                            <EventCard event={event} />
                        </Link>
                    ))}
                </div>
            </div>
        </>
    )
}


export default UserProfile