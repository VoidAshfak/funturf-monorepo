import BookVenue from "@/components/BookVenue"
import { ImageCarousel } from "@/components/ImageCarousel"
import MapDialog from "@/components/MapDialog"
import { Button } from "@/components/ui/button"
import VenueListWrapper from "@/components/VenueListWrapper"
import { getIndividualVenueByVenueId } from "@/utils/getData"
import { getLocationString } from "@/utils/utility-functions"
import {
    CalendarRange,
    Clock,
    LayoutGrid,
    Mail,
    MapPin,
    Phone,
    Share2,
    Shield,
    Sparkles,
    Star,
    Trophy,
    Users,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import AvailableSports from "./_components/AvailableSports"
import VenueFacilities from "./_components/VenueFacilities"

const prettify = (s = "") =>
    String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

const VenueDetails = async ({ params }) => {
    const { venueId } = await params;
    const { data: venue } = await getIndividualVenueByVenueId(venueId);

    const {
        name,
        address_line_1,
        address_line_2,
        rating = 0,
        ratingCount = 105,
        images = [],
        sports_available = [],
        facilities = [],
        operating_hours,
        description,
        grounds = [],
        establishment_year,
        verified,
        phone,
        email,
        website_url,
    } = venue;

    const venueImages = [images[0], ...grounds.flatMap((g) => g.images || [])].filter(Boolean);
    const locationText = address_line_1 ? getLocationString(address_line_1) : "Location TBA";

    const mapLat = Number(address_line_1?.latitude);
    const mapLng = Number(address_line_1?.longitude);
    const mapAddress = [address_line_2, locationText].filter(Boolean).join(", ");

    // cheapest hourly rate across grounds for a "from" price
    const rates = grounds
        .map((g) => Number(g.hourly_rate))
        .filter((n) => Number.isFinite(n) && n > 0);
    const fromRate = rates.length ? Math.min(...rates) : null;
    const currency = grounds.find((g) => g.currency)?.currency || "BDT";

    const totalCapacity = grounds.reduce(
        (sum, g) => sum + (Number(g.capacity_players) || 0),
        0
    );

    return (
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:px-8 md:pt-24">
            {/* HERO */}
            <section className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b from-[#eaf2ee] to-[#e6f1ec] p-6 dark:from-[#0a1412] dark:to-[#0a0a0a] md:p-10">
                <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal/20 blur-[120px]" />
                <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.15] dark:opacity-[0.1]"
                    style={{
                        backgroundImage:
                            "radial-gradient(rgba(29,185,84,0.5) 1px, transparent 1px)",
                        backgroundSize: "22px 22px",
                        maskImage: "radial-gradient(ellipse at top, black, transparent 80%)",
                        WebkitMaskImage:
                            "radial-gradient(ellipse at top, black, transparent 80%)",
                    }}
                />

                <div className="relative flex flex-col gap-6">
                    {/* top row: rating + verified */}
                    <div className="flex items-center justify-between gap-3">
                        <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-foreground">
                            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                            {rating > 0 ? rating : "New"}
                            {rating > 0 && (
                                <span className="font-medium text-muted-foreground">
                                    ({ratingCount})
                                </span>
                            )}
                        </span>
                        {verified ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                                <Shield className="h-3.5 w-3.5" />
                                Verified
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                                <Shield className="h-3.5 w-3.5" />
                                Unverified
                            </span>
                        )}
                    </div>

                    {/* title */}
                    <h1 className="max-w-2xl bg-gradient-to-r from-brand to-teal bg-clip-text text-3xl font-extrabold leading-tight text-transparent dark:from-brand-light md:text-5xl">
                        {name}
                    </h1>

                    {/* sports chips */}
                    {sports_available.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {sports_available.map((sport) => (
                                <span
                                    key={sport}
                                    className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize text-foreground"
                                >
                                    <Image
                                        src={`/assets/icons/${String(sport).toLowerCase()}.png`}
                                        alt={sport}
                                        width={14}
                                        height={14}
                                    />
                                    {sport}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* meta pills */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <MetaPill
                            icon={MapPin}
                            label={address_line_2 || locationText}
                            sub={address_line_2 ? locationText : null}
                            action={
                                <MapDialog
                                    compact
                                    lat={mapLat}
                                    lng={mapLng}
                                    address={mapAddress}
                                    label={name}
                                />
                            }
                        />
                        <MetaPill
                            icon={Clock}
                            label={
                                operating_hours
                                    ? `${operating_hours.opening_time} – ${operating_hours.closing_time}`
                                    : "Hours TBA"
                            }
                            sub="Open daily"
                        />
                    </div>

                    {/* price */}
                    {fromRate != null && (
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-sm text-muted-foreground">From</span>
                            <span className="text-2xl font-extrabold text-foreground">
                                {currency} {fromRate.toLocaleString()}
                            </span>
                            <span className="text-sm text-muted-foreground">/ hr</span>
                        </div>
                    )}
                </div>
            </section>

            {/* BODY */}
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
                {/* LEFT */}
                <div className="space-y-6 lg:col-span-2">
                    <div className="glass-card overflow-hidden rounded-3xl p-3">
                        <ImageCarousel images={venueImages} />
                    </div>

                    {/* quick stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard icon={LayoutGrid} value={grounds.length} label="Grounds" />
                        <StatCard
                            icon={Users}
                            value={totalCapacity || "—"}
                            label="Capacity"
                        />
                        <StatCard
                            icon={CalendarRange}
                            value={establishment_year || "—"}
                            label="Since"
                        />
                    </div>

                    {/* available sports */}
                    <div className="glass-card rounded-3xl p-5 md:p-7">
                        <SectionTitle
                            icon={Trophy}
                            title="Available Sports"
                            sub="Tap a sport to view its price chart"
                        />
                        <AvailableSports sports_available={sports_available} />
                    </div>

                    {/* grounds & pricing */}
                    {grounds.length > 0 && (
                        <div className="glass-card rounded-3xl p-5 md:p-7">
                            <SectionTitle
                                icon={LayoutGrid}
                                title="Grounds & Pricing"
                                sub={`${grounds.length} ground${grounds.length === 1 ? "" : "s"} at this venue`}
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                                {grounds.map((g) => (
                                    <GroundCard key={g.id} ground={g} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* facilities */}
                    <div className="glass-card rounded-3xl p-5 md:p-7">
                        <SectionTitle icon={Sparkles} title="Facilities" />
                        <VenueFacilities facilities={facilities} />
                    </div>

                    {/* about */}
                    {description && (
                        <div className="glass-card rounded-3xl p-5 md:p-7">
                            <SectionTitle icon={MapPin} title={`About ${name}`} />
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                                {description}
                            </pre>
                        </div>
                    )}
                </div>

                {/* RIGHT aside */}
                <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
                    <div className="glass-card rounded-3xl p-5">
                        {fromRate != null && (
                            <div className="mb-4 flex items-baseline gap-1.5">
                                <span className="text-sm text-muted-foreground">From</span>
                                <span className="text-xl font-extrabold text-foreground">
                                    {currency} {fromRate.toLocaleString()}
                                </span>
                                <span className="text-sm text-muted-foreground">/ hr</span>
                            </div>
                        )}
                        <BookVenue venue={venue} />
                        <Button variant="outline" className="mt-3 w-full">
                            <Share2 className="h-4 w-4" />
                            Share
                        </Button>
                    </div>

                    {(phone || email) && (
                        <div className="glass-card rounded-3xl p-5">
                            <h3 className="mb-3 font-bold text-foreground">Contact</h3>
                            <div className="space-y-2 text-sm">
                                {phone && (
                                    <a
                                        href={`tel:${phone}`}
                                        className="flex items-center gap-2 text-foreground/90 transition-colors hover:text-primary"
                                    >
                                        <Phone className="h-4 w-4 text-primary" /> {phone}
                                    </a>
                                )}
                                {email && (
                                    <a
                                        href={`mailto:${email}`}
                                        className="flex items-center gap-2 break-all text-foreground/90 transition-colors hover:text-primary"
                                    >
                                        <Mail className="h-4 w-4 text-primary" /> {email}
                                    </a>
                                )}
                                {website_url && (
                                    <Link
                                        href={website_url}
                                        target="_blank"
                                        className="flex items-center gap-2 break-all text-primary hover:underline"
                                    >
                                        <Sparkles className="h-4 w-4" /> Website
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* RELATED */}
            <div className="mt-16">
                <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Keep exploring
                </span>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                    Related{" "}
                    <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                        Venues
                    </span>
                </h2>
                <div className="mt-6">
                    <VenueListWrapper max={3} />
                </div>
            </div>
        </div>
    )
}

function SectionTitle({ icon: Icon, title, sub }) {
    return (
        <div className="mb-4 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </span>
            <div>
                <h2 className="text-xl font-bold text-foreground md:text-2xl">{title}</h2>
                {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
            </div>
        </div>
    );
}

function MetaPill({ icon: Icon, label, sub, action }) {
    return (
        <div className="glass-chip flex items-center gap-3 rounded-2xl px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{label}</p>
                {sub && <p className="truncate text-sm text-muted-foreground">{sub}</p>}
            </div>
            {action}
        </div>
    );
}

function StatCard({ icon: Icon, value, label }) {
    return (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl p-4 text-center">
            <Icon className="mb-1.5 h-5 w-5 text-primary" />
            <p className="text-lg font-extrabold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}

function GroundCard({ ground }) {
    const rate = Number(ground.hourly_rate);
    const sports = Array.isArray(ground.sport_type) ? ground.sport_type : [];
    return (
        <div className="glass-neutral rounded-2xl border border-border/60 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">{ground.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                        {prettify(ground.surface_type)}
                        {ground.capacity_players ? ` · ${ground.capacity_players} players` : ""}
                    </p>
                </div>
                {Number.isFinite(rate) && rate > 0 && (
                    <div className="shrink-0 text-right">
                        <p className="text-sm font-extrabold text-primary">
                            {ground.currency || "BDT"} {rate.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">per hour</p>
                    </div>
                )}
            </div>
            {sports.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {sports.map((s) => (
                        <span
                            key={s}
                            className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-primary"
                        >
                            {s}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default VenueDetails
