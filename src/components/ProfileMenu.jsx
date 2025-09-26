import { Settings, User, Users } from "lucide-react";
import LogoutButton from "./LogoutButton";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "./ui/dropdown-menu";

export default function ProfileMenu({ session }) {

    const { user } = session;
    const [firstName, secondName] = user.fullName.split(' ');

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Avatar className={"cursor-pointer h-10 w-10"}>
                    <AvatarImage src={user.image} alt="@profile" />
                    <AvatarFallback>{firstName[0] + (secondName[0] ?? '')}</AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mr-6">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem
                    >
                        <User />
                        <span>Profile</span>
                        <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                    </DropdownMenuItem>

                    <DropdownMenuItem>
                        <Settings />
                        <span>Settings</span>
                        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
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

                <LogoutButton />

            </DropdownMenuContent>
        </DropdownMenu>
    )
}