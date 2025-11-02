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