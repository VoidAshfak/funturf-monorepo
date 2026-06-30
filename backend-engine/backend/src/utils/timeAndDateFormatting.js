import { ApiError } from "./apiError.js";

export function slotKeyToMinutes(slotKey) {
    // expects format like "t0000", "t0130", "t1800"
    const hh = Number(slotKey.slice(1, 3));
    const mm = Number(slotKey.slice(3, 5));
    return hh * 60 + mm;
}

export function minutesToTimeString(minutes) {
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

export function parseSlotCodeToTime(slotCode) {
    // 't0730' -> '07:30:00'
    if (!/^t\d{4}$/.test(slotCode)) {
        throw new ApiError(`Invalid slotCode: ${slotCode}`);
    }
    const hours = parseInt(slotCode.slice(1, 3), 10);
    const mins = parseInt(slotCode.slice(3, 5), 10);

    return `${hours.toString().padStart(2, "0")}:${mins
        .toString()
        .padStart(2, "0")}:00`;
}
