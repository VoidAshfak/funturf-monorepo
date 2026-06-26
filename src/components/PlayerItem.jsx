import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { users } from "@/lib/users";
import { getIndividualUser } from "@/utils/getData";
import Link from "next/link";

export default async function PlayerItem({ userId }) {

    // const userInfo = await getIndividualUser(userId)
    const userInfo = users.find(user => user._id === userId);

    const { fullName, profilePicture, role } = userInfo;

    return (
        <Link
            href={`/profile/${userId}`}
            className="flex items-center gap-5 rounded-xl p-2 hover:bg-accent"
        >
            <Avatar className="w-10 h-10">
                <AvatarImage src={profilePicture} alt="@profile" />
                <AvatarFallback>PF</AvatarFallback>
            </Avatar>
            <div>
                <h1 className="font-bold text-foreground">{fullName}</h1>
                <p className="text-muted-foreground">{role}</p>
            </div>
        </Link>
    )
}