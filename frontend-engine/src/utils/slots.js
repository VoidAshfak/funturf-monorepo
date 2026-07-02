// 90-minute discrete slot grid — mirrors the boolean columns on the backend
// `slots` table (t0000 … t2230). Keep in sync with backend SLOT_CODES.
export const SLOT_CODES = [
    "t0000", "t0130", "t0300", "t0430", "t0600", "t0730", "t0900", "t1030",
    "t1200", "t1330", "t1500", "t1630", "t1800", "t1930", "t2100", "t2230",
];

const SLOT_MINUTES = 90;

// "t1800" -> { h: 18, m: 0 }
const parse = (code) => ({
    h: parseInt(code.slice(1, 3), 10),
    m: parseInt(code.slice(3, 5), 10),
});

const to12h = (h, m) => {
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

// "t1800" -> "6:00 PM"
export function slotStartLabel(code) {
    const { h, m } = parse(code);
    return to12h(h, m);
}

// "t1800" -> "6:00 – 7:30 PM" (start + 90 min)
export function slotRangeLabel(code) {
    const { h, m } = parse(code);
    const total = h * 60 + m + SLOT_MINUTES;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${to12h(h, m)} – ${to12h(eh, em)}`;
}
