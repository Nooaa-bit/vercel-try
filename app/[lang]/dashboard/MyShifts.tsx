// app/[lang]/dashboard/MyShifts.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Briefcase, Loader2 } from "lucide-react";

interface ShiftAssignment {
  id: number;
  shift: {
    id: number;
    shift_date: string;
    start_time: string;
    end_time: string;
    job: {
      position: string;
      location: {
        name: string;
      } | null;
    };
  };
}

export function MyShifts({ userId }: { userId: number }) {
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchShifts();
  }, [userId]);

  const fetchShifts = async () => {
    setLoading(true);

    try {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("shift_assignment")
        .select(
          `
          id,
          shift:shift_id (
            id,
            shift_date,
            start_time,
            end_time,
            job:job_id (
              position,
              location:location_id (
                name
              )
            )
          )
        `
        )
        .eq("user_id", userId)
        .is("cancelled_at", null)
        .is("deleted_at", null)
        .gte("shift.shift_date", today)
        .order("shift(shift_date)", { ascending: true })
        .limit(10);

      if (error) throw error;

      // ✅ Use double-cast through unknown
      setShifts((data as unknown as ShiftAssignment[]) || []);
    } catch (error) {
      console.error("Error fetching shifts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Upcoming Shifts</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (shifts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Upcoming Shifts</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No upcoming shifts</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          My Upcoming Shifts
          <Badge variant="secondary" className="ml-2">
            {shifts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {shifts.map((assignment) => {
            const shift = assignment.shift;
            const isToday =
              shift.shift_date === new Date().toISOString().split("T")[0];

            return (
              <Card
                key={assignment.id}
                className={`${isToday ? "border-2 border-primary" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {/* Position */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-primary flex-shrink-0" />
                        <h4 className="font-semibold">{shift.job.position}</h4>
                      </div>
                      {isToday && (
                        <Badge variant="default" className="bg-primary">
                          Today
                        </Badge>
                      )}
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>
                        {new Date(shift.shift_date).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>
                        {shift.start_time.slice(0, 5)} -{" "}
                        {shift.end_time.slice(0, 5)}
                      </span>
                    </div>

                    {/* Location */}
                    {shift.job.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span>{shift.job.location.name}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
