"use client"

import { getLocationString, getStatusColor } from "@/utils/utility-functions";
import { Clock, Globe, Mail, MapPin, Phone, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminVenueCard({ venue }) {
    const { id, name, description, status, address_line_1, address_line_2, phone, email, website_url, total_grounds, rating, total_bookings, sports_available, facilities, operating_hours } = venue;

    const router = useRouter();

    return (
        <div
            className="glass-card rounded-2xl overflow-hidden transition-shadow duration-300 cursor-pointer"
            onClick={() => router.push(`/dashboard/turfs/${id}`)}
        >
            {/* Card Header */}
            <div className="bg-gradient-to-r from-brand-dark to-brand p-6 text-white">
                <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-bold">{name}</h3>
                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                        <span>{status}</span>
                    </div>
                </div>
                <p className="text-white/80 text-sm">{description}</p>
            </div>

            {/* Card Body */}
            <div className="p-6">
                {/* Location */}
                <div className="flex items-start gap-3 mb-4 text-foreground">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                        <p>{getLocationString(address_line_1)}</p>
                        <p>{address_line_2}</p>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 gap-3 mb-4">
                    <div className="flex items-center gap-3 text-foreground text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{phone}</span>
                    </div>

                    <div className="flex items-center gap-3 text-foreground text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{email}</span>
                    </div>

                    {website_url && (
                        <div className="flex items-center gap-3 text-foreground text-sm">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <Link
                                className="text-primary hover:underline"
                                href={website_url}
                                prefetch={false}
                                onClick={(e) => e.stopPropagation()}
                            >
                                Visit Website
                            </Link>
                        </div>
                    )}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-border mb-4">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{total_grounds}</p>
                        <p className="text-xs text-muted-foreground mt-1">Grounds</p>
                    </div>
                    <div className="text-center border-l border-r border-border">
                        <p className="text-2xl font-bold text-foreground flex items-center justify-center gap-1">
                            {rating}
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Rating</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{total_bookings}</p>
                        <p className="text-xs text-muted-foreground mt-1">Bookings</p>
                    </div>
                </div>

                {/* Sports & Facilities */}
                <div className="space-y-3">
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">SPORTS AVAILABLE</p>
                        <div className="flex flex-wrap gap-2">
                            {sports_available.map((sport, idx) => (
                                <span key={idx} className="px-3 py-1 bg-primary/15 text-primary rounded-full text-xs font-medium">
                                    {sport}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">FACILITIES</p>
                        <div className="flex flex-wrap gap-2">
                            {facilities.slice(0, 4).map((facility, idx) => (
                                <span key={idx} className="px-3 py-1 bg-accent text-foreground rounded-full text-xs">
                                    {facility}
                                </span>
                            ))}
                            {facilities.length > 4 && (
                                <span className="px-3 py-1 bg-accent text-foreground rounded-full text-xs">
                                    +{facilities.length - 4} more
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{operating_hours.opening_time} - {operating_hours.closing_time}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}