//hype-hire/web/app/dashboard2/contexts/RoleContext.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface ActiveRole {
  role: string;
  companyId: number;
  companyName: string;
}

interface UserCompanyRole {
  role: string;
  company: {
    id: number;
    name: string;
  };
}

interface RoleContextType {
  activeRole: ActiveRole | null;
  availableRoles: UserCompanyRole[];
  setActiveRole: (role: ActiveRole) => void;
  switchRole: (companyId: number) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({
  children,
  userCompanyRoles,
}: {
  children: ReactNode;
  userCompanyRoles: UserCompanyRole[];
}) {
  const [activeRole, setActiveRoleState] = useState<ActiveRole | null>(null);

  // Initialize active role (first role or from localStorage)
  useEffect(() => {
    if (userCompanyRoles && userCompanyRoles.length > 0) {
      // Try to load saved role from localStorage
      const savedRoleId = localStorage.getItem("activeRoleCompanyId");

      if (savedRoleId) {
        const savedRole = userCompanyRoles.find(
          (r) => r.company.id === parseInt(savedRoleId)
        );
        if (savedRole) {
          setActiveRoleState({
            role: savedRole.role,
            companyId: savedRole.company.id,
            companyName: savedRole.company.name,
          });
          return;
        }
      }

      // Default to first role (highest priority)
      const firstRole = userCompanyRoles[0];
      setActiveRoleState({
        role: firstRole.role,
        companyId: firstRole.company.id,
        companyName: firstRole.company.name,
      });
    }
  }, [userCompanyRoles]);

  const setActiveRole = (role: ActiveRole) => {
    setActiveRoleState(role);
    localStorage.setItem("activeRoleCompanyId", role.companyId.toString());
  };

  const switchRole = (companyId: number) => {
    const newRole = userCompanyRoles.find((r) => r.company.id === companyId);
    if (newRole) {
      setActiveRole({
        role: newRole.role,
        companyId: newRole.company.id,
        companyName: newRole.company.name,
      });
    }
  };

  return (
    <RoleContext.Provider
      value={{
        activeRole,
        availableRoles: userCompanyRoles,
        setActiveRole,
        switchRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
