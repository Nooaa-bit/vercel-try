"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProfilePictureCrop from "@/components/ProfilePictureCrop";

interface SettingsFormProps {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    profilePictureUrl: string | null;
  };
}

export default function SettingsForm({ user }: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);

  const handleImageSelected = (file: File) => {
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadResponse = await fetch("/api/upload-profile-picture", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          alert("Failed to upload profile picture");
          setSaving(false);
          return;
        }
      }

      const updateResponse = await fetch("/api/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
        }),
      });

      if (updateResponse.ok) {
        setSelectedFile(null); 
        router.refresh();
      } else {
        alert("Failed to update profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("An error occurred");
    }

    setSaving(false);
  };

  return (
    <div className="bg-card rounded-2xl shadow-elegant border border-border p-8">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="pb-6 border-b border-border">
          <ProfilePictureCrop
            currentImageUrl={user.profilePictureUrl}
            onImageSelected={handleImageSelected}
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-primary font-semibold">
              New photo selected. Click Save Changes to upload.
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
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                placeholder="Enter first name"
              />
            </div>
            <div className="space-y-3">
              <label
                htmlFor="lastName"
                className="block text-sm font-semibold text-foreground"
              >
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-foreground"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={user.email}
                disabled
                className="w-full px-4 py-3 bg-muted border border-input rounded-xl text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="space-y-3">
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-foreground"
              >
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="(555) 123-4567"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label
                htmlFor="dateOfBirth"
                className="block text-sm font-semibold text-foreground"
              >
                Date of Birth
              </label>
              <input
                type="date"
                id="dateOfBirth"
                name="dateOfBirth"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              />
            </div>
            <div className="space-y-3">
              <label
                htmlFor="emergencyContact"
                className="block text-sm font-semibold text-foreground"
              >
                Emergency Contact
              </label>
              <input
                type="tel"
                id="emergencyContact"
                name="emergencyContact"
                placeholder="(555) 987-6543"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
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
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
