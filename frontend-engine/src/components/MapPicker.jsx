"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

// Leaflet's default marker asset URLs break under bundlers; point them at the CDN.
const markerIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

// Dhaka — sensible default center for a Bangladesh-first product.
const DEFAULT_CENTER = [23.8103, 90.4125];

function ClickToPlace({ onPick }) {
    useMapEvents({
        click(e) {
            onPick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

/**
 * Interactive map to pick a location. Click anywhere or drag the pin to set the
 * coordinates; calls onChange({ lat, lng }) with 6-decimal strings. Rendered
 * client-only (see the dynamic import in StepOne) since Leaflet needs `window`.
 */
export default function MapPicker({ value, onChange }) {
    const hasValue = value?.lat && value?.lng;
    const initial = hasValue ? [Number(value.lat), Number(value.lng)] : null;
    const [pos, setPos] = useState(initial);

    const pick = (lat, lng) => {
        const next = [lat, lng];
        setPos(next);
        onChange({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-border">
            <MapContainer
                center={initial || DEFAULT_CENTER}
                zoom={hasValue ? 15 : 12}
                scrollWheelZoom={false}
                style={{ height: 320, width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickToPlace onPick={pick} />
                {pos && (
                    <Marker
                        position={pos}
                        icon={markerIcon}
                        draggable
                        eventHandlers={{
                            dragend: (e) => {
                                const m = e.target.getLatLng();
                                pick(m.lat, m.lng);
                            },
                        }}
                    />
                )}
            </MapContainer>
        </div>
    );
}
