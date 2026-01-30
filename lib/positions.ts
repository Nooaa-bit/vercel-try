// lib/positions.ts

/**
 * Valid job positions for the staffing platform
 * These are translated in the jobs.json translation files
 */
export const VALID_POSITIONS = [
  "waiter",
  "runner",
  "chef",
  "commis_chef",
  "picker",
] as const;

export type JobPosition = (typeof VALID_POSITIONS)[number];

/**
 * Type guard to check if a string is a valid job position
 * @param position - The position string to validate
 * @returns True if the position is valid
 */
export function isValidPosition(position: string): position is JobPosition {
  return VALID_POSITIONS.includes(position as JobPosition);
}

/**
 * Get translation key for a position
 * @param position - The job position
 * @returns Translation key for use with i18n
 */
export function getPositionTranslationKey(position: JobPosition): string {
  return `positions.${position}`;
}
