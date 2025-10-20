You can split in 3 files

Option A: Logic → UI Split (Recommended)
File 1: hooks/useInvitationDrafts.ts

All state (drafts, loading, sending)

All functions (scanDraft, sendSingle, sendAll, updateDraft)

Supabase calls inline

Return: { drafts, user, loading, sending, allowedRoles, isCompanyAdmin, scanDraft, scanAll, sendSingle, sendAll, updateDraft, addDraft, deleteDraft, deleteAllDrafts }

File 2: InvitationsPage.tsx

Imports the hook

Pure UI rendering

No logic, just calls hook functions

~80 lines

File 3: types/invitation.ts

Role type

User interface

Draft interface

ROLE_HIERARCHY constant

Why this works:

Hook is testable in isolation

Page is dead simple (just UI)

Types are shared/reusable

Clear responsibility per file