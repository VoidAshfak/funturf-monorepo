import { LayoutDashboard, Settings, User, Users } from "lucide-react";
import LogoutButton from "./LogoutButton";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import Link from "next/link";

export default function ProfileMenu({ session }) {

    const { user } = session ?? {};

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Avatar className={"cursor-pointer h-10 w-10"}>
                    <AvatarImage src={user?.image} alt="@profile" />
                    <AvatarFallback> {user?.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}</AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mr-6">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard">
                            <LayoutDashboard />
                            <span>Dashboard</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuGroup>
                    <DropdownMenuItem asChild
                    >
                        <Link href={`/profile/${user?.id}`}>
                            <User />
                            <span>Profile</span>
                        </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <Settings />
                        <span>Settings</span>
                    </DropdownMenuItem>

                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <Users />
                        <span>Team</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                    <LogoutButton />
                </DropdownMenuItem>

            </DropdownMenuContent>
        </DropdownMenu>
    )
}