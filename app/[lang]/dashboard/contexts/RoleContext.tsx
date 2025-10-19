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
  company: Array<{
    id: number;
    name: string;
  }> | null;
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
          (r) => r.company?.[0]?.id === parseInt(savedRoleId)
        );
        if (savedRole && savedRole.company?.[0]) {
          setActiveRoleState({
            role: savedRole.role,
            companyId: savedRole.company[0].id,
            companyName: savedRole.company[0].name,
          });
          return;
        }
      }

      // Default to first role (highest priority)
      const firstRole = userCompanyRoles[0];
      if (firstRole.company?.[0]) {
        setActiveRoleState({
          role: firstRole.role,
          companyId: firstRole.company[0].id,
          companyName: firstRole.company[0].name,
        });
      }
    }
  }, [userCompanyRoles]);

  const setActiveRole = (role: ActiveRole) => {
    setActiveRoleState(role);
    localStorage.setItem("activeRoleCompanyId", role.companyId.toString());
  };

  const switchRole = (companyId: number) => {
    const newRole = userCompanyRoles.find(
      (r) => r.company?.[0]?.id === companyId
    );
    if (newRole && newRole.company?.[0]) {
      setActiveRole({
        role: newRole.role,
        companyId: newRole.company[0].id,
        companyName: newRole.company[0].name,
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
