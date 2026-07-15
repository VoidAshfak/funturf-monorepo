"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { CameraOff, Loader2 } from "lucide-react";

const REGION_ID = "qr-scan-region";

// Live camera QR scanner (html5-qrcode). Calls `onDecode(text)` once per detected
// code, then keeps scanning; the parent decides what to do (it usually unmounts
// this once a booking resolves). Handles camera permission / no-camera gracefully.
//
// html5-qrcode is imperative and needs a real DOM node, so it can't be an SSR
// component — this file is client-only and mounts the camera in an effect.
export default function QrScanner({ onDecode, onError }) {
    const scannerRef = useRef(null);
    const lastRef = useRef({ text: null, at: 0 });
    const [status, setStatus] = useState("starting"); // starting | scanning | error

    useEffect(() => {
        const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = scanner;

        let cancelled = false;
        let startPromise = Promise.resolve();

        const handleDecoded = (text) => {
            // De-dupe: the camera fires the same code many times a second.
            const now = Date.now();
            if (lastRef.current.text === text && now - lastRef.current.at < 2500) return;
            lastRef.current = { text, at: now };
            onDecode?.(text);
        };

        // Defer the actual camera start by a tick. React strict mode mounts then
        // immediately unmounts the effect in dev; without this the camera opens
        // and is torn down in the same tick, which makes the browser log
        // "the fetching process for the media resource was aborted". Deferring
        // lets that throwaway mount cancel BEFORE the camera ever opens — one
        // clean start, no abort.
        const startTimer = setTimeout(() => {
            if (cancelled) return;
            startPromise = scanner
                .start(
                    { facingMode: "environment" }, // rear camera on phones
                    { fps: 10, qrbox: { width: 240, height: 240 } },
                    handleDecoded,
                    () => {} // per-frame "not found" noise — ignore
                )
                .then(() => {
                    if (!cancelled) setStatus("scanning");
                })
                .catch((err) => {
                    if (!cancelled) {
                        setStatus("error");
                        onError?.(err);
                    }
                });
        }, 0);

        return () => {
            cancelled = true;
            clearTimeout(startTimer);
            // Tear down only after start settles, and only if actually running —
            // stopping a not-yet-running scanner throws synchronously.
            startPromise.finally(() => {
                try {
                    const state = scanner.getState?.();
                    if (
                        state === Html5QrcodeScannerState.SCANNING ||
                        state === Html5QrcodeScannerState.PAUSED
                    ) {
                        scanner.stop().then(() => scanner.clear()).catch(() => {});
                    } else {
                        scanner.clear?.();
                    }
                } catch {
                    // scanner never came up — nothing to tear down
                }
            });
        };
    }, [onDecode, onError]);

    return (
        <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
                {/* html5-qrcode injects the <video> here. */}
                <div id={REGION_ID} className="mx-auto w-full" />

                {status === "starting" && (
                    <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm text-white">
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
                        </span>
                    </div>
                )}
                {status === "error" && (
                    <div className="grid place-items-center gap-2 p-10 text-center text-sm text-muted-foreground">
                        <CameraOff className="h-8 w-8" />
                        <p>Couldn&apos;t access the camera.</p>
                        <p className="text-xs">
                            Allow camera access, or use manual verification instead.
                        </p>
                    </div>
                )}
            </div>
            {status === "scanning" && (
                <p className="text-center text-xs text-muted-foreground">
                    Point the camera at the player&apos;s ticket QR.
                </p>
            )}
        </div>
    );
}
