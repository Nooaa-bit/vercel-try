//hype-hire/vercel/components/TimePickerSelect.tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface TimePickerSelectProps {
  value: string; // Format: "HH:MM"
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
}

export function TimePickerSelect({
  value,
  onChange,
  label,
  required = false,
}: TimePickerSelectProps) {
  // Generate hours (00-23)
  const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
  );

  // Generate minutes in 15-minute intervals
  const minutes = ["00", "15", "30", "45"];

  // Parse current value
  const [currentHour, currentMinute] = value.split(":");

  const handleHourChange = (hour: string) => {
    onChange(`${hour}:${currentMinute || "00"}`);
  };

  const handleMinuteChange = (minute: string) => {
    onChange(`${currentHour || "00"}:${minute}`);
  };

  return (
    <div>
      <Label className="text-sm font-medium">
        {label} {required && "*"}
      </Label>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {/* Hour Select */}
        <Select value={currentHour} onValueChange={handleHourChange}>
          <SelectTrigger>
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent>
            {hours.map((hour) => (
              <SelectItem key={hour} value={hour}>
                {hour}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Minute Select */}
        <Select value={currentMinute} onValueChange={handleMinuteChange}>
          <SelectTrigger>
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent>
            {minutes.map((minute) => (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
