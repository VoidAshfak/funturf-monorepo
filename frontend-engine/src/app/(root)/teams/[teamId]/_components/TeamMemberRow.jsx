"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Shield, Star, UserMinus, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import ConfirmDialog from "@/components/ConfirmDialog";
import { notifyError } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROLE_LABEL, playerInitials, playerName } from "@/utils/teams";
import {
    useRemoveTeamMemberMutation,
    useTransferCaptaincyMutation,
    useUpdateTeamMemberMutation,
} from "@/store/api/apiSlice";

// Sentinel for "no position" — Radix Select can't hold an empty-string value.
const NO_POSITION = "__none__";

/**
 * One roster row: the player, their role and position, and the controls that act
 * on them.
 *
 * Controls are shown by role (`isCaptain` / `isSelf`) purely so the UI isn't
 * cluttered with buttons that would 403. The backend re-checks every one of
 * these — hiding a button is never the authorization boundary.
 */
export default function TeamMemberRow({ member, teamId, isCaptain, isSelf, positions = [] }) {
    const [updateMember, { isLoading: updating }] = useUpdateTeamMemberMutation();
    const [removeMember] = useRemoveTeamMemberMutation();
    const [transferCaptaincy] = useTransferCaptaincyMutation();

    const [confirmRemove, setConfirmRemove] = useState(false);
    const [confirmTransfer, setConfirmTransfer] = useState(false);

    const user = member.user ?? {};
    const name = playerName(user);
    const profile = user.profile ?? {};
    const isTargetCaptain = member.role === "captain";

    // The captain manages everyone but themself; a member may only leave.
    const canManage = isCaptain && !isTargetCaptain;
    const canLeave = isSelf && !isTargetCaptain;

    const run = async (fn, fallback) => {
        try {
            await fn().unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, fallback));
            throw err; // keeps ConfirmDialog open so the toast is readable
        }
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3">
            {/* identity + form */}
            <Link href={`/profile/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={user.profile_picture_url} alt={name} />
                    <AvatarFallback>{playerInitials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold text-foreground">
                        {name}
                        {isTargetCaptain && <Crown className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        {member.role === "co_captain" && (
                            <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                    </p>
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>{ROLE_LABEL[member.role] ?? "Member"}</span>
                        {member.position?.position_name && (
                            <span className="text-primary">{member.position.position_name}</span>
                        )}
                        {profile.rating != null && (
                            <span className="flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-current text-amber-500" />
                                {Number(profile.rating).toFixed(1)}
                            </span>
                        )}
                        {profile.reliability_score != null && (
                            <span>{profile.reliability_score}% reliable</span>
                        )}
                    </span>
                </div>
            </Link>

            {/* captain-only controls */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {canManage && (
                    <>
                        {/* position */}
                        <Select
                            value={member.position?.id ?? NO_POSITION}
                            disabled={updating}
                            onValueChange={(value) =>
                                run(
                                    () =>
                                        updateMember({
                                            teamId,
                                            userId: user.id,
                                            position_id: value === NO_POSITION ? null : value,
                                        }),
                                    "Could not change that position."
                                ).catch(() => {})
                            }
                        >
                            <SelectTrigger size="sm" className="w-[9.5rem]">
                                <SelectValue placeholder="Position" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_POSITION}>No position</SelectItem>
                                {positions.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.position_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* role */}
                        <Select
                            value={member.role}
                            disabled={updating}
                            onValueChange={(role) =>
                                run(
                                    () => updateMember({ teamId, userId: user.id, role }),
                                    "Could not change that role."
                                ).catch(() => {})
                            }
                        >
                            <SelectTrigger size="sm" className="w-[8.5rem]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="co_captain">Co-captain</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => setConfirmTransfer(true)}
                        >
                            <Crown className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmRemove(true)}
                        >
                            <UserMinus className="h-4 w-4" />
                        </Button>
                    </>
                )}

                {canLeave && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setConfirmRemove(true)}
                    >
                        <LogOut className="h-4 w-4" />
                        Leave
                    </Button>
                )}
            </div>

            {/* Both destructive paths route through the same confirm gate. */}
            <ConfirmDialog
                open={confirmRemove}
                onOpenChange={setConfirmRemove}
                Icon={isSelf ? LogOut : UserMinus}
                title={isSelf ? "Leave this team?" : `Remove ${name}?`}
                description={
                    isSelf
                        ? "You'll drop off the roster. The captain can invite you back later."
                        : "They'll drop off the roster and be told. You can invite them back later."
                }
                confirmLabel={isSelf ? "Leave" : "Remove"}
                cancelLabel="Stay on the roster"
                onConfirm={() =>
                    run(
                        () => removeMember({ teamId, userId: user.id }),
                        isSelf ? "Could not leave the team." : "Could not remove that player."
                    )
                }
            />

            <ConfirmDialog
                open={confirmTransfer}
                onOpenChange={setConfirmTransfer}
                Icon={Crown}
                tone="default"
                title={`Make ${name} captain?`}
                description="They take over the team and you become a regular member. Only they can hand it back."
                confirmLabel="Hand over"
                cancelLabel="Keep the armband"
                onConfirm={() =>
                    run(
                        () => transferCaptaincy({ teamId, newCaptainId: user.id }),
                        "Could not transfer the captaincy."
                    )
                }
            />
        </div>
    );
}
