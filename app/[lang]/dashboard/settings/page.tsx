// hype-hire/web/app/dashboard2/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: number;
  email: string;
  first_Name?: string;
  last_Name?: string;
  created_at: string;
  has_password?: boolean;
}

// Helper function to check if user has password
const hasPassword = (profile: Profile | null) => {
  if (!profile) return false;
  return profile.has_password === true;
};

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile editing states
  const [originalProfile, setOriginalProfile] = useState<Partial<Profile>>({});
  const [editingProfile, setEditingProfile] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  // Check if there are unsaved changes
  const hasChanges = () => {
    return (
      originalProfile.first_Name !== editingProfile.first_Name ||
      originalProfile.last_Name !== editingProfile.last_Name
    );
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        user!.email!,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      const userHasPassword = hasPassword(profile);
      const message = userHasPassword
        ? "Password reset email sent! Check your inbox to reset your password."
        : "Password setup email sent! Check your inbox to set up your password.";

      alert(message);
    } catch (error) {
      alert("Error sending reset email: " + (error as Error).message);
    }
  };

  // Handle profile save
  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("user")
        .update({
          first_Name: editingProfile.first_Name || null,
          last_Name: editingProfile.last_Name || null,
        })
        .eq("id", profile.id);

      if (error) {
        alert("Error updating profile: " + error.message);
      } else {
        // Update local state
        const updatedProfile = {
          ...profile,
          first_Name: editingProfile.first_Name,
          last_Name: editingProfile.last_Name,
        };
        setProfile(updatedProfile);

        // Update original profile to match saved changes
        setOriginalProfile({
          first_Name: editingProfile.first_Name,
          last_Name: editingProfile.last_Name,
        });

        alert("Profile updated successfully!");
      }
    } catch (error) {
      alert("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  // Reset changes
  const handleResetChanges = () => {
    setEditingProfile({ ...originalProfile });
  };

  useEffect(() => {
    async function getUser() {
      try {
        // Get current user
        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !currentUser) {
          router.push("/login");
          return;
        }

        setUser(currentUser);

        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from("user")
          .select("id, email, first_Name, last_Name, created_at, has_password")
          .eq("auth_user_id", currentUser.id)
          .is("deleted_at", null) // ✅ Only active profiles
          .maybeSingle(); // ✅ Better error handling

        if (profileError || !profileData) {
          console.error("Error fetching profile:", profileError?.message);
          router.push("/login");
          return;
        }

        setProfile(profileData);

        // Initialize editing states with current profile data
        const profileForEditing = {
          first_Name: profileData.first_Name || "",
          last_Name: profileData.last_Name || "",
        };
        setOriginalProfile(profileForEditing);
        setEditingProfile(profileForEditing);
      } catch (error) {
        console.error("Error in auth check:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    getUser();
  }, [router, supabase]);

  // GDPR Controls Component
  function GDPRControls() {
    const [loading, setLoading] = useState({ export: false, delete: false });
    const [message, setMessage] = useState("");

    const handleExport = async () => {
      setLoading((prev) => ({ ...prev, export: true }));
      setMessage("");

      try {
        const response = await fetch("/api/gdpr/export", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `hypehire-data-${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          setMessage("✅ Data exported successfully!");
        } else {
          throw new Error("Export failed");
        }
      } catch (error) {
        setMessage("❌ Export failed. Please try again.");
        console.error("Export error:", error);
      } finally {
        setLoading((prev) => ({ ...prev, export: false }));
      }
    };

    const handleDelete = async () => {
      if (
        !confirm("⚠️ This will permanently delete your account. Are you sure?")
      ) {
        return;
      }

      setLoading((prev) => ({ ...prev, delete: true }));
      setMessage("");

      try {
        const response = await fetch("/api/gdpr/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();

        if (response.ok) {
          setMessage("✅ Account deletion requested. You will be signed out.");
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
        } else {
          setMessage(`❌ ${result.error || "Deletion failed"}`);
        }
      } catch (error) {
        setMessage("❌ Deletion request failed. Please try again.");
        console.error("Delete error:", error);
      } finally {
        setLoading((prev) => ({ ...prev, delete: false }));
      }
    };

    return (
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          📋 Data & Privacy
        </h3>

        {message && (
          <div className="mb-4 p-3 rounded bg-blue-50 dark:bg-blue-900/20 text-sm text-gray-900 dark:text-gray-100">
            {message}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleExport}
            disabled={loading.export}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading.export ? "Exporting..." : "📥 Export My Data"}
          </button>

          <button
            onClick={handleDelete}
            disabled={loading.delete}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading.delete ? "Processing..." : "🗑️ Delete Account"}
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <a href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </a>
          {" • "}
          <a href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading settings...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const userHasPassword = hasPassword(profile);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          ⚙️ Settings
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage your account settings and preferences
        </p>
        {hasChanges() && (
          <div className="mt-2 text-sm text-orange-600 dark:text-orange-400 font-medium">
            ⚠️ You have unsaved changes
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              👤 Personal Information
            </h2>
            {hasChanges() && (
              <div className="space-x-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm disabled:opacity-50 font-medium"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handleResetChanges}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Password Security Alert */}
          {!userHasPassword && (
            <div className="mb-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-orange-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    🔒 Security Recommendation
                  </h3>
                  <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                    <p>
                      You don&apos;t have a password set up. For better
                      security, consider adding a password to your account.
                    </p>
                    <button
                      onClick={handlePasswordReset}
                      className="mt-2 px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                    >
                      Set up password →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user.email || ""}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Email cannot be changed
              </p>
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={editingProfile.first_Name || ""}
                onChange={(e) =>
                  setEditingProfile({
                    ...editingProfile,
                    first_Name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your first name"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={editingProfile.last_Name || ""}
                onChange={(e) =>
                  setEditingProfile({
                    ...editingProfile,
                    last_Name: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your last name"
              />
            </div>

            {/* Account Info (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Member Since
              </label>
              <input
                type="text"
                value={new Date(user.created_at!).toLocaleDateString()}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password Status
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={userHasPassword ? "✅ Password set" : "❌ No password"}
                  disabled
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                {!userHasPassword ? (
                  <button
                    onClick={handlePasswordReset}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm whitespace-nowrap"
                  >
                    Set Password
                  </button>
                ) : (
                  <button
                    onClick={handlePasswordReset}
                    className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm whitespace-nowrap"
                  >
                    Reset Password
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* GDPR Controls */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <GDPRControls />
        </div>
      </div>
    </div>
  );
}
