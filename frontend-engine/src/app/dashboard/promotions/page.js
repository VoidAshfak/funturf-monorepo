import PromotionsManager from "@/components/PromotionsManager";

// Turf-admin coupon manager. Data is admin-scoped + interaction-driven, so it's
// fetched client-side via RTK Query inside PromotionsManager (same pattern as the
// dashboard overview).
export default function PromotionsPage() {
    return <PromotionsManager />;
}
