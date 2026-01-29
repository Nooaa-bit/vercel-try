"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  Clock,
  Briefcase,
  Loader2,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { acceptInvitation, declineInvitation } from "../actions";
import type { JobInvitation } from "../page";

interface PendingInvitationsCardProps {
  invitations: JobInvitation[];
  userId: number;
}

export function PendingInvitationsCard({
  invitations,
  userId,
}: PendingInvitationsCardProps) {
  const { t, i18n } = useTranslation("job-invitation");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleAccept = async (invitation: JobInvitation) => {
    setProcessingId(invitation.id);
    try {
      const result = await acceptInvitation({
        invitationId: invitation.id,
        userId,
        shiftIds: invitation.shift_ids,
        invitedBy: invitation.invited_by,
      });

      if (!result.success) {
        if (result.error === "spots_filled") {
          toast.error(t("toast.spotsFilled"));
        } else {
          toast.error(result.error || t("toast.acceptFailed"));
        }
        return;
      }

      toast.success(
        t("toast.acceptSuccess", { count: result.assignedCount || 0 }),
      );
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast.error(t("toast.acceptFailed"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: number) => {
    if (!confirm(t("confirmDecline"))) return;

    setProcessingId(invitationId);
    try {
      const result = await declineInvitation(invitationId, userId);
      if (!result.success) {
        toast.error(result.error || t("toast.declineFailed"));
        return;
      }
      toast.success(t("toast.declined"));
    } catch (error) {
      console.error("Error declining invitation:", error);
      toast.error(t("toast.declineFailed"));
    } finally {
      setProcessingId(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("noPending")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("title")}</CardTitle>
        <Badge variant="secondary">{invitations.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  {invitation.job.position}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("shiftsCount", { count: invitation.shifts.length })}
                </p>
              </div>
            </div>

            {invitation.job.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {invitation.job.location.name}
              </div>
            )}

            {invitation.job.start_date && invitation.job.end_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {new Date(invitation.job.start_date).toLocaleDateString(
                  i18n.language,
                )}{" "}
                -{" "}
                {new Date(invitation.job.end_date).toLocaleDateString(
                  i18n.language,
                )}
              </div>
            )}

            {invitation.shifts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("shiftSchedule")}</p>
                <div className="space-y-1">
                  {invitation.shifts.slice(0, 3).map((shift) => (
                    <div
                      key={shift.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Clock className="h-3 w-3" />
                      {new Date(shift.shift_date).toLocaleDateString(
                        i18n.language,
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                      : {shift.start_time.slice(0, 5)} -{" "}
                      {shift.end_time.slice(0, 5)}
                    </div>
                  ))}
                  {invitation.shifts.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-5">
                      {t("moreShifts", { count: invitation.shifts.length - 3 })}
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {t("accept")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
