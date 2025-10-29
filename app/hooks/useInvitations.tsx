//hype-hire/vercel/app/hooks/useInvitations.tsx
import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// ============================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================

type Role = "talent" | "supervisor" | "company_admin" | "superadmin";
type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "revoked"
  | "draft"
  | "all";

interface User {
  id: number;
  email: string;
  companyId: number;
  role: Role;
}

interface Company {
  id: number;
  name: string;
}

interface Draft {
  id: string;
  email: string;
  role: Role;
  companyId?: number;
  warning?: string;
  conflictType?: "member" | "pending" | "expired";
  userId?: number;
  existingRole?: Role;
  status?: "idle" | "sending" | "sent" | "failed"; // ✅ NEW
}

interface SentInvitation {
  id: number;
  email: string;
  role: Role;
  status: string;
  expires_at: string;
  invited_by: number;
  deleted_at: string | null;
  deleted_by: number | null;
}

const ROLE_HIERARCHY: Record<Role, Role[]> = {
  talent: ["talent"],
  supervisor: ["talent"],
  company_admin: ["talent", "supervisor", "company_admin"],
  superadmin: ["talent", "supervisor", "company_admin", "superadmin"],
};

export function useInvitations() {
  const supabase = createClient();
  const pathname = usePathname();
  const { t } = useTranslation("invitations");

  // State
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sending, setSending] = useState(false);
  const [activeView, setActiveView] = useState<"draft" | "sent">("draft");
  const [sentInvitations, setSentInvitations] = useState<SentInvitation[]>([]);
  const [loadingSentInvitations, setLoadingSentInvitations] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
    null
  );
  const [searchEmail, setSearchEmail] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "all">("all");
  const [filterStatus, setFilterStatus] = useState<InvitationStatus>("all");

  const currentLanguage = pathname.split("/")[1] as "en" | "el";
  const language = currentLanguage === "el" ? "el" : "en";

  // ✅ Memoized computed values
  const allowedRoles = useMemo(
    () => (user ? ROLE_HIERARCHY[user.role] : []),
    [user]
  );

  const isSuperAdmin = user?.role === "superadmin";
  const isCompanyAdmin = user?.role === "company_admin";
  const isRegularUser = user?.role === "talent" || user?.role === "supervisor";
  const canManageInvitations = isSuperAdmin || isCompanyAdmin;

  const problematicDrafts = useMemo(
    () => drafts.filter((d) => d.conflictType),
    [drafts]
  );

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  const filteredSentInvitations = useMemo(() => {
    return sentInvitations.filter((inv) => {
      const matchesEmail =
        searchEmail === "" ||
        inv.email.toLowerCase().includes(searchEmail.toLowerCase());
      const matchesRole = filterRole === "all" || inv.role === filterRole;
      const matchesStatus =
        filterStatus === "all" || inv.status === filterStatus;
      return matchesEmail && matchesRole && matchesStatus;
    });
  }, [sentInvitations, searchEmail, filterRole, filterStatus]);

  const hasActiveFilters =
    searchEmail !== "" || filterRole !== "all" || filterStatus !== "all";

  // ============================================================
  // USER AUTHENTICATION & DATA LOADING
  // ============================================================

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        setLoading(false);
        return;
      }

      const { data: u } = await supabase
        .from("user")
        .select("id, email, auth_user_id")
        .eq("auth_user_id", data.user.id)
        .single();

      const { data: roleRow } = await supabase
        .from("user_company_role")
        .select("role, company_id")
        .eq("user_id", u!.id)
        .is("revoked_at", null)
        .single();

      setUser({
        id: u!.id,
        email: u!.email,
        companyId: roleRow!.company_id,
        role: roleRow!.role,
      });

      if (roleRow!.role === "superadmin") {
        const { data: companiesData } = await supabase
          .from("company")
          .select("id, name")
          .order("name");

        setCompanies(companiesData || []);
        if (companiesData && companiesData.length > 0) {
          setSelectedCompanyId(companiesData[0].id);
        }
      }

      setLoading(false);
    })();
  }, []);

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  const removeDuplicateDrafts = (draftArray: Draft[]): Draft[] => {
    const seen = new Set<string>();
    return draftArray.filter((draft) => {
      const key = isSuperAdmin
        ? `${draft.email.toLowerCase()}-${draft.role}-${draft.companyId}`
        : `${draft.email.toLowerCase()}-${draft.role}`;

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const clearFilters = () => {
    setSearchEmail("");
    setFilterRole("all");
    setFilterStatus("all");
  };

  const updateDraft = (
    id: string,
    field: "email" | "role" | "companyId",
    value: string | number
  ) => {
    setDrafts((d) =>
      d.map((dr) =>
        dr.id === id
          ? {
              ...dr,
              [field]: value,
              warning: undefined,
              conflictType: undefined,
            }
          : dr
      )
    );
  };

  // ============================================================
  // CONFLICT DETECTION
  // ============================================================

  const scanDraft = async (draft: Draft): Promise<Draft> => {
    if (!user || !draft.email.includes("@")) return draft;
    if (isRegularUser) return draft;

    const targetCompanyId = isSuperAdmin ? selectedCompanyId! : user.companyId;

    const { data: existingUser } = await supabase
      .from("user")
      .select("id")
      .eq("email", draft.email.trim())
      .maybeSingle();

    if (existingUser) {
      const { data: companyMember } = await supabase
        .from("user_company_role")
        .select("role")
        .eq("user_id", existingUser.id)
        .eq("company_id", targetCompanyId)
        .is("revoked_at", null)
        .maybeSingle();

      if (companyMember) {
        return {
          ...draft,
          warning: `${t("problematic.alreadyMember")} ${companyMember.role}`,
          conflictType: "member",
          userId: existingUser.id,
          existingRole: companyMember.role as Role,
        };
      }
    }

    const { data: existingInvitations } = await supabase
      .from("invitation")
      .select("role, status, expires_at")
      .eq("company_id", targetCompanyId)
      .eq("email", draft.email.trim())
      .is("deleted_at", null)
      .in("status", ["pending", "expired"])
      .order("expires_at", { ascending: false })
      .limit(1);

    if (existingInvitations?.[0]) {
      const inv = existingInvitations[0];
      const isPending = inv.status === "pending";
      const dateStr = new Date(inv.expires_at).toLocaleDateString();
      const warning = `${
        isPending ? t("status.pending") : t("status.expired")
      } invitation (${inv.role}) ${isPending ? "expires" : "on"} ${dateStr}`;

      return {
        ...draft,
        warning,
        conflictType: isPending ? "pending" : "expired",
      };
    }

    return draft;
  };

  const scanAll = async () => {
    setSending(true);

    const uniqueDrafts = removeDuplicateDrafts(drafts);
    if (uniqueDrafts.length < drafts.length) {
      const removed = drafts.length - uniqueDrafts.length;
      toast.info(
        t("toasts.duplicatesRemoved", {
          count: removed,
          plural: removed > 1 ? "s" : "",
        })
      );
    }

    const scanned = await Promise.all(uniqueDrafts.map(scanDraft));
    setDrafts(scanned);

    const conflicts = scanned.filter((d) => d.conflictType);
    if (conflicts.length > 0) {
      toast.warning(t("toasts.conflictsDetected"), {
        description: t("toasts.conflictsDescription", {
          count: conflicts.length,
        }),
      });
    } else {
      toast.success(t("toasts.allClear"), {
        description: t("toasts.allClearDescription"),
      });
    }
    setSending(false);
  };

  // ============================================================
  // SENT INVITATIONS
  // ============================================================

  const fetchSentInvitations = async () => {
    if (!user) return;

    const targetCompanyId = isSuperAdmin ? selectedCompanyId : user.companyId;
    if (!targetCompanyId) return;

    setLoadingSentInvitations(true);
    const { data, error } = await supabase
      .from("invitation")
      .select(
        "id, email, role, status, expires_at, invited_by, deleted_at, deleted_by"
      )
      .eq("company_id", targetCompanyId)
      .is("deleted_at", null)
      .in("status", ["pending", "expired"])
      .order("expires_at", { ascending: false });

    if (error) {
      toast.error(t("toasts.failedToLoad"), { description: error.message });
    } else {
      setSentInvitations(data || []);
    }
    setLoadingSentInvitations(false);
  };

  useEffect(() => {
    if (activeView === "sent" && canManageInvitations) {
      fetchSentInvitations();
    }
  }, [activeView, user, selectedCompanyId]);

  const revokeSentInvitation = async (invitationId: number) => {
    if (!user) return;

    const { error } = await supabase
      .from("invitation")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq("id", invitationId);

    if (error) {
      toast.error(t("toasts.failedToRevoke"), {
        description: error.message,
      });
    } else {
      toast.success(t("toasts.invitationRevoked"));
      setSentInvitations((prev) =>
        prev.filter((inv) => inv.id !== invitationId)
      );
    }
  };

  // ============================================================
  // SEND OPERATIONS
  // ============================================================

  const sendSingle = async (draft: Draft, force: boolean = false) => {
    if (!user || !draft.email.includes("@")) return;

    const targetCompanyId = isSuperAdmin ? selectedCompanyId! : user.companyId;

    if (isSuperAdmin && !selectedCompanyId) {
      toast.error(t("toasts.selectCompanyFirst"));
      return;
    }

    if (!isRegularUser && !force) {
      const scanned = await scanDraft(draft);
      if (scanned.conflictType) {
        setDrafts((d) => d.map((dr) => (dr.id === draft.id ? scanned : dr)));
        toast.warning(t("toasts.conflictDetected"), {
          description: t("toasts.conflictDescription"),
        });
        return;
      }
    }

    if (isRegularUser) {
      const { data: existingUser } = await supabase
        .from("user")
        .select("id")
        .eq("email", draft.email.trim())
        .maybeSingle();

      if (existingUser) {
        const { data: companyMember } = await supabase
          .from("user_company_role")
          .select("role")
          .eq("user_id", existingUser.id)
          .eq("company_id", targetCompanyId)
          .is("revoked_at", null)
          .maybeSingle();

        if (companyMember) {
          setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
          toast.info(t("toasts.alreadyMember"), {
            description: t("toasts.alreadyMemberDescription", {
              email: draft.email,
            }),
          });
          return;
        }
      }
    }

    // ✅ Set status to sending
    setDrafts((d) =>
      d.map((dr) => (dr.id === draft.id ? { ...dr, status: "sending" } : dr))
    );

    setSending(true);

    // ✅ Show loading toast
    const loadingToast = toast.loading(
      t("toasts.sending", { email: draft.email })
    );

    if (
      draft.conflictType === "member" &&
      !isRegularUser &&
      draft.existingRole !== "superadmin" &&
      force
    ) {
      const { error } = await supabase
        .from("user_company_role")
        .update({ role: draft.role })
        .eq("user_id", draft.userId!)
        .eq("company_id", targetCompanyId)
        .is("revoked_at", null);

      if (error) {
        // ✅ Set status to failed
        setDrafts((d) =>
          d.map((dr) => (dr.id === draft.id ? { ...dr, status: "failed" } : dr))
        );
        toast.error(t("toasts.failedToUpdateRole"), {
          description: error.message,
          id: loadingToast,
        });
      } else {
        toast.success(t("toasts.roleUpdated"), {
          description: t("toasts.roleUpdatedDescription", {
            email: draft.email,
          }),
          id: loadingToast,
        });
        // ✅ Remove draft on success
        setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
      }
    } else {
      const { data: invitation, error } = await supabase
        .from("invitation")
        .insert({
          email: draft.email.trim(),
          role: draft.role,
          company_id: targetCompanyId,
          invited_by: user.id,
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        // ✅ Set status to failed
        setDrafts((d) =>
          d.map((dr) => (dr.id === draft.id ? { ...dr, status: "failed" } : dr))
        );
        toast.error(t("toasts.failedToSend"), {
          description: error.message,
          id: loadingToast,
        });
      } else if (invitation) {
        try {
          const response = await fetch("/api/invitations/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invitationId: invitation.id,
              language: language,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to send email");
          }

          toast.success(t("toasts.invitationSent"), {
            description: t("toasts.invitationSentDescription", {
              email: draft.email,
            }),
            id: loadingToast,
          });
          // ✅ Remove draft on success
          setDrafts((d) => d.filter((dr) => dr.id !== draft.id));
        } catch (emailError) {
          console.error("Email sending error:", emailError);
          // ✅ Set status to failed
          setDrafts((d) =>
            d.map((dr) =>
              dr.id === draft.id ? { ...dr, status: "failed" } : dr
            )
          );
          toast.warning(t("toasts.invitationCreatedEmailFailed"), {
            description: t("toasts.invitationCreatedEmailFailedDescription"),
            id: loadingToast,
          });
        }
      }
    }
    setSending(false);
  };

  const sendAll = async () => {
    if (!user) return;
    setSending(true);

    const uniqueDrafts = removeDuplicateDrafts(drafts);
    if (uniqueDrafts.length < drafts.length) {
      const removed = drafts.length - uniqueDrafts.length;
      toast.info(
        t("toasts.duplicatesRemoved", {
          count: removed,
          plural: removed > 1 ? "s" : "",
        })
      );
      setDrafts(uniqueDrafts);
    }

    const validDrafts = uniqueDrafts.filter(
      (d) => d.email.includes("@") && allowedRoles.includes(d.role)
    );

    const targetCompanyId = isSuperAdmin ? selectedCompanyId! : user.companyId;

    if (isSuperAdmin && !selectedCompanyId) {
      toast.error(t("toasts.selectCompanyFirst"));
      setSending(false);
      return;
    }

    if (isRegularUser) {
      // ✅ Set all drafts to sending
      setDrafts((d) =>
        d.map((dr) =>
          validDrafts.find((vd) => vd.id === dr.id)
            ? { ...dr, status: "sending" }
            : dr
        )
      );

      const results = await Promise.allSettled(
        validDrafts.map(async (draft) => {
          const { data: existingUser } = await supabase
            .from("user")
            .select("id")
            .eq("email", draft.email.trim())
            .maybeSingle();

          if (existingUser) {
            const { data: companyMember } = await supabase
              .from("user_company_role")
              .select("role")
              .eq("user_id", existingUser.id)
              .eq("company_id", targetCompanyId)
              .is("revoked_at", null)
              .maybeSingle();

            if (companyMember) {
              return { status: "skipped" as const, id: draft.id };
            }
          }

          const { data: invitation, error } = await supabase
            .from("invitation")
            .insert({
              email: draft.email.trim(),
              role: draft.role,
              company_id: targetCompanyId,
              invited_by: user.id,
              expires_at: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
              status: "pending",
            })
            .select()
            .single();

          if (error || !invitation) {
            throw new Error(`Failed to create invitation for ${draft.email}`);
          }

          try {
            await fetch("/api/invitations/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                invitationId: invitation.id,
                language: language,
              }),
            });
          } catch (emailError) {
            console.warn(
              `Email failed for ${draft.email}, but invitation created`
            );
          }

          return { status: "sent" as const, id: draft.id };
        })
      );

      let sent = 0;
      let skipped = 0;
      let failed = 0;
      const sentIds: string[] = [];
      const skippedIds: string[] = [];
      const failedIds: string[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          if (result.value.status === "sent") {
            sent++;
            sentIds.push(result.value.id);
          }
          if (result.value.status === "skipped") {
            skipped++;
            skippedIds.push(result.value.id);
          }
        } else {
          failed++;
          failedIds.push(validDrafts[index].id);
          console.error("Invitation failed:", result.reason);
        }
      });

      // ✅ Remove sent and skipped, mark failed
      setDrafts((d) =>
        d
          .filter(
            (dr) => !sentIds.includes(dr.id) && !skippedIds.includes(dr.id)
          )
          .map((dr) =>
            failedIds.includes(dr.id) ? { ...dr, status: "failed" } : dr
          )
      );

      setSending(false);

      const messages = [];
      if (sent > 0)
        messages.push(
          t("toasts.sentCount", { count: sent, plural: sent > 1 ? "s" : "" })
        );
      if (skipped > 0)
        messages.push(
          t("toasts.alreadyMemberCount", {
            count: skipped,
            plural: skipped > 1 ? "s" : "",
          })
        );
      if (failed > 0) messages.push(t("toasts.failedCount", { count: failed }));

      if (messages.length > 0) {
        toast.success(t("toasts.invitationsProcessed"), {
          description: messages.join(". "),
        });
      } else {
        toast.info(t("toasts.noInvitationsToSend"));
      }
      return;
    }

    const scannedDrafts = await Promise.all(validDrafts.map(scanDraft));
    const cleanDrafts = scannedDrafts.filter((d) => !d.conflictType);
    const problematicFound = scannedDrafts.filter((d) => d.conflictType);

    if (problematicFound.length > 0) {
      setDrafts((currentDrafts) =>
        currentDrafts.map((draft) => {
          const scanned = scannedDrafts.find((s) => s.id === draft.id);
          return scanned || draft;
        })
      );
    }

    // ✅ Set clean drafts to sending
    setDrafts((d) =>
      d.map((dr) =>
        cleanDrafts.find((cd) => cd.id === dr.id)
          ? { ...dr, status: "sending" }
          : dr
      )
    );

    const results = await Promise.allSettled(
      cleanDrafts.map(async (draft) => {
        const { data: invitation, error } = await supabase
          .from("invitation")
          .insert({
            email: draft.email.trim(),
            role: draft.role,
            company_id: targetCompanyId,
            invited_by: user.id,
            expires_at: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            status: "pending",
          })
          .select()
          .single();

        if (error || !invitation) {
          throw new Error(`Failed to create invitation for ${draft.email}`);
        }

        try {
          await fetch("/api/invitations/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invitationId: invitation.id,
              language: language,
            }),
          });
        } catch (emailError) {
          console.warn(
            `Email failed for ${draft.email}, but invitation created`
          );
        }

        return draft.id;
      })
    );

    const sentDraftIds = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<string>).value);

    const failedDraftIds = cleanDrafts
      .filter((draft) => !sentDraftIds.includes(draft.id))
      .map((draft) => draft.id);

    // ✅ Remove sent drafts, mark failed
    setDrafts((d) =>
      d
        .filter((dr) => !sentDraftIds.includes(dr.id))
        .map((dr) =>
          failedDraftIds.includes(dr.id) ? { ...dr, status: "failed" } : dr
        )
    );

    setSending(false);

    const sent = sentDraftIds.length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (sent > 0 && problematicFound.length === 0 && failed === 0) {
      toast.success(t("toasts.allInvitationsSent"), {
        description: t("toasts.allInvitationsSentDescription", {
          count: sent,
          plural: sent > 1 ? "s" : "",
        }),
      });
    } else if (sent > 0 && problematicFound.length > 0) {
      toast.success(t("toasts.partialSuccess"), {
        description: t("toasts.partialSuccessDescription", {
          count: sent,
          plural: sent > 1 ? "s" : "",
          problematic: problematicFound.length,
        }),
      });
    } else if (sent > 0 && failed > 0) {
      toast.warning(t("toasts.someFailed"), {
        description: t("toasts.someFailedDescription", {
          sent: sent,
          failed: failed,
        }),
      });
    } else if (problematicFound.length > 0 && sent === 0) {
      toast.warning(t("toasts.conflictsDetected"), {
        description: t("toasts.conflictsDescription", {
          count: problematicFound.length,
        }),
      });
    } else {
      toast.info(t("toasts.noInvitationsToSend"));
    }
  };

  return {
    user,
    companies,
    loading,
    drafts,
    setDrafts,
    sending,
    activeView,
    setActiveView,
    sentInvitations,
    loadingSentInvitations,
    selectedCompanyId,
    setSelectedCompanyId,
    searchEmail,
    setSearchEmail,
    filterRole,
    setFilterRole,
    filterStatus,
    setFilterStatus,
    allowedRoles,
    isSuperAdmin,
    isCompanyAdmin,
    isRegularUser,
    canManageInvitations,
    problematicDrafts,
    selectedCompany,
    filteredSentInvitations,
    hasActiveFilters,
    updateDraft,
    clearFilters,
    scanAll,
    revokeSentInvitation,
    sendSingle,
    sendAll,
  };
}

export type { Role, User, Company, Draft, SentInvitation, InvitationStatus };
