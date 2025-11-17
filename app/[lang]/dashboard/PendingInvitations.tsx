"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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

interface Location {
  name: string;
}

interface Job {
  position: string;
  start_date: string;
  end_date: string;
  location: Location | null;
}

interface Shift {
  id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
}

interface JobInvitation {
  id: number;
  job_id: number;
  shift_ids: number[];
  status: string;
  invited_by: number;
  created_at: string;
  job: Job;
  shifts: Shift[];
}

export function PendingInvitations({ userId }: { userId: number }) {
  const { t, i18n } = useTranslation("job-invitation");
  const [invitations, setInvitations] = useState<JobInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchInvitations();

    // Real-time subscription
    const channel = supabase
      .channel("invitations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_invitation",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchInvitations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchInvitations = async () => {
    setLoading(true);

    try {
      // Fetch invitations
      const { data: invitationsData, error: invitationsError } = await supabase
        .from("job_invitation")
        .select("id, job_id, shift_ids, status, invited_by, created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (invitationsError) throw invitationsError;

      if (!invitationsData || invitationsData.length === 0) {
        setInvitations([]);
        setLoading(false);
        return;
      }

      // Get unique job IDs
      const jobIds = [...new Set(invitationsData.map((inv) => inv.job_id))];

      // Fetch all jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from("job")
        .select(
          `
          id,
          position,
          start_date,
          end_date,
          location_id,
          location:location_id (
            name
          )
        `
        )
        .in("id", jobIds);

      if (jobsError) throw jobsError;

      // Create job lookup map
      const jobsMap = new Map(
        (jobsData || []).map((job) => [
          job.id,
          {
            position: job.position,
            start_date: job.start_date,
            end_date: job.end_date,
            location:
              Array.isArray(job.location) && job.location.length > 0
                ? { name: job.location[0].name }
                : null,
          },
        ])
      );

      // Get all shift IDs from all invitations
      const allShiftIds = invitationsData.flatMap((inv) => inv.shift_ids || []);
      const uniqueShiftIds = [...new Set(allShiftIds)];

      // Fetch all shifts at once
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shift")
        .select("id, shift_date, start_time, end_time")
        .in("id", uniqueShiftIds)
        .is("deleted_at", null)
        .order("shift_date", { ascending: true });

      if (shiftsError) throw shiftsError;

      // Create shift lookup map
      const shiftsMap = new Map(
        (shiftsData || []).map((shift) => [shift.id, shift])
      );

      // Combine everything
      const invitationsWithDetails = invitationsData.map((invitation) => {
        const job = jobsMap.get(invitation.job_id) || {
          position: "Unknown Position",
          start_date: "",
          end_date: "",
          location: null,
        };

        const shifts = (invitation.shift_ids || [])
          .map((shiftId: number) => shiftsMap.get(shiftId))
          .filter(Boolean) as Shift[];

        return {
          id: invitation.id,
          job_id: invitation.job_id,
          shift_ids: invitation.shift_ids || [],
          status: invitation.status,
          invited_by: invitation.invited_by,
          created_at: invitation.created_at,
          job,
          shifts,
        };
      });

      setInvitations(invitationsWithDetails);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      toast.error(t("toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

const handleAccept = async (invitation: JobInvitation) => {
  setProcessingId(invitation.id);

  try {
    const shiftIds = invitation.shift_ids;
    const shiftsToAssign: number[] = [];
    const now = new Date().toISOString();

    // Check each shift for availability
    for (const shiftId of shiftIds) {
      const { data: shift } = await supabase
        .from("shift")
        .select("workers_needed")
        .eq("id", shiftId)
        .is("deleted_at", null)
        .single();

      if (!shift) continue;

      const { count } = await supabase
        .from("shift_assignment")
        .select("*", { count: "exact", head: true })
        .eq("shift_id", shiftId)
        .is("cancelled_at", null)
        .is("deleted_at", null);

      if ((count || 0) < shift.workers_needed) {
        shiftsToAssign.push(shiftId);
      }
    }

    if (shiftsToAssign.length === 0) {
      // All positions filled
      await supabase
        .from("job_invitation")
        .update({
          status: "spots_filled",
          spots_filled_at: now,
          responded_at: now,
          updated_at: now,
        })
        .eq("id", invitation.id);

      toast.error(t("toast.spotsFilled"));
      await fetchInvitations();
      return;
    }

    // Track which shifts will be full after assignment
    const shiftsNowFull: number[] = [];

    // Process each shift - reactivate or create
    for (const shiftId of shiftsToAssign) {
      // Check current capacity
      const { data: shift } = await supabase
        .from("shift")
        .select("workers_needed")
        .eq("id", shiftId)
        .single();

      const { count: currentCount } = await supabase
        .from("shift_assignment")
        .select("*", { count: "exact", head: true })
        .eq("shift_id", shiftId)
        .is("cancelled_at", null)
        .is("deleted_at", null);

      // Check for existing assignment
      const { data: existingAssignment } = await supabase
        .from("shift_assignment")
        .select("id, deleted_at, cancelled_at")
        .eq("shift_id", shiftId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingAssignment) {
        // Reactivate
        const { error: reactivateError } = await supabase
          .from("shift_assignment")
          .update({
            cancelled_at: null,
            deleted_at: null,
            assigned_by: invitation.invited_by,
            assigned_at: now,
          })
          .eq("id", existingAssignment.id);

        if (reactivateError) throw reactivateError;
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from("shift_assignment")
          .insert({
            shift_id: shiftId,
            user_id: userId,
            assigned_by: invitation.invited_by,
            assigned_at: now,
          });

        if (insertError) throw insertError;
      }

      // Check if this shift is now full
      if (shift && (currentCount || 0) + 1 >= shift.workers_needed) {
        shiftsNowFull.push(shiftId);
      }
    }

    // Update this invitation to accepted
    await supabase
      .from("job_invitation")
      .update({
        status: "accepted",
        responded_at: now,
        updated_at: now,
      })
      .eq("id", invitation.id);

    // Mark all other pending invitations as spots_filled for shifts that are now full
    if (shiftsNowFull.length > 0) {
      // Get all pending invitations that include these now-full shifts
      const { data: pendingInvitations } = await supabase
        .from("job_invitation")
        .select("id, shift_ids")
        .eq("status", "pending")
        .neq("id", invitation.id); // Don't include the one we just accepted

      if (pendingInvitations && pendingInvitations.length > 0) {
        // Find invitations that have at least one shift that's now full
        const invitationsToExpire = pendingInvitations.filter((inv) => {
          const invShiftIds = inv.shift_ids || [];
return invShiftIds.some((shiftId: number) => shiftsNowFull.includes(shiftId));
        });

        // Update all affected invitations
        if (invitationsToExpire.length > 0) {
          const invitationIds = invitationsToExpire.map((inv) => inv.id);
          await supabase
            .from("job_invitation")
            .update({
              status: "spots_filled",
              spots_filled_at: now,
              updated_at: now,
            })
            .in("id", invitationIds);
        }
      }
    }

    toast.success(t("toast.acceptSuccess", { count: shiftsToAssign.length }));
    await fetchInvitations();
  } catch (error) {
    console.error("Error accepting invitation:", error);
    toast.error(t("toast.acceptFailed"));
  } finally {
    setProcessingId(null);
  }
};



  const handleDecline = async (invitationId: number) => {
    if (!confirm(t("confirmDecline"))) {
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

      toast.success(t("toast.declined"));
      await fetchInvitations();
    } catch (error) {
      console.error("Error declining invitation:", error);
      toast.error(t("toast.declineFailed"));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
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
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("noPending")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("title")}
          <Badge variant="secondary">{invitations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invitations.map((invitation) => (
            <Card
              key={invitation.id}
              className="border-2 border-primary/20 dark:border-primary/30 dark:bg-card"
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Briefcase className="w-5 h-5 text-primary flex-shrink-0" />
                      <h3 className="font-semibold text-lg truncate">
                        {invitation.job.position}
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-primary/10 dark:bg-primary/20 flex-shrink-0"
                    >
                      {t("shiftsCount", { count: invitation.shifts.length })}
                    </Badge>
                  </div>

                  {/* Location */}
                  {invitation.job.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>{invitation.job.location.name}</span>
                    </div>
                  )}

                  {/* Date Range */}
                  {invitation.job.start_date && invitation.job.end_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>
                        {new Date(invitation.job.start_date).toLocaleDateString(
                          i18n.language
                        )}{" "}
                        -{" "}
                        {new Date(invitation.job.end_date).toLocaleDateString(
                          i18n.language
                        )}
                      </span>
                    </div>
                  )}

                  {/* Shift Schedule */}
                  {invitation.shifts.length > 0 && (
                    <div className="bg-muted/50 dark:bg-muted/20 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("shiftSchedule")}
                      </p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {invitation.shifts.slice(0, 3).map((shift) => (
                          <div
                            key={shift.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium">
                              {new Date(shift.shift_date).toLocaleDateString(
                                i18n.language,
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
                          <p className="text-xs text-muted-foreground italic">
                            {t("moreShifts", {
                              count: invitation.shifts.length - 3,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleDecline(invitation.id)}
                      variant="outline"
                      size="sm"
                      disabled={processingId === invitation.id}
                      className="flex-1"
                    >
                      {processingId === invitation.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      {t("decline")}
                    </Button>
                    <Button
                      onClick={() => handleAccept(invitation)}
                      size="sm"
                      disabled={processingId === invitation.id}
                      className="flex-1 bg-primary hover:bg-primary/90"
                    >
                      {processingId === invitation.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      {t("accept")}
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
