Summary of Changes for Selected Company Pattern
Here's the pattern to apply across all pages that have company-scoped data:

General Pattern
1. Import context

typescript
import { useActiveRole } from "@/app/hooks/useActiveRole";
2. Destructure needed values

typescript
const { 
  activeRole, 
  isSuperAdmin, 
  selectedCompanyForAdmin,
  loading: roleLoading 
} = useActiveRole();
3. Create helper variable for target company

typescript
const targetCompanyId = isSuperAdmin ? selectedCompanyForAdmin : activeRole.companyId;
4. Update all fetch queries

typescript
const { data } = await supabase
  .from("table")
  .select("*")
  .eq("company_id", targetCompanyId) // ✅ Use targetCompanyId
  .order("created_at", { ascending: false });
5. Update create/insert operations

typescript
await supabase.from("table").insert({
  company_id: targetCompanyId, // ✅ Use targetCompanyId
  // ... other fields
});
6. Update dependency arrays
Add selectedCompanyForAdmin to any useCallback that uses the company ID:

typescript
const fetchData = useCallback(async () => {
  // ... fetch logic
}, [selectedCompanyForAdmin, supabase, t]); // ✅ Add selectedCompanyForAdmin
7. Update useEffect dependencies

typescript
useEffect(() => {
  fetchData();
}, [selectedCompanyForAdmin, fetchData]); // ✅ Add selectedCompanyForAdmin