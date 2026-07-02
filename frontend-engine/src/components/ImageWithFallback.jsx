"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const DEFAULT_FALLBACK = "/assets/images/banner1.jpg";

/**
 * next/image wrapper that swaps to a local fallback when the source fails to
 * load (broken URL, or a remote host the image optimizer can't reach — e.g.
 * imgbb timing out). Server components can't handle `onError`, so this thin
 * client component owns that behaviour. All other Image props are forwarded.
 */
export default function ImageWithFallback({
    src,
    fallback = DEFAULT_FALLBACK,
    alt = "",
    ...props
}) {
    const [imgSrc, setImgSrc] = useState(src || fallback);

    // Keep in sync if the parent passes a new src (e.g. list re-render).
    useEffect(() => {
        setImgSrc(src || fallback);
    }, [src, fallback]);

    // Remote (user-uploaded) images bypass the Next server image optimizer and
    // load directly in the browser. The optimizer fetches the origin server-side
    // and times out on hosts like imgbb (slow / header-based throttling), even
    // though the same URL opens fine in a browser. Local assets stay optimized.
    const isRemote = typeof imgSrc === "string" && /^https?:\/\//.test(imgSrc);

    return (
        <Image
            {...props}
            src={imgSrc}
            alt={alt}
            unoptimized={isRemote || props.unoptimized}
            onError={() => setImgSrc(fallback)}
        />
    );
}
