// lib/sms/job-invitation.ts

export interface SendJobInvitationSMSParams {
  to: string;
  jobPosition: string;
  companyName: string;
  shiftCount: number;
  startDate: string; // ISO format
  endDate: string; // ISO format
  language: "en" | "el";
}

function formatDate(isoDate: string, language: "en" | "el"): string {
  const date = new Date(isoDate);
  const locale = language === "el" ? "el-GR" : "en-US";

  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

function buildSMSMessage({
  jobPosition,
  companyName,
  shiftCount,
  startDate,
  endDate,
  language,
}: Omit<SendJobInvitationSMSParams, "to">): string {
  const formattedStart = formatDate(startDate, language);
  const formattedEnd = formatDate(endDate, language);

  if (language === "el") {
    const shiftsText = shiftCount === 1 ? "1 βάρδια" : `${shiftCount} βάρδιες`;
    return `Νέα πρόσκληση: ${jobPosition} στην ${companyName}. ${shiftsText}, ${formattedStart} - ${formattedEnd}. Μπες στο Hype Hire να απαντήσεις!`;
  } else {
    const shiftsText = shiftCount === 1 ? "1 shift" : `${shiftCount} shifts`;
    return `New job: ${jobPosition} at ${companyName}. ${shiftsText}, ${formattedStart} - ${formattedEnd}. Check Hype Hire to respond!`;
  }
}

export async function sendJobInvitationSMS({
  to,
  jobPosition,
  companyName,
  shiftCount,
  startDate,
  endDate,
  language,
}: SendJobInvitationSMSParams): Promise<{ success: boolean; error?: string }> {
  try {
    const message = buildSMSMessage({
      jobPosition,
      companyName,
      shiftCount,
      startDate,
      endDate,
      language,
    });

    const url = process.env.SMS_GATEWAY_URL;
    const token = process.env.SMS_GATEWAY_TOKEN;

    if (!url || !token) {
      throw new Error(
        "SMS gateway not configured (SMS_GATEWAY_URL / SMS_GATEWAY_TOKEN)"
      );
    }

    console.log(`📱 Sending SMS to ${to}...`);
    console.log(`📱 Message: ${message}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ to, message }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SMS gateway error: ${response.status} - ${text}`);
    }

    console.log(`✅ SMS sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error("❌ SMS sending failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
