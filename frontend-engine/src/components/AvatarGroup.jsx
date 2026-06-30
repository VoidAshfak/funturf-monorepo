import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import allUser from "@/../public/data/users.json";

// Synchronous + client-safe: reads the local users seed directly so this can be
// rendered inside client components (e.g. the events filter explorer).
export default function AvatarGroup({ people = [] }) {

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
