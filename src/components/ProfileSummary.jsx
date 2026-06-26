export default function ProfileSummary({ user }) {
    const { eventsJoined, teams, friends } = user;
    return (
        <div className="flex gap-10 mt-5">
            <div className="flex flex-col items-center">
                <p className="text-xl font-bold text-foreground">{eventsJoined ?? 0}</p>
                <p className="text-sm text-muted-foreground">Games</p>
            </div>
            <div className="flex flex-col items-center">
                <p className="text-xl font-bold text-foreground">{teams ?? 0}</p>
                <p className="text-sm text-muted-foreground">Teams</p>
            </div>
            <div className="flex flex-col items-center">
                <p className="text-xl font-bold text-foreground">{friends ?? 0}</p>
                <p className="text-sm text-muted-foreground">Friends</p>
            </div>
        </div>
    )
}