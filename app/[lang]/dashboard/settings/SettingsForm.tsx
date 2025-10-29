//hype-hire/vercel/app/[lang]/dashboard/settings/SettingsForm.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import ProfilePictureCrop from "@/components/ProfilePictureCrop";

interface SettingsFormProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    profilePictureUrl: string | null;
  };
  targetUserId?: number; // ✅ NEW: if provided, editing someone else
  onSuccess?: () => void; // ✅ NEW: callback after successful save
}

export default function SettingsForm({
  user,
  targetUserId,
  onSuccess,
}: SettingsFormProps) {
  const { t } = useTranslation("settings");
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [displayPictureUrl, setDisplayPictureUrl] = useState(
    user.profilePictureUrl
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // ✅ Sync with prop changes
  useEffect(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setDisplayPictureUrl(user.profilePictureUrl);
  }, [user.firstName, user.lastName, user.profilePictureUrl]);

  const handleImageSelected = (file: File) => {
    setSelectedFile(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const newPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(newPreviewUrl);
    setDisplayPictureUrl(newPreviewUrl);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error(t("validation.required"));
      return;
    }

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      toast.error(t("validation.nameLength"));
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("firstName", firstName.trim());
      formData.append("lastName", lastName.trim());

      // ✅ If targetUserId provided, we're editing someone else
      if (targetUserId) {
        formData.append("userId", targetUserId.toString());
      }

      if (selectedFile) {
        formData.append("profilePicture", selectedFile);
      }

      // ✅ Use different API based on context
      const apiUrl = targetUserId
        ? "/api/update-user"
        : "/api/update-profile";

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t("success.profileUpdated"));
        setSelectedFile(null);

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }

        if (data.profilePictureUrl) {
          setDisplayPictureUrl(data.profilePictureUrl);
        }

        // ✅ Call success callback if provided
        onSuccess?.();
      } else {
        toast.error(data.error || t("errors.updateFailed"));
        setSelectedFile(null);

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }

        setDisplayPictureUrl(user.profilePictureUrl);
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error(t("errors.genericError"));
      setSelectedFile(null);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      setDisplayPictureUrl(user.profilePictureUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-elegant border border-border p-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="pb-6 border-b border-border">
          <ProfilePictureCrop
            currentImageUrl={displayPictureUrl}
            onImageSelected={handleImageSelected}
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-primary font-semibold">
              {t("photo.newSelected")}
            </p>
          )}
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label
                htmlFor="firstName"
                className="block text-sm font-semibold text-foreground"
              >
                {t("fields.firstName.label")}
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                placeholder={t("fields.firstName.placeholder")}
              />
            </div>
            <div className="space-y-3">
              <label
                htmlFor="lastName"
                className="block text-sm font-semibold text-foreground"
              >
                {t("fields.lastName.label")}
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                placeholder={t("fields.lastName.placeholder")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-foreground"
              >
                {t("fields.email.label")}
              </label>
              <input
                type="email"
                id="email"
                value={user.email}
                disabled
                className="w-full px-4 py-3 bg-muted border border-input rounded-xl text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="space-y-3 relative group">
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-muted-foreground"
              >
                {t("fields.phone.label")}
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  {t("badges.comingSoon")}
                </span>
              </label>
              <input
                type="tel"
                id="phone"
                disabled
                placeholder={t("fields.phone.placeholder")}
                className="w-full px-4 py-3 bg-muted border border-input rounded-xl text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 relative group">
              <label
                htmlFor="dateOfBirth"
                className="block text-sm font-semibold text-muted-foreground"
              >
                {t("fields.dateOfBirth.label")}
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  {t("badges.comingSoon")}
                </span>
              </label>
              <input
                type="date"
                id="dateOfBirth"
                disabled
                className="w-full px-4 py-3 bg-muted border border-input rounded-xl text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="space-y-3 relative group">
              <label
                htmlFor="emergencyContact"
                className="block text-sm font-semibold text-muted-foreground"
              >
                {t("fields.emergencyContact.label")}
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  {t("badges.comingSoon")}
                </span>
              </label>
              <input
                type="tel"
                id="emergencyContact"
                disabled
                placeholder={t("fields.emergencyContact.placeholder")}
                className="w-full px-4 py-3 bg-muted border border-input rounded-xl text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t("buttons.saving") : t("buttons.saveChanges")}
          </button>
        </div>
      </form>
    </div>
  );
}



//Save as user types (with debouncing):
//useEffect(() => {
//  const timeout = setTimeout(() => {
    // Auto-save after 2 seconds of no typing
 //   saveProfile();
//  }, 2000); 
//  return () => clearTimeout(timeout);
//}, [firstName, lastName]);