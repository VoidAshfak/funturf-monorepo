"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import "leaflet/dist/leaflet.css";

/**
 * The landing page's live city map.
 *
 * Purely a renderer: it owns the Leaflet instance and nothing else. Data
 * fetching, the layer toggle and the selected turf all live in the CityPulse
 * section above it, so this component can stay a thin, testable surface and the
 * list and the map can never disagree about what is selected.
 *
 * Leaflet is imported inside the effect (not at module scope) because it touches
 * `window` on import — the same pattern EventMap uses.
 */

// Central Dhaka. Used until the visitor asks for their own location.
export const DHAKA_CENTER = [23.8103, 90.4125];

function tileUrl(theme) {
    return theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
}

const TILE_OPTS = {
    maxZoom: 19,
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

/**
 * Marker html. The count IS the marker — a turf with 9 free slots should read
 * differently at a glance from one with 1, without needing the popup.
 *
 * @param {number} count   number shown in the pill
 * @param {boolean} active is this the turf selected in the list
 * @param {"slots"|"matches"} layer drives the colour
 */
function markerHtml(count, active, layer) {
    const tone = layer === "matches" ? "ft-pin-matches" : "ft-pin-slots";
    const state = active ? " ft-pin-active" : "";
    const dim = count === 0 ? " ft-pin-empty" : "";
    return `<span class="ft-count-marker ${tone}${state}${dim}">
        <span class="ft-count-pulse"></span>
        <span class="ft-count-value">${count}</span>
    </span>`;
}

export default function CityPulseMap({
    turfs = [],
    center = DHAKA_CENTER,
    layer = "slots",
    activeId = null,
    onSelect,
}) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const tileRef = useRef(null);
    const markerLayerRef = useRef(null);
    // Marker instances by turf id, so selection can restyle one marker without
    // tearing down and rebuilding the entire layer.
    const markersRef = useRef(new Map());
    // Latest onSelect without making it an effect dependency — otherwise every
    // parent render would rebuild every marker.
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    const { resolvedTheme } = useTheme();
    const [ready, setReady] = useState(false);

    // ---- init (once) ------------------------------------------------------
    useEffect(() => {
        let cancelled = false;
        let map;

        (async () => {
            const L = (await import("leaflet")).default;
            if (cancelled || !containerRef.current) return;

            map = L.map(containerRef.current, {
                zoomControl: true,
                // Scroll-wheel zoom off: the map is mid-page, and hijacking the
                // wheel traps a visitor who is only trying to scroll past it.
                scrollWheelZoom: false,
                attributionControl: true,
            }).setView(center, 12);

            mapRef.current = map;
            tileRef.current = L.tileLayer(tileUrl(resolvedTheme), TILE_OPTS).addTo(map);
            markerLayerRef.current = L.layerGroup().addTo(map);

            setTimeout(() => map && map.invalidateSize(), 60);
            setReady(true);
        })();

        return () => {
            cancelled = true;
            if (map) map.remove();
            mapRef.current = null;
            tileRef.current = null;
            markerLayerRef.current = null;
            markersRef.current.clear();
        };
        // Init only — `center` changes are handled by the flyTo effect below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- theme tiles ------------------------------------------------------
    useEffect(() => {
        (async () => {
            if (!mapRef.current || !tileRef.current) return;
            const L = (await import("leaflet")).default;
            mapRef.current.removeLayer(tileRef.current);
            tileRef.current = L.tileLayer(tileUrl(resolvedTheme), TILE_OPTS).addTo(
                mapRef.current
            );
        })();
    }, [resolvedTheme]);

    // ---- recenter ---------------------------------------------------------
    useEffect(() => {
        if (!mapRef.current || !center) return;
        mapRef.current.flyTo(center, 12, { duration: 0.8 });
    }, [center]);

    // ---- markers ----------------------------------------------------------
    useEffect(() => {
        if (!ready || !markerLayerRef.current) return;
        let cancelled = false;

        (async () => {
            const L = (await import("leaflet")).default;
            if (cancelled || !markerLayerRef.current) return;

            markerLayerRef.current.clearLayers();
            markersRef.current.clear();

            for (const turf of turfs) {
                if (!Number.isFinite(turf.lat) || !Number.isFinite(turf.lng)) continue;

                const count = layer === "matches" ? turf.open_matches : turf.open_slots;
                const marker = L.marker([turf.lat, turf.lng], {
                    icon: L.divIcon({
                        className: "funturf-count-marker",
                        html: markerHtml(count ?? 0, turf.id === activeId, layer),
                        iconSize: [40, 40],
                        iconAnchor: [20, 20],
                    }),
                    // Keyboard-reachable: Leaflet markers are focusable, and the
                    // title is what a screen reader announces.
                    title: `${turf.name} — ${count ?? 0} ${
                        layer === "matches" ? "open matches" : "free slots"
                    }`,
                    riseOnHover: true,
                });

                marker.on("click", () => onSelectRef.current?.(turf.id));
                marker.addTo(markerLayerRef.current);
                markersRef.current.set(turf.id, marker);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [turfs, layer, ready, activeId]);

    // ---- pan to the selected turf ----------------------------------------
    useEffect(() => {
        if (!activeId || !mapRef.current) return;
        const turf = turfs.find((t) => t.id === activeId);
        if (!turf || !Number.isFinite(turf.lat) || !Number.isFinite(turf.lng)) return;
        mapRef.current.panTo([turf.lat, turf.lng], { animate: true, duration: 0.5 });
    }, [activeId, turfs]);

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="h-full w-full" />
            {!ready && (
                <div className="shimmer pointer-events-none absolute inset-0 z-[500]" />
            )}
        </div>
    );
}
