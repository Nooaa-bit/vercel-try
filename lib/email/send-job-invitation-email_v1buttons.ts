import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";
import fs from "fs";
import path from "path";

// ============================================================
// BREVO EMAIL SENDER FOR JOB INVITATIONS
// ============================================================

function replaceTemplateVars(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

function loadTranslations(language: "en" | "el") {
  const translationsPath = path.join(
    process.cwd(),
    "translations",
    language,
    "job-invitation-email.json"
  );
  const fileContent = fs.readFileSync(translationsPath, "utf-8");
  return JSON.parse(fileContent);
}

interface SendJobInvitationEmailParams {
  to: string;
  invitationId: number;
  jobPosition: string;
  companyName: string;
  jobStartDate: string;
  jobEndDate: string;
  inviterName: string;
  expiresAt: string;
  language: "en" | "el";
}

export async function sendJobInvitationEmail({
  to,
  invitationId,
  jobPosition,
  companyName,
  jobStartDate,
  jobEndDate,
  inviterName,
  expiresAt,
  language,
}: SendJobInvitationEmailParams) {
  console.log("📧 Preparing job invitation email for:", to);

  const translations = loadTranslations(language);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const acceptLink = `${baseUrl}/${language}/jobs/invitations/${invitationId}/accept`;
  const declineLink = `${baseUrl}/${language}/jobs/invitations/${invitationId}/decline`;

  // Format dates
  const locale = language === "el" ? "el-GR" : "en-US";

  const startDateString = new Date(jobStartDate).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const endDateString = new Date(jobEndDate).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const expirationDate = new Date(expiresAt).toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const vars = {
    jobPosition,
    companyName,
    inviterName,
    jobStartDate: startDateString,
    jobEndDate: endDateString,
    expirationDate,
    email: to,
  };

  const t = (key: string) =>
    replaceTemplateVars(translations[key] || key, vars);

  // Build HTML content
  const htmlContent = `
<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .job-details { background: #fef2f2; border-left: 4px solid #b91c1c; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .job-details-item { margin: 10px 0; }
        .job-details-label { font-weight: 600; color: #7f1d1d; }
        .button-group { display: flex; gap: 15px; margin: 30px 0; justify-content: center; }
        .button { display: inline-block; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .button-accept { background: #16a34a; color: white !important; }
        .button-accept:hover { background: #15803d; }
        .button-decline { background: #e5e7eb; color: #374151 !important; }
        .button-decline:hover { background: #d1d5db; }
        .footer { background: #f8f9fa; padding: 20px 30px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
        .security-note { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px; padding: 15px; margin: 20px 0; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img 
                src="https://hypehire.me/logo-white.png" 
                alt="Company Logo"
                style="max-width: 150px; height: auto; display: block; margin: 0 auto 15px;"
            />
            <h2>${t("headerTitle")}</h2>
            <p>${t("headerSubtitle")}</p>
        </div>
        <div class="content">
            <p>${t("greeting")}</p>
            <p>${t("invitedBy")}</p>
            
            <div class="job-details">
                <div class="job-details-item">
                    <span class="job-details-label">${t(
                      "jobLabel"
                    )}:</span> ${jobPosition}
                </div>
                <div class="job-details-item">
                    <span class="job-details-label">${t(
                      "companyLabel"
                    )}:</span> ${companyName}
                </div>
                <div class="job-details-item">
                    <span class="job-details-label">${t(
                      "datesLabel"
                    )}:</span> ${startDateString} - ${endDateString}
                </div>
            </div>

            <p>${t("opportunityDescription")}</p>

            <div style="text-align: center;">
                <div class="button-group">
                    <a href="${acceptLink}" class="button button-accept">${t(
    "acceptButton"
  )}</a>
                    <a href="${declineLink}" class="button button-decline">${t(
    "declineButton"
  )}</a>
                </div>
            </div>

            <div class="security-note">
                <strong>${t("securityTitle")}</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>${t("securityExpires")}</li>
                    <li>${t("securityOneTime")}</li>
                    <li>${t("securityIgnore")}</li>
                </ul>
            </div>

            <p>${t("afterAccepting")}</p>
            <ul>
                <li>${t("feature1")}</li>
                <li>${t("feature2")}</li>
                <li>${t("feature3")}</li>
            </ul>

            <p>${t("linkNotWorking")}</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">Accept: ${acceptLink}</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">Decline: ${declineLink}</p>
        </div>
        <div class="footer">
            <p><strong>${t("footerTitle")}</strong></p>
            <p>${t("footerSentTo")}</p>
            <p style="font-size: 12px; margin-top: 15px;">${t(
              "footerQuestions"
            )}</p>
        </div>
    </div>
</body>
</html>`;

  const textContent = `${t("headerTitle")}\n\n${t("greeting")}\n\n${t(
    "invitedBy"
  )}\n\n${t("jobLabel")}: ${jobPosition}\n${t(
    "companyLabel"
  )}: ${companyName}\n${t(
    "datesLabel"
  )}: ${startDateString} - ${endDateString}\n\n${t(
    "opportunityDescription"
  )}\n\nAccept: ${acceptLink}\nDecline: ${declineLink}\n\n${t(
    "securityTitle"
  )}\n- ${t("securityExpires")}\n- ${t("securityOneTime")}\n- ${t(
    "securityIgnore"
  )}\n\n${t("afterAccepting")}\n- ${t("feature1")}\n- ${t("feature2")}\n- ${t(
    "feature3"
  )}`;

  try {
    const emailAPI = new TransactionalEmailsApi();
    emailAPI.setApiKey(0, process.env.BREVO_API_KEY!);

    const message = new SendSmtpEmail();
    message.subject = t("subject");
    message.htmlContent = htmlContent;
    message.textContent = textContent;
    message.sender = {
      name: "Hype Hire",
      email: process.env.BREVO_SENDER_EMAIL || "noreply@yourdomain.com",
    };
    message.to = [{ email: to }];

    console.log("📤 Sending job invitation email via Brevo...");

    const response = await emailAPI.sendTransacEmail(message);

    console.log("✅ Job invitation email sent successfully!");
    console.log("📧 Message ID:", response.body.messageId);

    return {
      success: true,
      messageId: response.body.messageId,
    };
  } catch (error) {
    console.error("❌ Brevo email sending failed:", error);
    throw new Error(
      `Failed to send email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
