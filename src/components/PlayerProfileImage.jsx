import ProfileSummary from "./ProfileSummary";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export default function PlayerProfileImage({ user }) {
    const { profile_picture_url, first_name, last_name } = user;
    return (
        <>
            <Avatar className="w-36 h-36">
                <AvatarImage src={profile_picture_url} alt="@profile" />
                <AvatarFallback>{first_name?.[0] + last_name?.[0]}</AvatarFallback>
            </Avatar>

            <ProfileSummary user={user} />
        </>
    )
}