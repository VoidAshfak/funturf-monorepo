import { z } from "zod";

/**
 * Zod schemas for the Create-New-Turf wizard. Required fields mirror the DB
 * NOT NULL columns (see backend prisma schema):
 *   turfs   -> name, address_line_1(area), city(district), state(division), country
 *   grounds -> name, hourly_rate  (+ sport_type: product-essential)
 * Everything else is optional. Messages are written to be friendly.
 *
 * NOTE: every object uses `.passthrough()` so validating one step never strips
 * fields owned by other steps (the wizard shares one formdata object).
 */

// Bangladeshi mobile: optional +880 / 880 / 0 prefix, then 1[3-9] + 8 digits.
export const bdPhoneRegex = /^(?:\+?880|0)1[3-9]\d{8}$/;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Optional string that also accepts an empty field.
const optionalText = z.string().trim().optional();

// Optional BD phone — valid only when provided.
const phoneOptional = z
    .string()
    .trim()
    .refine((v) => !v || bdPhoneRegex.test(v), {
        message: "Enter a valid Bangladeshi mobile number, e.g. 01712345678",
    })
    .optional();

// Optional email — valid only when provided.
const emailOptional = z
    .string()
    .trim()
    .refine((v) => !v || emailRegex.test(v), {
        message: "Please enter a valid email address",
    })
    .optional();

// Coordinate coming from the map picker — string or number, optional.
const coordinate = z.union([z.string(), z.number()]).optional();

// ---- Step 1: basics, address, contact ----
export const stepOneSchema = z
    .object({
        name: z.string().trim().min(1, "Please enter your turf's name"),
        description: optionalText,
        address_line_1: z
            .object({
                area: z.string().trim().min(1, "Please add the area or street address"),
                city: z.string().trim().min(1, "Please enter the district"),
                state: z.string().trim().min(1, "Please choose a division"),
                country: z.string().trim().min(1, "Country is required").default("Bangladesh"),
                postal_code: optionalText,
                latitude: coordinate,
                longitude: coordinate,
            })
            .passthrough(),
        address_line_2: optionalText, // landmark — not required
        phone: phoneOptional,
        email: emailOptional,
        website_url: optionalText,
        establishment_year: optionalText,
    })
    .passthrough();

// ---- Step 2: hours, sports, facilities, policies, image (all optional per DB) ----
export const stepTwoSchema = z
    .object({
        operating_hours: z
            .object({
                opening_time: optionalText,
                closing_time: optionalText,
            })
            .passthrough()
            .optional()
            .refine(
                (h) => !h || (!h.opening_time && !h.closing_time) || (h.opening_time && h.closing_time),
                { message: "Please set both opening and closing time" }
            ),
        sports_available: z.array(z.string()).optional(),
        facilities: z.array(z.string()).optional(),
        advance_booking_days: optionalText,
        cancellation_policy: optionalText,
        rules_and_regulations: optionalText,
        images: z.any().optional(),
    })
    .passthrough();

// ---- Step 3: grounds (name + sport_type required) ----
export const stepThreeSchema = z
    .object({
        grounds: z
            .array(
                z
                    .object({
                        name: z.string().trim().min(1, "Please name this ground"),
                        sport_type: z
                            .array(z.string())
                            .min(1, "Pick at least one sport for this ground"),
                        ground_type: optionalText,
                        surface_type: optionalText,
                        dimensions_length_m: optionalText,
                        dimensions_width_m: optionalText,
                        capacity_players: optionalText,
                        status: optionalText,
                        amenities: z.array(z.string()).optional(),
                        notes: optionalText,
                    })
                    .passthrough()
            )
            .min(1, "Add at least one ground"),
    })
    .passthrough();

// ---- Step 4: pricing (hourly_rate required) + images ----
const positiveRateOptional = z
    .string()
    .trim()
    .refine((v) => !v || Number(v) > 0, { message: "Enter an amount greater than 0" })
    .optional();

export const stepFourSchema = z
    .object({
        grounds: z
            .array(
                z
                    .object({
                        hourly_rate: z
                            .string()
                            .trim()
                            .min(1, "Please set the standard hourly rate")
                            .refine((v) => Number(v) > 0, {
                                message: "Hourly rate must be greater than 0",
                            }),
                        weekend_hourly_rate: positiveRateOptional,
                        peak_hour_rate: positiveRateOptional,
                        off_peak_hour_rate: positiveRateOptional,
                        minimum_booking_hours: optionalText,
                        maximum_booking_hours: optionalText,
                        images: z.any().optional(),
                    })
                    .passthrough()
            )
            .min(1, "Add at least one ground"),
    })
    .passthrough();
