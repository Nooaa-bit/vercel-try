// app/[lang]/dashboard/calendar/staffing-utils.ts

import { SupabaseClient } from "@supabase/supabase-js";

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
  marked_no_show_at: string | null;
  deleted_at: string | null;
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
}

interface ConflictingShift {
  shift_date: string;
  start_time: string;
  end_time: string;
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

  // Group by shift_id
  const map = new Map<number, ShiftAssignment[]>();
  (data || []).forEach((assignment) => {
    const existing = map.get(assignment.shift_id) || [];
    existing.push(assignment);
    map.set(assignment.shift_id, existing);
  });

  return map;
}

export async function fetchEmployeeConflicts(
  supabase: SupabaseClient,
  userId: number,
  dateRange: { startDate: string; endDate: string }
): Promise<ConflictingShift[]> {
  const { data, error } = await supabase
    .from("shift_assignment")
    .select(
      `
      shift_id,
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
    .eq("user_id", userId)
    .is("cancelled_at", null)
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching employee conflicts:", error);
    return [];
  }

  // Filter by date range and flatten structure
  const conflicts: ConflictingShift[] = [];
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
      conflicts.push(shift);
    }
  });

  return conflicts;
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
  // Same date?
  if (shift1.shift_date !== shift2.shift_date) return false;

  // Check time overlap
  const start1 = shift1.start_time;
  const end1 = shift1.end_time;
  const start2 = shift2.start_time;
  const end2 = shift2.end_time;

  return start1 < end2 && end1 > start2;
}

// ============================================
// AVAILABILITY CALCULATION
// ============================================

export async function calculateEmployeeAvailability(
  supabase: SupabaseClient,
  employee: Employee,
  shifts: Shift[],
  assignmentsMap: Map<number, ShiftAssignment[]>,
  conflicts: ConflictingShift[]
): Promise<EmployeeAvailability> {
  let available = 0;
  let alreadyAssigned = 0;
  let conflictCount = 0;
  let full = 0;
  const conflictDetails: string[] = [];

  for (const shift of shifts) {
    const shiftAssignments = assignmentsMap.get(shift.id) || [];

    // Already assigned to this shift?
    const isAssigned = shiftAssignments.some(
      (a) => a.user_id === employee.userId
    );
    if (isAssigned) {
      alreadyAssigned++;
      continue;
    }

    // Shift is full?
    if (shiftAssignments.length >= shift.workers_needed) {
      full++;
      continue;
    }

    // Check for conflicts with other jobs
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
  };
}

export async function calculateAllEmployeesAvailability(
  supabase: SupabaseClient,
  employees: Employee[],
  shifts: Shift[]
): Promise<EmployeeAvailability[]> {
  if (shifts.length === 0) return [];

  const shiftIds = shifts.map((s) => s.id);
  const assignmentsMap = await fetchShiftAssignments(supabase, shiftIds);

  const dateRange = {
    startDate: shifts[0].shift_date,
    endDate: shifts[shifts.length - 1].shift_date,
  };

  const availabilities: EmployeeAvailability[] = [];

  for (const employee of employees) {
    const conflicts = await fetchEmployeeConflicts(
      supabase,
      employee.userId,
      dateRange
    );

    const availability = await calculateEmployeeAvailability(
      supabase,
      employee,
      shifts,
      assignmentsMap,
      conflicts
    );

    availabilities.push(availability);
  }

  return availabilities;
}

// ============================================
// ASSIGNMENT FUNCTIONS
// ============================================

export async function assignStaffToShifts(
  supabase: SupabaseClient,
  userIds: number[],
  shifts: Shift[],
  adminId: number,
  availabilities: EmployeeAvailability[]
): Promise<{ success: number; skipped: number; details: string[] }> {
  const now = new Date().toISOString();
  const shiftIds = shifts.map((s) => s.id);
  const details: string[] = [];
  let successCount = 0;

  // ✅ Get ALL assignments (including deleted ones) for these shifts
  const { data: allAssignments } = await supabase
    .from("shift_assignment")
    .select("id, shift_id, user_id, deleted_at, cancelled_at")
    .in("shift_id", shiftIds)
    .in("user_id", userIds);

  console.log("All assignments (including deleted):", allAssignments);

  // Create maps for fast lookup
  const activeAssignments = new Set(
    (allAssignments || [])
      .filter((a) => !a.deleted_at && !a.cancelled_at)
      .map((a) => `${a.shift_id}-${a.user_id}`)
  );

  const deletedAssignments = new Map(
    (allAssignments || [])
      .filter((a) => a.deleted_at || a.cancelled_at)
      .map((a) => [`${a.shift_id}-${a.user_id}`, a])
  );

  console.log("Active assignments:", Array.from(activeAssignments));
  console.log("Deleted assignments:", Array.from(deletedAssignments.keys()));

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

      // ✅ Check if active assignment exists
      if (activeAssignments.has(key)) {
        console.log(
          `⏭️ Skipping - active assignment exists for user ${userId}, shift ${shift.id}`
        );
        skipped++;
        continue;
      }

      // ✅ Check if deleted/cancelled assignment exists - UNDELETE IT
      const deletedAssignment = deletedAssignments.get(key);
      if (deletedAssignment) {
        console.log(
          `🔄 Undeleting assignment for user ${userId}, shift ${shift.id}`
        );

        const { error } = await supabase
          .from("shift_assignment")
          .update({
            deleted_at: null,
            cancelled_at: null,
            assigned_by: adminId,
            assigned_at: now,
          })
          .eq("id", deletedAssignment.id);

        if (error) {
          console.error(`❌ Error undeleting assignment:`, error);
          skipped++;
          continue;
        }

        console.log(
          `✅ Undeleted assignment for user ${userId}, shift ${shift.id}`
        );
        assigned++;
        successCount++;
        continue;
      }

      // ✅ Check if shift is full
      const shiftAssignments = (allAssignments || []).filter(
        (a) => a.shift_id === shift.id && !a.deleted_at && !a.cancelled_at
      );
      if (shiftAssignments.length >= shift.workers_needed) {
        console.log(`⏭️ Shift ${shift.id} is full - skipping user ${userId}`);
        skipped++;
        continue;
      }

      // ✅ No assignment exists - CREATE NEW
      console.log(
        `➕ Creating new assignment for user ${userId}, shift ${shift.id}`
      );

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
        if (error.code === "23505") {
          console.log(
            `⚠️ Duplicate detected for user ${userId}, shift ${shift.id} - skipping`
          );
          skipped++;
          continue;
        } else {
          console.error(`❌ Error creating assignment:`, error);
          skipped++;
          continue;
        }
      }

      if (data) {
        console.log(`✅ Created new assignment:`, data);
        assigned++;
        successCount++;
      }
    }

    if (assigned > 0 || skipped > 0) {
      details.push(`${employeeName}: ${assigned} assigned, ${skipped} skipped`);
    }
  }

  console.log(`✅ Total assignments processed: ${successCount}`);

  return {
    success: successCount,
    skipped: userIds.length * shifts.length - successCount,
    details,
  };
}


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
