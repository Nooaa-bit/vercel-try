"use client";

import { useState, useEffect } from "react";
import { CheckInCard } from "./components/CheckInCard";
import { MyShiftsCard } from "./components/MyShiftsCard";
import { PendingInvitationsCard } from "./components/PendingInvitationsCard";
import type { ShiftWithCheckIn, JobInvitation } from "./page";

interface DashboardClientProps {
  userId: number;
  myShifts: ShiftWithCheckIn[];
  pendingInvitations: JobInvitation[];
}

export function DashboardClient({ userId, myShifts, pendingInvitations }: DashboardClientProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const activeShift = myShifts.find(
    (s) =>
      (s.canCheckIn && !s.checkInData?.checkOutTime) ||
      (s.checkInData?.checkInTime && !s.checkInData?.checkOutTime)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-20">
      {activeShift ? (
        <>
          <CheckInCard shift={activeShift} userId={userId} currentTime={currentTime} />
          <MyShiftsCard shifts={myShifts} userId={userId} currentTime={currentTime} />
          <PendingInvitationsCard invitations={pendingInvitations} userId={userId} />
        </>
      ) : (
        <>
          <PendingInvitationsCard invitations={pendingInvitations} userId={userId} />
          <MyShiftsCard shifts={myShifts} userId={userId} currentTime={currentTime} />
        </>
      )}
    </div>
  );
}

