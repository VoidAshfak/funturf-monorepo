import Image from "next/image";
import ProfileSummary from "./ProfileSummary";

export default function PlayerProfileImage({ user }) {
    const { profilePicture, eventsJoined, teams, friends } = user;
    return (
        <>
            <Image
                src={profilePicture}
                alt="User Image"
                width={150}
                height={150}
                className="shadow-2xl shadow-gray-400 rounded-full"
            />

            <ProfileSummary user={user} />
        </>
    )
}