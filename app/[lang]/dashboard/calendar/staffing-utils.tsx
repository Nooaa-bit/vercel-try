// app/[lang]/dashboard/calendar/staffing-utils.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getProfilePictureUrl(
  profilePicture: string | null
): string | null {
  if (!profilePicture) return null;
  if (profilePicture.startsWith("http")) {
    return profilePicture;
  }
  const supabase = createClient();
  const { data } = supabase.storage
    .from("profile-pictures")
    .getPublicUrl(profilePicture);
  return data.publicUrl;
}

export function getUserInitials(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  if (firstName) {
    return firstName[0].toUpperCase();
  }
  return email[0].toUpperCase();
}

// ============================================
// TYPES
// ============================================

export interface Shift {
  id: number;
  job_id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  workers_needed: number;
}

export interface Employee {
  userId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
  role: string;
}

export interface ShiftAssignment {
  id: number;
  shift_id: number;
  user_id: number;
  assigned_at: string;
  assigned_by: number;
  cancelled_at: string | null;
  cancelled_by: number | null;
  cancellation_reason: string | null;
  marked_no_show_at: string | null;
  deleted_at: string | null;
}

export interface CancellationHistory {
  cancellationReason: string | null;
  cancelCount: number;
  shiftIds: number[];
}

export interface PendingInvitation {
  id: number;
  job_id: number;
  shift_ids: number[];
  status: string;
  created_at: string;
}

export interface EmployeeAvailability {
  employee: Employee;
  available: number;
  total: number;
  alreadyAssigned: number;
  conflicts: number;
  full: number;
  conflictDetails: string[];
  isFullyAssigned: boolean;
  isUnavailable: boolean;
  cancellationHistory: CancellationHistory[];
  hasCancelledBefore: boolean;
  assignedShiftIds: number[];
  pendingInvitations: PendingInvitation[];
}

interface ConflictingShift {
  shift_date: string;
  start_time: string;
  end_time: string;
  user_id: number;
  job: {
    position: string;
  };
}

// ============================================
// FETCH FUNCTIONS
// ============================================

export async function fetchRemainingShifts(
  supabase: SupabaseClient,
  jobId: number
): Promise<Shift[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("shift")
    .select("id, job_id, shift_date, start_time, end_time, workers_needed")
    .eq("job_id", jobId)
    .gte("shift_date", today)
    .is("deleted_at", null)
    .order("shift_date", { ascending: true });

  if (error) {
    console.error("Error fetching remaining shifts:", error);
    return [];
  }

  return data || [];
}

export async function fetchShiftAssignments(
  supabase: SupabaseClient,
  shiftIds: number[]
): Promise<Map<number, ShiftAssignment[]>> {
  if (shiftIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("shift_assignment")
    .select("*")
    .in("shift_id", shiftIds)
    .is("cancelled_at", null)
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching shift assignments:", error);
    return new Map();
  }

  const map = new Map<number, ShiftAssignment[]>();
  (data || []).forEach((assignment) => {
    const existing = map.get(assignment.shift_id) || [];
    existing.push(assignment);
    map.set(assignment.shift_id, existing);
  });

  return map;
}

// ✅ OPTIMIZED: Batch fetch conflicts for all employees at once
export async function fetchBatchEmployeeConflicts(
  supabase: SupabaseClient,
  userIds: number[],
  dateRange: { startDate: string; endDate: string }
): Promise<Map<number, ConflictingShift[]>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("shift_assignment")
    .select(
      `
      user_id,
      shift:shift_id (
        shift_date,
        start_time,
        end_time,
        job:job_id (
          position
        )
      )
    `
    )
    .in("user_id", userIds)
    .is("cancelled_at", null)
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching employee conflicts:", error);
    return new Map();
  }

  const conflictsMap = new Map<number, ConflictingShift[]>();

  (data || []).forEach((assignment) => {
    const shift = assignment.shift as unknown as {
      shift_date: string;
      start_time: string;
      end_time: string;
      job: { position: string };
    };

    if (
      shift &&
      shift.shift_date >= dateRange.startDate &&
      shift.shift_date <= dateRange.endDate
    ) {
      const conflicts = conflictsMap.get(assignment.user_id) || [];
      conflicts.push({
        ...shift,
        user_id: assignment.user_id,
      });
      conflictsMap.set(assignment.user_id, conflicts);
    }
  });

  return conflictsMap;
}

// ✅ OPTIMIZED: Batch fetch cancellation history for all employees
export async function fetchBatchCancellationHistory(
  supabase: SupabaseClient,
  userIds: number[],
  shiftIds: number[]
): Promise<Map<number, CancellationHistory[]>> {
  if (userIds.length === 0 || shiftIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("shift_assignment")
    .select("user_id, shift_id, cancelled_at, cancellation_reason")
    .in("user_id", userIds)
    .in("shift_id", shiftIds)
    .not("cancelled_at", "is", null);

  if (error) {
    console.error("Error fetching cancellation history:", error);
    return new Map();
  }

  const historyMap = new Map<number, CancellationHistory[]>();

  (data || []).forEach((item) => {
    const userHistoryMap = new Map<string, CancellationHistory>();
    const existing = historyMap.get(item.user_id) || [];

    existing.forEach((hist) => {
      userHistoryMap.set(hist.cancellationReason || "unknown", hist);
    });

    const reason = item.cancellation_reason || "unknown";
    const existingReason = userHistoryMap.get(reason);

    if (existingReason) {
      existingReason.cancelCount++;
      existingReason.shiftIds.push(item.shift_id);
    } else {
      userHistoryMap.set(reason, {
        cancellationReason: item.cancellation_reason,
        cancelCount: 1,
        shiftIds: [item.shift_id],
      });
    }

    historyMap.set(item.user_id, Array.from(userHistoryMap.values()));
  });

  return historyMap;
}

// ✅ OPTIMIZED: Batch fetch pending invitations (unchanged but included for completeness)
export async function fetchPendingInvitations(
  supabase: SupabaseClient,
  userIds: number[],
  jobId: number
): Promise<Map<number, PendingInvitation[]>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("job_invitation")
    .select("id, job_id, user_id, shift_ids, status, created_at")
    .eq("job_id", jobId)
    .in("user_id", userIds)
    .eq("status", "pending");

  if (error) {
    console.error("Error fetching pending invitations:", error);
    return new Map();
  }

  const map = new Map<number, PendingInvitation[]>();
  (data || []).forEach((invitation) => {
    const existing = map.get(invitation.user_id) || [];
    existing.push({
      id: invitation.id,
      job_id: invitation.job_id,
      shift_ids: invitation.shift_ids,
      status: invitation.status,
      created_at: invitation.created_at,
    });
    map.set(invitation.user_id, existing);
  });

  return map;
}

export async function fetchAssignedStaffForShift(
  supabase: SupabaseClient,
  shiftId: number
): Promise<Employee[]> {
  const { data, error } = await supabase
    .from("shift_assignment")
    .select(
      `
      user_id,
      user:user_id (
        id,
        email,
        first_name,
        last_name,
        profile_picture
      )
    `
    )
    .eq("shift_id", shiftId)
    .is("cancelled_at", null)
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching assigned staff:", error);
    return [];
  }

  return (data || []).map((item) => {
    const user = item.user as unknown as {
      id: number;
      email: string;
      first_name: string | null;
      last_name: string | null;
      profile_picture: string | null;
    };

    return {
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      profilePicture: user.profile_picture,
      role: "talent",
    };
  });
}

// ============================================
// CONFLICT DETECTION
// ============================================

export function hasTimeConflict(
  shift1: { shift_date: string; start_time: string; end_time: string },
  shift2: { shift_date: string; start_time: string; end_time: string }
): boolean {
  if (shift1.shift_date !== shift2.shift_date) return false;
  const start1 = shift1.start_time;
  const end1 = shift1.end_time;
  const start2 = shift2.start_time;
  const end2 = shift2.end_time;
  return start1 < end2 && end1 > start2;
}

// ============================================
// AVAILABILITY CALCULATION
// ============================================

export function calculateEmployeeAvailability(
  employee: Employee,
  shifts: Shift[],
  assignmentsMap: Map<number, ShiftAssignment[]>,
  conflicts: ConflictingShift[],
  cancellationHistory: CancellationHistory[],
  pendingInvitations: PendingInvitation[]
): EmployeeAvailability {
  let available = 0;
  let alreadyAssigned = 0;
  let conflictCount = 0;
  let full = 0;
  const conflictDetails: string[] = [];
  const assignedShiftIds: number[] = [];

  for (const shift of shifts) {
    const shiftAssignments = assignmentsMap.get(shift.id) || [];

    const isAssigned = shiftAssignments.some(
      (a) => a.user_id === employee.userId
    );
    if (isAssigned) {
      alreadyAssigned++;
      assignedShiftIds.push(shift.id);
      continue;
    }

    if (shiftAssignments.length >= shift.workers_needed) {
      full++;
      continue;
    }

    const hasConflict = conflicts.some((conflict) =>
      hasTimeConflict(shift, conflict)
    );

    if (hasConflict) {
      conflictCount++;
      const conflictJob = conflicts.find((c) => hasTimeConflict(shift, c));
      if (conflictJob) {
        conflictDetails.push(
          `${shift.shift_date}: Conflict with "${conflictJob.job.position}"`
        );
      }
      continue;
    }

    available++;
  }

  const total = shifts.length;
  const isFullyAssigned = alreadyAssigned === total;
  const isUnavailable = available === 0 && alreadyAssigned === 0;
  const hasCancelledBefore = cancellationHistory.length > 0;

  return {
    employee,
    available,
    total,
    alreadyAssigned,
    conflicts: conflictCount,
    full,
    conflictDetails,
    isFullyAssigned,
    isUnavailable,
    cancellationHistory,
    hasCancelledBefore,
    assignedShiftIds,
    pendingInvitations,
  };
}

// ✅ OPTIMIZED: Use batched queries and parallel processing
export async function calculateAllEmployeesAvailability(
  supabase: SupabaseClient,
  employees: Employee[],
  shifts: Shift[]
): Promise<EmployeeAvailability[]> {
  if (shifts.length === 0 || employees.length === 0) return [];

  const shiftIds = shifts.map((s) => s.id);
  const jobId = shifts[0].job_id;
  const userIds = employees.map((e) => e.userId);

  const dateRange = {
    startDate: shifts[0].shift_date,
    endDate: shifts[shifts.length - 1].shift_date,
  };

  // ✅ Fetch all data in parallel
  const [
    assignmentsMap,
    conflictsMap,
    cancellationHistoryMap,
    pendingInvitationsMap,
  ] = await Promise.all([
    fetchShiftAssignments(supabase, shiftIds),
    fetchBatchEmployeeConflicts(supabase, userIds, dateRange),
    fetchBatchCancellationHistory(supabase, userIds, shiftIds),
    fetchPendingInvitations(supabase, userIds, jobId),
  ]);

  // ✅ Calculate availability for all employees (no async needed now)
  const availabilities: EmployeeAvailability[] = employees.map((employee) => {
    const conflicts = conflictsMap.get(employee.userId) || [];
    const cancellationHistory =
      cancellationHistoryMap.get(employee.userId) || [];
    const pendingInvitations = pendingInvitationsMap.get(employee.userId) || [];

    return calculateEmployeeAvailability(
      employee,
      shifts,
      assignmentsMap,
      conflicts,
      cancellationHistory,
      pendingInvitations
    );
  });

  return availabilities;
}

// ============================================
// INVITATION MANAGEMENT
// ============================================

export async function cancelInvitationsForFullShifts(
  supabase: SupabaseClient,
  shifts: Shift[],
  assignmentsMap: Map<number, ShiftAssignment[]>
): Promise<{ cancelledCount: number }> {
  const now = new Date().toISOString();
  let cancelledCount = 0;

  const fullShiftIds: number[] = [];

  for (const shift of shifts) {
    const assignments = assignmentsMap.get(shift.id) || [];
    if (assignments.length >= shift.workers_needed) {
      fullShiftIds.push(shift.id);
    }
  }

  if (fullShiftIds.length === 0) {
    return { cancelledCount: 0 };
  }

  try {
    const { data: invitations, error: fetchError } = await supabase
      .from("job_invitation")
      .select("id, shift_ids")
      .eq("status", "pending")
      .overlaps("shift_ids", fullShiftIds);

    if (fetchError) {
      console.error("Error fetching invitations:", fetchError);
      return { cancelledCount: 0 };
    }

    if (!invitations || invitations.length === 0) {
      return { cancelledCount: 0 };
    }

    for (const invitation of invitations) {
      const remainingShiftIds = invitation.shift_ids.filter(
        (id: number) => !fullShiftIds.includes(id)
      );

      if (remainingShiftIds.length === 0) {
        const { error: updateError } = await supabase
          .from("job_invitation")
          .update({
            status: "cancelled",
            updated_at: now,
          })
          .eq("id", invitation.id);

        if (!updateError) {
          cancelledCount++;
        }
      } else {
        const { error: updateError } = await supabase
          .from("job_invitation")
          .update({
            shift_ids: remainingShiftIds,
            updated_at: now,
          })
          .eq("id", invitation.id);

        if (!updateError) {
          cancelledCount++;
        }
      }
    }
  } catch (error) {
    console.error("Error cancelling invitations for full shifts:", error);
  }

  return { cancelledCount };
}

// ============================================
// UNIFIED ASSIGNMENT FUNCTION
// ============================================

export async function assignStaffToShifts(
  supabase: SupabaseClient,
  userIds: number[],
  shifts: Shift[],
  adminId: number,
  availabilities: EmployeeAvailability[]
): Promise<{
  success: number;
  reactivated: number;
  skipped: number;
  details: string[];
  invitationsCancelled: number;
}> {
  const now = new Date().toISOString();
  const shiftIds = shifts.map((s) => s.id);
  const details: string[] = [];
  let successCount = 0;
  let reactivatedCount = 0;

  const { data: allAssignments } = await supabase
    .from("shift_assignment")
    .select("id, shift_id, user_id, deleted_at, cancelled_at")
    .in("shift_id", shiftIds)
    .in("user_id", userIds);

  const activeAssignments = new Set(
    (allAssignments || [])
      .filter((a) => !a.deleted_at && !a.cancelled_at)
      .map((a) => `${a.shift_id}-${a.user_id}`)
  );

  const inactiveAssignments = new Map(
    (allAssignments || [])
      .filter((a) => a.deleted_at || a.cancelled_at)
      .map((a) => [`${a.shift_id}-${a.user_id}`, a])
  );

  for (const userId of userIds) {
    const userAvailability = availabilities.find(
      (a) => a.employee.userId === userId
    );

    const employeeName =
      userAvailability?.employee.firstName &&
      userAvailability?.employee.lastName
        ? `${userAvailability.employee.firstName} ${userAvailability.employee.lastName}`
        : userAvailability?.employee.email || `User ${userId}`;

    let assigned = 0;
    let skipped = 0;

    for (const shift of shifts) {
      const key = `${shift.id}-${userId}`;

      if (activeAssignments.has(key)) {
        skipped++;
        continue;
      }

      if (userAvailability) {
        const hasConflict = userAvailability.conflictDetails.some((detail) =>
          detail.includes(shift.shift_date)
        );
        if (hasConflict) {
          skipped++;
          continue;
        }
      }

      const inactiveAssignment = inactiveAssignments.get(key);
      if (inactiveAssignment) {
        const { error } = await supabase
          .from("shift_assignment")
          .update({
            deleted_at: null,
            cancelled_at: null,
            cancelled_by: null,
            cancellation_reason: null,
            assigned_by: adminId,
            assigned_at: now,
          })
          .eq("id", inactiveAssignment.id);

        if (error) {
          console.error(`Error reactivating assignment:`, error);
          skipped++;
          continue;
        }

        assigned++;
        successCount++;
        reactivatedCount++;
        continue;
      }

      const shiftAssignments = (allAssignments || []).filter(
        (a) => a.shift_id === shift.id && !a.deleted_at && !a.cancelled_at
      );
      if (shiftAssignments.length >= shift.workers_needed) {
        skipped++;
        continue;
      }

      const { data, error } = await supabase
        .from("shift_assignment")
        .insert({
          shift_id: shift.id,
          user_id: userId,
          assigned_by: adminId,
          assigned_at: now,
        })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code !== "23505") {
          console.error(`Error creating assignment:`, error);
        }
        skipped++;
        continue;
      }

      if (data) {
        assigned++;
        successCount++;
      }
    }

    if (assigned > 0 || skipped > 0) {
      details.push(`${employeeName}: ${assigned} assigned, ${skipped} skipped`);
    }
  }

  const updatedAssignmentsMap = await fetchShiftAssignments(supabase, shiftIds);
  const { cancelledCount } = await cancelInvitationsForFullShifts(
    supabase,
    shifts,
    updatedAssignmentsMap
  );

  return {
    success: successCount,
    reactivated: reactivatedCount,
    skipped: userIds.length * shifts.length - successCount,
    details,
    invitationsCancelled: cancelledCount,
  };
}

// ============================================
// CANCEL STAFF ASSIGNMENT
// ============================================

export async function cancelStaffAssignment(
  supabase: SupabaseClient,
  userId: number,
  shiftIds: number[],
  cancelledBy: number,
  reason?: string
): Promise<{ success: boolean; cancelled: number; error?: string }> {
  if (shiftIds.length === 0) {
    return { success: false, cancelled: 0, error: "No shifts provided" };
  }

  const now = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from("shift_assignment")
      .update({
        cancelled_at: now,
        cancelled_by: cancelledBy,
        cancellation_reason: reason || "admin_decision",
      })
      .eq("user_id", userId)
      .in("shift_id", shiftIds)
      .is("cancelled_at", null)
      .is("deleted_at", null)
      .select();

    if (error) {
      console.error("Error cancelling staff assignments:", error);
      return { success: false, cancelled: 0, error: error.message };
    }

    return { success: true, cancelled: data?.length || 0 };
  } catch (err) {
    console.error("Unexpected error cancelling assignments:", err);
    return {
      success: false,
      cancelled: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ============================================
// REMOVE STAFF (SOFT DELETE)
// ============================================

export async function removeStaffFromShifts(
  supabase: SupabaseClient,
  userId: number,
  shiftIds: number[]
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("shift_assignment")
    .update({ deleted_at: now })
    .eq("user_id", userId)
    .in("shift_id", shiftIds)
    .is("deleted_at", null);

  if (error) {
    console.error("Error removing staff from shifts:", error);
    throw error;
  }
}

// ============================================
// CAPACITY CALCULATION
// ============================================

export function calculateShiftCapacity(
  shifts: Shift[],
  assignmentsMap: Map<number, ShiftAssignment[]>
): { total: number; filled: number; remaining: number } {
  let total = 0;
  let filled = 0;

  shifts.forEach((shift) => {
    total += shift.workers_needed;
    const assignments = assignmentsMap.get(shift.id) || [];
    filled += assignments.length;
  });

  return {
    total,
    filled,
    remaining: total - filled,
  };
}
