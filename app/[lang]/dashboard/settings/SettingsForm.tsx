// app/[lang]/dashboard/settings/SettingsForm.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import ProfilePictureCrop from "@/components/ProfilePictureCrop";
import { Loader2 } from "lucide-react";

interface SettingsFormProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    profilePictureUrl: string | null;
  };
  targetUserId?: number;
  onSuccess?: () => void;
}

// ✅ Country codes for Greece and Cyprus
const COUNTRY_CODES = [
  { code: "+30", country: "🇬🇷", value: "GR" },
  { code: "+357", country: "🇨🇾", value: "CY" },
];

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
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [countryCode, setCountryCode] = useState("+30"); // ✅ Default to Greece
  const [displayPictureUrl, setDisplayPictureUrl] = useState(
    user.profilePictureUrl
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const apiUrl = useMemo(
    () => (targetUserId ? "/api/update-user" : "/api/update-profile"),
    [targetUserId]
  );

  // ✅ Parse existing phone number to extract country code
  useEffect(() => {
    if (user.phoneNumber) {
      const matchedCode = COUNTRY_CODES.find((c) =>
        user.phoneNumber.startsWith(c.code)
      );
      if (matchedCode) {
        setCountryCode(matchedCode.code);
        setPhoneNumber(user.phoneNumber.slice(matchedCode.code.length));
      } else {
        setPhoneNumber(user.phoneNumber);
      }
    }
  }, [user.phoneNumber]);

  useEffect(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setDisplayPictureUrl(user.profilePictureUrl);
  }, [user.firstName, user.lastName, user.profilePictureUrl]);

  const isValid = useMemo(() => {
    const namesValid =
      firstName.trim().length >= 2 && lastName.trim().length >= 2;
    const phoneValid =
      !phoneNumber.trim() || /^[\d\s\-]+$/.test(phoneNumber.trim());
    return namesValid && phoneValid;
  }, [firstName, lastName, phoneNumber]);

  const handleImageSelected = useCallback(
    (file: File) => {
      setSelectedFile(file);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      setDisplayPictureUrl(newPreviewUrl);
    },
    [previewUrl]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!firstName.trim() || !lastName.trim()) {
        toast.error(t("validation.required"));
        return;
      }

      if (!isValid) {
        toast.error(t("validation.nameLength"));
        return;
      }

      setSaving(true);

      try {
        const formData = new FormData();
        formData.append("firstName", firstName.trim());
        formData.append("lastName", lastName.trim());

        // ✅ Combine country code with phone number
        const fullPhoneNumber = phoneNumber.trim()
          ? `${countryCode}${phoneNumber.trim()}`
          : "";
        formData.append("phoneNumber", fullPhoneNumber);

        if (targetUserId) {
          formData.append("userId", targetUserId.toString());
        }

        if (selectedFile) {
          formData.append("profilePicture", selectedFile);
        }

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
    },
    [
      firstName,
      lastName,
      phoneNumber,
      countryCode, // ✅ Added to dependencies
      isValid,
      selectedFile,
      targetUserId,
      apiUrl,
      previewUrl,
      user.profilePictureUrl,
      onSuccess,
      t,
    ]
  );

  return (
    <div className="bg-card rounded-2xl shadow-elegant border border-border p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="pb-3 border-b border-border">
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

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
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
                minLength={2}
                required
              />
            </div>
            <div className="space-y-2">
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
                minLength={2}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
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

            {/* ✅ Phone number with country code dropdown */}
            <div className="space-y-2">
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-foreground"
              >
                {t("fields.phone.label")}
              </label>
              <div className="flex gap-2">
                <div className="relative w-28">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full h-full px-3 py-3 bg-background border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all appearance-none cursor-pointer"
                  >
                    {COUNTRY_CODES.map((item) => (
                      <option key={item.value} value={item.code}>
                        {item.country} {item.code}
                      </option>
                    ))}
                  </select>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="w-4 h-4 absolute top-1/2 right-3 -translate-y-1/2 pointer-events-none text-muted-foreground"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </div>
                <input
                  type="tel"
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="123 456 7890"
                  className="flex-1 px-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2 relative group">
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

            <div className="space-y-2 relative group">
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

        <div className="pt-1">
          <button
            type="submit"
            disabled={saving || !isValid}
            className="px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? t("buttons.saving") : t("buttons.saveChanges")}
          </button>
        </div>
      </form>
    </div>
  );
}
