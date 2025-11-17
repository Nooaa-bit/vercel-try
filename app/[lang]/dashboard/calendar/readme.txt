Simple pattern we follow for every protected page:
Step 1) Create the Page File. Create app/[lang]/dashboard/[feature]/page.tsx:

"use client";

import { ProtectedPage } from "@/app/components/ProtectedPage";
import { useTranslation } from "react-i18next";
import { useActiveRole } from "@/app/hooks/useActiveRole";
// ... other imports

export default function FeaturePage() {
  const { t, ready } = useTranslation("feature");
  const { activeRole, loading } = useActiveRole();

  if (!ready || loading) {
    return <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <ProtectedPage requiredRole="company_admin">
      {/* Your page content here */}
    </ProtectedPage>
  );
}

Default (redirects to dashboard):
<ProtectedPage requiredRole="company_admin">
  {/* Page content */}
</ProtectedPage>
Custom redirect:
<ProtectedPage requiredRole="company_admin" redirectTo="/settings">
  {/* Page content */}
</ProtectedPage>

Step 2) Add i18n Translations
Add to public/locales/en/feature.json and public/locales/el/feature.json:

json
{
  "pageTitle": "Feature Name",
  "card": { "title": "...", "description": "..." },
  "dialog": { "createTitle": "...", "cancelButton": "..." },
  "toast": { "createSuccess": "...", "saveFailed": "..." }
}
Step 3) Create Dialog Component (if needed)
Create app/[lang]/dashboard/[feature]/FeatureDialog.tsx for create/edit forms.


----dashboard/calendar/layout.tsx
useActiveRole for RBAC showing "Job Management" tab to admins rest see the "Calendar" tab
----dashboard/calendar/jobs/page.tsx
accessible only to company_admin and superadmin roles​
Superadmins can manage jobs for any company they've selected
Fetches all non-deleted jobs from Supabase with shift and assignment counts​
Loads company locations for the location filter dropdown
Displays jobs in a responsive grid layout (1-3 columns depending on screen size)
Each job card shows: position, seniority, description, location, date range, workers per shift, total shifts, and staffing status
Filtering System
Location filter: Shows jobs from all locations or a specific location
Status filter: All jobs, active jobs (end date ≥ today), or past jobs (end date < today)
Filters reset pagination to page 1 when changed
Real-time counters showing total active jobs and past jobs
Updates automatically when job data changes
Staffing Status Indicators
Calculates total positions needed (shifts × workers per shift) vs. actual assignments
Color-coded badges: green (fully staffed), orange (understaffed), red (overstaffed), gray (no assignments)​
Pagination
6 jobs per page with numbered page buttons
Shows "X to Y of Z jobs" counter
Previous/Next navigation buttons (disabled when on first/last page)
Job Creation & Editing
Add Job button opens dialog for creating new jobs
Edit button on each card opens dialog pre-filled with job data
Dialog component handles both create and edit modes
Refreshes job list after save
Smart Delete/Cancel System
1. Jobs that haven't started:
Red delete button appears 
Permanently soft-deletes the job, all shifts, and all assignments, triggers delete_job_and_shifts() RPC function
2. Jobs that have started:
Orange cancel button appears
Checks if today's shift is within 1 hour of start time AND has active assignments
If can cancel today: Deletes all remaining shifts including today, updates job end_date to yesterday
If cannot cancel today (< 1 hour away with assignments): Only cancels future shifts, keeps today's shift active
If today's shift has no assignments: Always allows cancellation regardless of time
Triggers cancel_shifts_from_date() RPC function which soft-deletes shifts from specified date forward
----dashboard/calendar/JobDialog.tsx
Job form 
Date/time handling and conflict detection
Job creation and editing logic
Shift generation and updates
Delete/cancel operations
Integration with StaffingModal
----dashboard/calendar/StaffingModal.tsx
Employee loading and availability calculation
Shift capacity tracking
Employee search and filtering
Staff assignment to shifts
Invitation sending
Does not allow overassign
All staffing-related UI and state
----dashboard/calendar/staffing-utils.ts
fetchRemainingShifts: Gets all future shifts for a job (from today onwards)
fetchShiftAssignments: Loads all active assignments for given shift IDs, groups them by shift
fetchEmployeeConflicts: Finds an employee's existing shifts in a date range (to check for scheduling conflicts)
fetchAssignedStaffForShift: Gets the list of employees currently assigned to a specific shift
hasTimeConflict: Checks if two shifts overlap on the same date by comparing start/end times. Used to prevent double-booking employees
calculateEmployeeAvailability: For ONE employee across multiple shifts, calculates:
How many shifts they're available for
How many they're already assigned to
How many have time conflicts with their other jobs
How many are already full (at capacity)
Whether they're fully assigned or completely unavailable
calculateAllEmployeesAvailability: Runs the availability calculation for ALL employees in a list
Returns a sorted list showing each employee's availability status
assignStaffToShifts: Main assignment logic - assigns multiple employees to multiple shifts with smart handling:
Checks for active assignments: Skips if employee already assigned
Undeletes soft-deleted assignments: If admin previously cancelled but now wants to reassign, it reactivates the old record
Creates new assignments: If no record exists, creates a new one
Validates capacity: Won't assign if shift is already full
Tracks success/failures: Returns detailed breakdown of what worked and what didn't
removeStaffFromShifts: Soft-deletes assignments (sets deleted_at timestamp) when admin removes staff from shifts
calculateShiftCapacity: Sums up capacity across all shifts:
Total positions needed (sum of all workers_needed)
Total positions filled (count of active assignments)
Remaining positions available
Key Design Patterns
Uses soft delete pattern (sets timestamp instead of deleting records)
Smart undelete: Can reactivate cancelled assignments instead of creating duplicates
Conflict prevention: Checks for time overlaps before assigning
Batch processing: Handles multiple employees and shifts efficiently
Detailed logging: Console logs help debug assignment issues
This utility file is the core business logic for the staffing system - it handles all the complex rules around who can work when, prevents conflicts, and manages the lifecycle of shift assignments!
----dashboard/calendar/DayView.tsx
displays shifts for a single day with vertical time slots and horizontal "swimlanes".
admins and superadmins can edit/create shifts
Talent and supervisors can view
If overlap exists, creates a new swimlane
Ensures shifts don't visually collide
When you scroll shifts, hour labels scroll with them
For Admins, "Add Job" button in header
Click shift → Opens ShiftEditDialog to edit that specific shift
Click "Add Job" → Opens JobDialog to create a new job (pre-filled with selected date)
DayView z-index from z-50 to z-40 - So ShiftEditDialog (default z-50) appears above it
Moved ShiftEditDialog outside the DayView backdrop - Now it's a sibling, not a child
Dialog is now parent-controlled - The Dialog wrapper in DayView controls open/close state
Now the ShiftEditDialog will: Stay open when clicking inside
----dashboard/calendar/shifteditdialog.tsx
