import { UserPlus } from "lucide-react";
import { Button } from "./ui/button";
import Image from "next/image";
import { Separator } from "./ui/separator";
import PlayerProfileImage from "./PlayerProfileImage";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import ProfileSummary from "./ProfileSummary";
import { getUserByUserId } from "@/utils/getData";
import EmptyState from "./EmptyState";

export default async function ProfileCard({ userId }) {

    const result = await getUserByUserId(userId);

    if (!result.ok) {
        return (
            <EmptyState
                title="No User Found"
            />
        );
    }

    const userData = result.data;

    const {
        email,
        username,
        phone,
        first_name,
        last_name,
        date_of_birth,
        gender,
        profile_picture_url,
        bio,
        user_type,
        sports,
        teams,
        eventsJoined,
        friends
    } = userData;

    return (
        <div className="relative">
            <div className="border p-5 rounded-2xl">
                <div className="flex flex-col md:flex-row items-center justify-center md:justify-between">
                    <div className="flex gap-5">
                        <Avatar className="h-14 w-14 md:hidden">
                            <AvatarImage src={profile_picture_url} alt="@profile" />
                            <AvatarFallback>{first_name?.[0] + last_name?.[0]}</AvatarFallback>
                        </Avatar>

                        <div className="text-center md:text-start mb-3 md:m-0">
                            <h1 className="text-2xl text-foreground font-bold">{first_name + ' ' + last_name}</h1>
                            <p className="text-muted-foreground font-bold">@{username}</p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        className=""
                    >
                        <UserPlus />
                        Connect
                    </Button>
                </div>

                <div className="flex justify-center md:justify-start gap-4 mt-4">
                    {(sports ?? []).map((sport, index) => (
                        <Image
                            key={index}
                            src={`/assets/icons/${sport.toLowerCase()}.png`}
                            alt={sport}
                            width={20}
                            height={20}
                        />
                    ))}
                </div>

                <div className="flex justify-center md:hidden">
                    <ProfileSummary user={userData} />
                </div>

                <Separator className="mt-12 mb-7" />

                <p className="text-muted-foreground text-center lg:w-4/5 mx-auto">{bio} </p>

            </div>

            <div className="hidden md:inline-flex flex-col items-center absolute -top-20 left-2/5">
                <PlayerProfileImage user={userData} />
            </div>
        </div>
    )
}