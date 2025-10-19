import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Generate time options in 30-minute intervals
const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const hourStr = hour.toString().padStart(2, '0');
            const minuteStr = minute.toString().padStart(2, '0');
            const time24 = `${hourStr}:${minuteStr}`;

            // Format for display (12-hour format)
            const period = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            const displayTime = `${hour12}:${minuteStr} ${period}`;

            times.push({ value: time24, label: displayTime });
        }
    }
    return times;
};

export function TimePicker({ value, onChange, error }) {
    const timeOptions = generateTimeOptions();

    return (
        <Select value={value ?? undefined} onValueChange={onChange}>
            <SelectTrigger className={`w-[180px] ${error ? 'border-2 border-red-500' : ''}`}>
                <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
                {timeOptions.map((time) => (
                    <SelectItem key={time.value} value={time.value}>
                        {time.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}