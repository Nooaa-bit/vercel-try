// app/[lang]/dashboard/PendingInvitations.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface JobInvitation {
  id: number;
  job_id: number;
  shift_ids: number[];
  status: string;
  token: string;
  created_at: string;
  job: {
    position: string;
    start_date: string;
    end_date: string;
    location: {
      name: string;
    } | null;
  };
  shifts?: Array<{
    id: number;
    shift_date: string;
    start_time: string;
    end_time: string;
  }>;
}

export function PendingInvitations({ userId }: { userId: number }) {
  const [invitations, setInvitations] = useState<JobInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchInvitations();
  }, [userId]);

 const fetchInvitations = async () => {
   setLoading(true);

   try {
     console.log("Fetching invitations for userId:", userId);

     const { data: invitationsData, error: invitationsError } = await supabase
       .from("job_invitation")
       .select(
         `
        id,
        job_id,
        shift_ids,
        status,
        token,
        created_at,
        job:job_id (
          position,
          start_date,
          end_date,
          location:location_id (
            name
          )
        )
      `
       )
       .eq("user_id", userId)
       .eq("status", "pending")
       .order("created_at", { ascending: false });

     // ✅ Log the actual error values
     if (invitationsError) {
       console.error("Supabase error code:", invitationsError.code);
       console.error("Supabase error message:", invitationsError.message);
       console.error("Supabase error details:", invitationsError.details);
       console.error("Supabase error hint:", invitationsError.hint);
       throw invitationsError;
     }

     console.log("Raw invitations data:", invitationsData);

     if (invitationsData && invitationsData.length > 0) {
       const invitationsWithShifts = await Promise.all(
         invitationsData.map(async (invitation) => {
           const shiftIds = (invitation.shift_ids || []) as number[];

           console.log(
             `Fetching shifts for invitation ${invitation.id}:`,
             shiftIds
           );

           const { data: shiftsData, error: shiftsError } = await supabase
             .from("shift")
             .select("id, shift_date, start_time, end_time")
             .in("id", shiftIds)
             .is("deleted_at", null)
             .order("shift_date", { ascending: true });

           if (shiftsError) {
             console.error("Error fetching shifts:", shiftsError);
           }

           const jobData = invitation.job as unknown as Record<
             string,
             unknown
           > | null;
           const locationData = jobData?.location as Record<
             string,
             unknown
           > | null;

           return {
             id: invitation.id,
             job_id: invitation.job_id,
             shift_ids: invitation.shift_ids,
             status: invitation.status,
             token: invitation.token,
             created_at: invitation.created_at,
             job: {
               position: (jobData?.position as string) || "Unknown Position",
               start_date: (jobData?.start_date as string) || "",
               end_date: (jobData?.end_date as string) || "",
               location: locationData
                 ? {
                     name: (locationData.name as string) || "Unknown Location",
                   }
                 : null,
             },
             shifts: shiftsData || [],
           } as JobInvitation;
         })
       );

       console.log("Final invitations with shifts:", invitationsWithShifts);
       setInvitations(invitationsWithShifts);
     } else {
       console.log("No pending invitations found");
       setInvitations([]);
     }
   } catch (error) {
     // ✅ Cast error to access properties
     const err = error as {
       code?: string;
       message?: string;
       details?: string;
       hint?: string;
     };
     console.error("Error code:", err?.code);
     console.error("Error message:", err?.message);
     console.error("Error details:", err?.details);
     console.error("Error hint:", err?.hint);

     // Only show toast if it's a real error
     if (err?.message) {
       toast.error(`Failed to load invitations: ${err.message}`);
     }
   } finally {
     setLoading(false);
   }
 };


  const handleAccept = async (invitationId: number, token: string) => {
    setProcessingId(invitationId);

    try {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          `Invitation accepted! ${data.shiftsAssigned} shift(s) added.`
        );
        await fetchInvitations();
      } else {
        if (response.status === 410) {
          toast.error("Sorry, the positions have been filled.");
        } else {
          toast.error(data.error || "Failed to accept invitation");
        }
        await fetchInvitations();
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: number) => {
    if (!confirm("Are you sure you want to decline this invitation?")) {
      return;
    }

    setProcessingId(invitationId);

    try {
      const { error } = await supabase
        .from("job_invitation")
        .update({
          status: "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (error) throw error;

      toast.success("Invitation declined");
      await fetchInvitations();
    } catch (error) {
      console.error("Error declining invitation:", error);
      toast.error("Failed to decline invitation");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No pending invitations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Pending Invitations
          <Badge variant="secondary" className="ml-2">
            {invitations.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invitations.map((invitation) => (
            <Card key={invitation.id} className="border-2 border-primary/20">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-primary flex-shrink-0" />
                      <h3 className="font-semibold text-lg">
                        {invitation.job.position}
                      </h3>
                    </div>
                    <Badge variant="outline" className="bg-blue-50">
                      {invitation.shifts?.length || 0} shifts
                    </Badge>
                  </div>

                  {invitation.job.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{invitation.job.location.name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>
                      {new Date(invitation.job.start_date).toLocaleDateString()}{" "}
                      - {new Date(invitation.job.end_date).toLocaleDateString()}
                    </span>
                  </div>

                  {invitation.shifts && invitation.shifts.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase">
                        Shift Schedule
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {invitation.shifts.slice(0, 3).map((shift) => (
                          <div
                            key={shift.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span>
                              {new Date(shift.shift_date).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </span>
                            <span className="text-muted-foreground">
                              {shift.start_time.slice(0, 5)} -{" "}
                              {shift.end_time.slice(0, 5)}
                            </span>
                          </div>
                        ))}
                        {invitation.shifts.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{invitation.shifts.length - 3} more shifts
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleDecline(invitation.id)}
                      variant="outline"
                      size="sm"
                      disabled={processingId === invitation.id}
                      className="flex-1"
                    >
                      {processingId === invitation.id ? (
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-2" />
                      )}
                      Decline
                    </Button>
                    <Button
                      onClick={() =>
                        handleAccept(invitation.id, invitation.token)
                      }
                      size="sm"
                      disabled={processingId === invitation.id}
                      className="flex-1 bg-primary"
                    >
                      {processingId === invitation.id ? (
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3 mr-2" />
                      )}
                      Accept
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
