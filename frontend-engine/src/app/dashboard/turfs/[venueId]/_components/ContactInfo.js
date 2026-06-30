import { getLocationString } from "@/utils/utility-functions";
import { Globe, Mail, MapPin, Phone } from "lucide-react";

export default function ContactInfo({ venue }) {
    return (
        <div className="glass-card rounded-2xl p-6 sticky top-24">
            <h3 className="text-xl font-bold text-foreground mb-4">Contact Information</h3>
            <div className="space-y-4">
                <div className="flex items-center gap-3 text-foreground">
                    <Phone className="w-5 h-5 flex-shrink-0" />
                    <span>{venue.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-foreground">
                    <Mail className="w-5 h-5 flex-shrink-0" />
                    <span className="break-all">{venue.email}</span>
                </div>
                <div className="flex items-center gap-3 text-foreground">
                    <Globe className="w-5 h-5 flex-shrink-0" />
                    <span className="break-all">{venue.website_url}</span>
                </div>
                <div className="flex items-start gap-3 text-foreground pt-2 border-t border-border">
                    <MapPin className="w-5 h-5 flex-shrink-0 mt-1" />
                    <span>
                        {venue.address_line_2}<br />
                        {getLocationString(venue.address_line_1)}
                    </span>
                </div>
            </div>
        </div>
    )
}