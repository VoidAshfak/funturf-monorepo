"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [23.8103, 90.4125]; // Dhaka fallback

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

// Free geocoding via OpenStreetMap Nominatim (no API key).
async function geocode(query) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
                query
            )}`,
            { headers: { Accept: "application/json" } }
        );
        const data = await res.json();
        if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch {
        /* ignore — fall through to default */
    }
    return null;
}

export default function EventMap({ lat, lng, address, label }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const tileRef = useRef(null);
    const { resolvedTheme } = useTheme();
    const [ready, setReady] = useState(false);

    // Init the map once for the given location.
    useEffect(() => {
        let cancelled = false;
        let map;

        (async () => {
            const L = (await import("leaflet")).default;

            let center =
                Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
            if (!center && address) center = await geocode(address);
            if (!center) center = DEFAULT_CENTER;
            if (cancelled || !containerRef.current) return;

            map = L.map(containerRef.current, {
                zoomControl: true,
                scrollWheelZoom: false,
                attributionControl: true,
            }).setView(center, 15);
            mapRef.current = map;

            tileRef.current = L.tileLayer(tileUrl(resolvedTheme), TILE_OPTS).addTo(map);

            const icon = L.divIcon({
                className: "funturf-marker",
                html: '<span class="ft-marker"><span class="ft-pulse"></span><span class="ft-pin"></span></span>',
                iconSize: [30, 40],
                iconAnchor: [15, 38],
                popupAnchor: [0, -34],
            });
            const marker = L.marker(center, { icon }).addTo(map);
            if (label || address) {
                marker.bindPopup(
                    `<strong>${label ?? ""}</strong>${
                        address ? `<br/><span class="ft-popup-sub">${address}</span>` : ""
                    }`
                );
            }

            // Container animates in (dialog) — recompute size next tick.
            setTimeout(() => map && map.invalidateSize(), 60);
            setReady(true);
        })();

        return () => {
            cancelled = true;
            if (map) map.remove();
            mapRef.current = null;
            tileRef.current = null;
        };
    }, [lat, lng, address, label]);

    // Swap tiles when the theme changes.
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

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="h-full w-full" />
            {!ready && (
                <div className="shimmer pointer-events-none absolute inset-0 z-[500]" />
            )}
        </div>
    );
}
