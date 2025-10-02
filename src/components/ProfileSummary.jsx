export default function ProfileSummary({ user }) {
    const { eventsJoined, teams, friends } = user;
    return (
        <div className="flex gap-10 mt-5">
            <div className="flex flex-col items-center">
                <p className="text-xl font-bold text-slate-700">{eventsJoined.length}</p>
                <p className="text-sm text-slate-400">Games</p>
            </div>
            <div className="flex flex-col items-center">
                <p className="text-xl font-bold text-slate-700">{teams.length}</p>
                <p className="text-sm text-slate-400">Teams</p>
            </div>
            <div className="flex flex-col items-center">
                <p className="text-xl font-bold text-slate-700">{friends.length}</p>
                <p className="text-sm text-slate-400">Friends</p>
            </div>
        </div>
    )
}