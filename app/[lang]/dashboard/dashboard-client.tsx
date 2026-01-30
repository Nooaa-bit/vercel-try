"use client";

import { useState, useEffect } from "react";
import { CheckInCard } from "./components/CheckInCard";
import { MyShiftsCard } from "./components/MyShiftsCard";
import { PendingInvitationsCard } from "./components/PendingInvitationsCard";
import { AdminCheckInList } from "./components/AdminCheckInList";
import type { ShiftWithCheckIn, JobInvitation } from "./page";

interface DashboardClientProps {
  userId: number;
  myShifts: ShiftWithCheckIn[];
  pendingInvitations: JobInvitation[];
  isAdmin: boolean;
}

export function DashboardClient({
  userId,
  myShifts,
  pendingInvitations,
  isAdmin,
}: DashboardClientProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute for shift eligibility check

    return () => clearInterval(interval);
  }, []);

  // Find active shift: either can check in OR already checked in but not checked out
  const activeShift = myShifts.find(
    (s) =>
      (s.canCheckIn && !s.checkInData?.checkOutTime) ||
      (s.checkInData?.checkInTime && !s.checkInData?.checkOutTime),
  );

  return (
    <div className="space-y-6">
      {/* Check-In Card - only show if there's an active shift */}
      {activeShift && <CheckInCard shift={activeShift} userId={userId} />}

      {/* My Shifts Card */}
      <MyShiftsCard
        userId={userId}
        shifts={myShifts}
        currentTime={currentTime}
      />

      {/* Pending Invitations Card */}
      {pendingInvitations.length > 0 && (
        <PendingInvitationsCard
          userId={userId}
          invitations={pendingInvitations}
        />
      )}

      {/* Admin Check-In List - only for supervisors, company_admins, and superadmins */}
      {isAdmin && <AdminCheckInList />}
    </div>
  );
}
