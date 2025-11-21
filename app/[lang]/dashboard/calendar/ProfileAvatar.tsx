// app/[lang]/dashboard/calendar/ProfileAvatar.tsx
"use client";

import { getProfilePictureUrl, getUserInitials } from "./staffing-utils";

interface ProfileAvatarProps {
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePicture: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProfileAvatar({
  firstName,
  lastName,
  email,
  profilePicture,
  size = "sm",
  className = "",
}: ProfileAvatarProps) {
  const profilePictureUrl = getProfilePictureUrl(profilePicture);
  const initials = getUserInitials(firstName, lastName, email);

  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  if (profilePictureUrl) {
    return (
      <img
        src={profilePictureUrl}
        alt={`${firstName || email}'s profile`}
        className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
