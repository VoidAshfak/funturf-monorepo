import { UserPlus } from "lucide-react";
import { Button } from "./ui/button";
import Image from "next/image";
import { Separator } from "./ui/separator";
import PlayerProfileImage from "./PlayerProfileImage";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import ProfileSummary from "./ProfileSummary";

export default function ProfileCard({ user }) {
    const { username, email, fullName, bio, profilePicture, role, sports, teams, eventsJoined, friends } = user;
    return (
        <div className="relative">
            <div className="border p-5 rounded-2xl">
                <div className="flex flex-col md:flex-row items-center justify-center md:justify-between">
                    <div className="flex gap-5">
                        <Avatar className="h-14 w-14 md:hidden">
                            <AvatarImage src={profilePicture} alt="@profile" />
                            <AvatarFallback>{fullName}</AvatarFallback>
                        </Avatar>

                        <div className="text-center md:text-start mb-3 md:m-0">
                            <h1 className="text-2xl text-slate-700 font-bold ">{fullName}</h1>
                            <p className="text-slate-400 font-bold">@{username}</p>
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
                    {sports.map((sport, index) => (
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
                    <ProfileSummary user={user} />
                </div>

                <Separator className="mt-12 mb-7" />

                <p className="text-slate-600 text-center lg:w-4/5 mx-auto">{bio}  Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptates suscipit iusto odit repellat harum ullam, saepe, doloribus fuga nemo maiores libero et quod cum mollitia laudantium expedita cupiditate laboriosam aspernatur.</p>

            </div>

            <div className="hidden md:inline-flex flex-col items-center absolute -top-20 left-1/3">
                <PlayerProfileImage user={user} />
            </div>
        </div>
    )
}