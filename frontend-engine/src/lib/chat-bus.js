// Tiny decoupled bus so anything on the page (e.g. a profile "Message" button)
// can ask the navbar chat box to open a specific DM, without prop-drilling or
// shared state. Fires a window CustomEvent the ChatLauncher listens for.

const OPEN_DM_EVENT = "funturf:open-dm";

// Ask the navbar chat box to open a DM thread with `userId`. `title`/`avatar`
// seed the header before the thread loads.
export function openDm({ userId, title, avatar }) {
    if (typeof window === "undefined" || !userId) return;
    window.dispatchEvent(
        new CustomEvent(OPEN_DM_EVENT, { detail: { userId, title, avatar } })
    );
}

// Subscribe to open-DM requests. Returns an unsubscribe fn.
export function onOpenDm(handler) {
    if (typeof window === "undefined") return () => {};
    const listener = (e) => handler(e.detail);
    window.addEventListener(OPEN_DM_EVENT, listener);
    return () => window.removeEventListener(OPEN_DM_EVENT, listener);
}
