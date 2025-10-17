//hype-hire/web/app/dashboard2/invitations/page.tsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Send,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  AlertTriangle,
  Info,
  Download,
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
  Ban,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CurrentUser {
  id: number;
  email: string;
  companyId: number;
}

interface DraftInvitation {
  id: string; // Temporary ID for local management
  email: string;
  role: string;
  hasError?: string;
}

interface SentInvitation {
  id: number; // Real database ID
  email: string;
  role: string;
  status: string;
  expires_at: string;
  invited_by: number;
  company_id: number;
  token: string;
}

type TabType = "drafts" | "sent";

interface EmailConflict {
  type: "pending" | "expired" | "revoked" | null;
  message: string;
  className: string;
}

interface CSVRow {
  email: string;
  role: string;
}

export default function InvitationsManagerPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [drafts, setDrafts] = useState<DraftInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<SentInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("drafts");
  const [uploading, setUploading] = useState(false);

  // Search and filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<"email" | "role">("email");
  const [sentSearchQuery, setSentSearchQuery] = useState("");
  const [sentSearchField, setSentSearchField] = useState<"email" | "role">(
    "email"
  );

  // Pagination states
  const [draftsPage, setDraftsPage] = useState(1);
  const [draftsPerPage, setDraftsPerPage] = useState(20);
  const [sentPage, setSentPage] = useState(1);
  const [sentPerPage, setSentPerPage] = useState(20);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchSentInvitations();
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        throw new Error("Not authenticated");
      }

      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("id, email, auth_user_id")
        .eq("auth_user_id", authUser.id)
        .is("deleted_at", null)
        .single();

      if (userError || !userData) {
        throw new Error("User record not found");
      }

      setCurrentUser({
        id: userData.id,
        email: userData.email,
        companyId: 1, // Default company
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch user");
    } finally {
      setLoading(false);
    }
  };

  const fetchSentInvitations = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from("invitation")
        .select("*")
        .eq("company_id", currentUser.companyId)
        .is("deleted_at", null)
        .order("id", { ascending: false });

      if (error) throw error;

      setSentInvitations(data || []);
    } catch (err) {
      console.error("Failed to fetch sent invitations:", err);
    }
  };

  const revokeInvitation = async (invitationId: number) => {
    if (!currentUser) return;

    try {
      setRevoking((prev) => new Set(prev).add(invitationId));
      setError(null);

      const { error } = await supabase
        .from("invitation")
        .update({ status: "revoked" })
        .eq("id", invitationId)
        .eq("company_id", currentUser.companyId);

      if (error) throw error;

      // Update local state
      setSentInvitations((prev) =>
        prev.map((inv) =>
          inv.id === invitationId ? { ...inv, status: "revoked" } : inv
        )
      );

      setSuccess("Invitation revoked successfully");
    } catch (err) {
      console.error("Revoke error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to revoke invitation"
      );
    } finally {
      setRevoking((prev) => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  };

  // Filter and search logic
  const filteredDrafts = useMemo(() => {
    if (!searchQuery) return drafts;

    return drafts.filter((draft) => {
      const searchValue = searchField === "email" ? draft.email : draft.role;
      return searchValue.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [drafts, searchQuery, searchField]);

  const filteredSentInvitations = useMemo(() => {
    if (!sentSearchQuery) return sentInvitations;

    return sentInvitations.filter((invitation) => {
      const searchValue =
        sentSearchField === "email" ? invitation.email : invitation.role;
      return searchValue.toLowerCase().includes(sentSearchQuery.toLowerCase());
    });
  }, [sentInvitations, sentSearchQuery, sentSearchField]);

  // Pagination logic
  const paginatedDrafts = useMemo(() => {
    const startIndex = (draftsPage - 1) * draftsPerPage;
    return filteredDrafts.slice(startIndex, startIndex + draftsPerPage);
  }, [filteredDrafts, draftsPage, draftsPerPage]);

  const paginatedSentInvitations = useMemo(() => {
    const startIndex = (sentPage - 1) * sentPerPage;
    return filteredSentInvitations.slice(startIndex, startIndex + sentPerPage);
  }, [filteredSentInvitations, sentPage, sentPerPage]);

  const totalDraftsPages = Math.ceil(filteredDrafts.length / draftsPerPage);
  const totalSentPages = Math.ceil(
    filteredSentInvitations.length / sentPerPage
  );

  const isValidEmail = (email: string): boolean => {
    if (!email || !email.includes("@")) return false;

    const parts = email.split("@");
    if (parts.length !== 2) return false;

    const [localPart, domain] = parts;
    if (!localPart || !domain) return false;

    // Check if domain has at least one dot
    return domain.includes(".");
  };

  const checkEmailConflict = (email: string): EmailConflict => {
    if (!email || !isValidEmail(email)) {
      return { type: null, message: "", className: "" };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const matchingInvitations = sentInvitations.filter(
      (inv) => inv.email.toLowerCase() === normalizedEmail
    );

    if (matchingInvitations.length === 0) {
      return { type: null, message: "", className: "" };
    }

    // Prioritize statuses: pending > expired/revoked > others
    const hasPending = matchingInvitations.some(
      (inv) => inv.status === "pending"
    );
    const hasExpiredOrRevoked = matchingInvitations.some(
      (inv) => inv.status === "expired" || inv.status === "revoked"
    );

    if (hasPending) {
      return {
        type: "pending",
        message: "This email already has a pending invitation",
        className: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
      };
    }

    if (hasExpiredOrRevoked) {
      return {
        type: "expired",
        message: "This email has a previous expired or revoked invitation",
        className: "bg-red-50 border-red-200 hover:bg-red-100",
      };
    }

    return { type: null, message: "", className: "" };
  };

  const downloadCSVTemplate = () => {
    const csvContent = "email,role\nexample@domain.com,worker\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "invitation_template.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const parseCSV = (csvText: string): CSVRow[] => {
    const lines = csvText.trim().split("\n");
    const header = lines[0]
      .toLowerCase()
      .split(",")
      .map((h) => h.trim());

    const emailIndex = header.findIndex((h) => h.includes("email"));
    const roleIndex = header.findIndex((h) => h.includes("role"));

    if (emailIndex === -1) {
      throw new Error('CSV must contain an "email" column');
    }

    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));

      if (values.length > emailIndex) {
        const email = values[emailIndex];
        const role = roleIndex !== -1 ? values[roleIndex] : "worker";

        // Validate role
        const validRoles = [
          "superadmin",
          "company_admin",
          "supervisor",
          "worker",
        ];
        const normalizedRole =
          validRoles.find((r) => r.toLowerCase() === role.toLowerCase()) ||
          "worker";

        if (email) {
          rows.push({ email, role: normalizedRole });
        }
      }
    }

    return rows;
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const text = await file.text();
      const csvRows = parseCSV(text);

      if (csvRows.length === 0) {
        throw new Error("No valid rows found in CSV file");
      }

      // Clear existing drafts and add CSV rows
      const newDrafts: DraftInvitation[] = csvRows.map((row, index) => ({
        id: `csv_${Date.now()}_${index}`,
        email: row.email,
        role: row.role,
      }));

      setDrafts(newDrafts);
      setDraftsPage(1); // Reset to first page
      setSuccess(
        `Successfully loaded ${csvRows.length} invitation(s) from CSV`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const addNewDraft = () => {
    const newDraft: DraftInvitation = {
      id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: "",
      role: "worker",
    };
    setDrafts((prev) => [...prev, newDraft]);
  };

  const updateDraft = (
    id: string,
    field: keyof DraftInvitation,
    value: string
  ) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.id === id
          ? { ...draft, [field]: value, hasError: undefined }
          : draft
      )
    );
  };

  const deleteDraft = (id: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.id !== id));
  };

  const deleteAllDrafts = () => {
    setDrafts([]);
    setDraftsPage(1);
    setSuccess("All draft invitations deleted");
  };

  const validateDraft = (draft: DraftInvitation): string | null => {
    if (!draft.email.trim()) {
      return "Email is required";
    }
    if (!isValidEmail(draft.email)) {
      return "Invalid email format";
    }
    if (!draft.role) {
      return "Role is required";
    }
    return null;
  };

  const sendInvitation = async (draftId: string) => {
    if (!currentUser) return;

    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;

    const validationError = validateDraft(draft);
    if (validationError) {
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draftId ? { ...d, hasError: validationError } : d
        )
      );
      return;
    }

    try {
      setSending((prev) => new Set(prev).add(draftId));
      setError(null);

      const invitationData = {
        email: draft.email.trim(),
        role: draft.role,
        status: "pending",
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        company_id: currentUser.companyId,
        invited_by: currentUser.id,
      };

      const { data, error } = await supabase
        .from("invitation")
        .insert([invitationData])
        .select()
        .single();

      if (error) throw error;

      // Add to sent invitations
      setSentInvitations((prev) => [data, ...prev]);

      // Remove from drafts
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));

      setSuccess(`Invitation sent to ${draft.email}`);
    } catch (err) {
      console.error("Send error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to send invitation"
      );
    } finally {
      setSending((prev) => {
        const newSet = new Set(prev);
        newSet.delete(draftId);
        return newSet;
      });
    }
  };

  const sendAllInvitations = async () => {
    const validDrafts = drafts.filter((draft) => !validateDraft(draft));

    if (validDrafts.length === 0) {
      setError("No valid invitations to send");
      return;
    }

    try {
      setError(null);
      const results = await Promise.allSettled(
        validDrafts.map((draft) => sendInvitation(draft.id))
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      setSuccess(`Successfully sent ${successful} invitation(s)`);
    } catch (err) {
      setError("Failed to send some invitations");
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      superadmin: "Super Admin",
      company_admin: "Company Admin",
      supervisor: "Supervisor",
      worker: "Worker",
    };
    return roleNames[role] || role;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: "bg-amber-100 text-amber-800 border-amber-200",
      accepted: "bg-emerald-100 text-emerald-800 border-emerald-200",
      declined: "bg-rose-100 text-rose-800 border-rose-200",
      expired: "bg-slate-100 text-slate-800 border-slate-200",
      revoked: "bg-gray-100 text-gray-800 border-gray-200",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
          variants[status] || variants.pending
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void,
    perPage: number,
    onPerPageChange: (perPage: number) => void,
    totalItems: number
  ) => {
    if (totalItems === 0) return null;

    const startItem = (currentPage - 1) * perPage + 1;
    const endItem = Math.min(currentPage * perPage, totalItems);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Show</span>
          <Select
            value={perPage.toString()}
            onValueChange={(value) => onPerPageChange(Number(value))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span>of {totalItems} items</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">
            {startItem}-{endItem} of {totalItems}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          <span className="ml-2 text-slate-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Alert className="bg-rose-50 border-rose-200">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <AlertDescription className="text-rose-800">
            {error || "Please log in to manage invitations"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">
          Invitations Manager
        </h1>
        <p className="text-lg text-slate-600">
          Create and send multiple team invitations
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Logged in as: {currentUser.email} | Company: {currentUser.companyId} |
          Drafts: {drafts.length} | Sent: {sentInvitations.length}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-slate-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("drafts")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "drafts"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            New invitations ({filteredDrafts.length})
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "sent"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Past invitations ({filteredSentInvitations.length})
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert className="mb-6 bg-rose-50 border-rose-200">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <AlertDescription className="text-rose-800">
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setError(null)}
              className="ml-2 text-slate-600 border-slate-300 hover:bg-slate-50"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-emerald-50 border-emerald-200">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800">
            {success}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuccess(null)}
              className="ml-2 text-slate-600 border-slate-300 hover:bg-slate-50"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Draft Invitations - Show only when activeTab is 'drafts' */}
      {activeTab === "drafts" && (
        <Card className="mb-8 bg-white shadow-sm border-0 ring-1 ring-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col gap-4">
              {/* Main Actions Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-xl font-semibold text-slate-900">
                  Draft Invitations ({filteredDrafts.length})
                </CardTitle>
                <div className="flex gap-3">
                  {drafts.length > 0 && (
                    <>
                      <Button
                        onClick={sendAllInvitations}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                        disabled={sending.size > 0 || uploading}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send All ({drafts.length})
                      </Button>
                      <Button
                        onClick={deleteAllDrafts}
                        variant="outline"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-300 hover:border-rose-400"
                        disabled={sending.size > 0 || uploading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={addNewDraft}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
                    disabled={uploading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Draft
                  </Button>
                </div>
              </div>

              {/* CSV Actions Row */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <Button
                  onClick={downloadCSVTemplate}
                  variant="outline"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900 border-slate-300 hover:bg-slate-50"
                >
                  <Download className="h-3 w-3 mr-2" />
                  Download Template
                </Button>
                <Button
                  onClick={triggerFileUpload}
                  variant="outline"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900 border-slate-300 hover:bg-slate-50"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3 mr-2" />
                      Upload List
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Search Row */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder={`Search by ${searchField}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={searchField}
                  onValueChange={(value) =>
                    setSearchField(value as "email" | "role")
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedDrafts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-8 text-center text-slate-500"
                      >
                        {searchQuery
                          ? `No invitations found matching "${searchQuery}"`
                          : 'No draft invitations. Click "Add Draft" to get started or "Upload List" to import from CSV.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedDrafts.map((draft) => {
                      const isSending = sending.has(draft.id);
                      const emailConflict = checkEmailConflict(draft.email);

                      return (
                        <React.Fragment key={draft.id}>
                          {/* Main Row */}
                          <tr
                            className={`transition-colors border-b ${
                              draft.hasError
                                ? "bg-rose-50"
                                : emailConflict.type
                                ? emailConflict.className.replace(
                                    "hover:bg-",
                                    "hover:"
                                  )
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Input
                                value={draft.email}
                                onChange={(e) =>
                                  updateDraft(draft.id, "email", e.target.value)
                                }
                                placeholder="Enter email address"
                                className={
                                  draft.hasError
                                    ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                                    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
                                }
                                disabled={isSending}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Select
                                value={draft.role}
                                onValueChange={(value) =>
                                  updateDraft(draft.id, "role", value)
                                }
                                disabled={isSending}
                              >
                                <SelectTrigger className="w-40 border-slate-300 focus:border-indigo-500 focus:ring-indigo-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="superadmin">
                                    Super Admin
                                  </SelectItem>
                                  <SelectItem value="company_admin">
                                    Company Admin
                                  </SelectItem>
                                  <SelectItem value="supervisor">
                                    Supervisor
                                  </SelectItem>
                                  <SelectItem value="worker">Worker</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  size="sm"
                                  onClick={() => sendInvitation(draft.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                  disabled={isSending || !draft.email}
                                >
                                  {isSending ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <Send className="h-3 w-3 mr-1" />
                                      Send
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteDraft(draft.id)}
                                  className="text-rose-600 hover:text-rose-700 border-rose-300 hover:border-rose-400 hover:bg-rose-50"
                                  disabled={isSending}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Message Row - Only show if there's a message */}
                          {(draft.hasError || emailConflict.type) && (
                            <tr
                              className={`${
                                draft.hasError
                                  ? "bg-rose-50"
                                  : emailConflict.type
                                  ? emailConflict.className
                                  : ""
                              }`}
                            >
                              <td colSpan={3} className="px-6 py-2 border-b">
                                {draft.hasError && (
                                  <div className="flex items-center space-x-1 text-rose-600 text-xs">
                                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                    <span>{draft.hasError}</span>
                                  </div>
                                )}
                                {emailConflict.type && !draft.hasError && (
                                  <div
                                    className={`flex items-center space-x-1 text-xs ${
                                      emailConflict.type === "pending"
                                        ? "text-amber-700"
                                        : "text-rose-700"
                                    }`}
                                  >
                                    {emailConflict.type === "pending" ? (
                                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                    ) : (
                                      <Info className="h-3 w-3 flex-shrink-0" />
                                    )}
                                    <span>{emailConflict.message}</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for Drafts */}
            {renderPagination(
              draftsPage,
              totalDraftsPages,
              setDraftsPage,
              draftsPerPage,
              setDraftsPerPage,
              filteredDrafts.length
            )}
          </CardContent>
        </Card>
      )}

      {/* Sent Invitations - Show only when activeTab is 'sent' */}
      {activeTab === "sent" && (
        <Card className="bg-white shadow-sm border-0 ring-1 ring-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col gap-4">
              <CardTitle className="text-xl font-semibold text-slate-900">
                Sent Invitations ({filteredSentInvitations.length})
              </CardTitle>

              {/* Search Row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder={`Search by ${sentSearchField}...`}
                    value={sentSearchQuery}
                    onChange={(e) => setSentSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={sentSearchField}
                  onValueChange={(value) =>
                    setSentSearchField(value as "email" | "role")
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Expires At
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Token
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {paginatedSentInvitations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-slate-500"
                      >
                        {sentSearchQuery
                          ? `No invitations found matching "${sentSearchQuery}"`
                          : "No sent invitations yet."}
                      </td>
                    </tr>
                  ) : (
                    paginatedSentInvitations.map((invitation) => {
                      const isRevoking = revoking.has(invitation.id);
                      const canRevoke = invitation.status === "pending";

                      return (
                        <tr key={invitation.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {invitation.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {getRoleDisplayName(invitation.role)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(invitation.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {new Date(
                              invitation.expires_at
                            ).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                              {invitation.token.substring(0, 8)}...
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {canRevoke && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => revokeInvitation(invitation.id)}
                                className="text-orange-600 hover:text-orange-700 border-orange-300 hover:border-orange-400 hover:bg-orange-50"
                                disabled={isRevoking}
                              >
                                {isRevoking ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Revoking...
                                  </>
                                ) : (
                                  <>
                                    <Ban className="h-3 w-3 mr-1" />
                                    Revoke
                                  </>
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for Sent Invitations */}
            {renderPagination(
              sentPage,
              totalSentPages,
              setSentPage,
              sentPerPage,
              setSentPerPage,
              filteredSentInvitations.length
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
