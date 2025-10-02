import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAllUser } from "@/utils/getData";

export default async function AvatarGroup({ people = [] }) {

    const allUser = await getAllUser();

    const participantsInfo = allUser
        .filter(eachUser => people.includes(eachUser._id))
        .map(eachParticipant => ({ id: eachParticipant._id, name: eachParticipant.fullName, image: eachParticipant.profilePicture }));

    return (
        <div className="flex items-center -space-x-2 *:ring-3 *:ring-background">
            {participantsInfo.slice(0, 3).map(user => (
                <Avatar
                    key={user.id}
                >
                    <AvatarImage src={user.image} alt={user.name} />
                    <AvatarFallback>
                        {user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                    </AvatarFallback>
                </Avatar>
            ))}
            {participantsInfo.length > 3 && (
                <Avatar className="z-10 text-sm font-medium text-muted-foreground">
                    <AvatarFallback>
                        +{participantsInfo.slice(3).reduce((acc) => acc + 1, 0)}
                    </AvatarFallback>
                </Avatar>
            )}
        </div>
    );
}
