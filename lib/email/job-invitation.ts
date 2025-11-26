// lib/email/job-invitation.ts
import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";
import fs from "fs";
import path from "path";

// ============================================
// BREVO EMAIL SENDER FOR JOB INVITATIONS
// ============================================

function replaceTemplateVars(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

function loadTranslations(language: "en" | "el"): Record<string, string> {
  const translationsPath = path.join(
    process.cwd(),
    "translations",
    language,
    "job-invitation-email.json"
  );
  const fileContent = fs.readFileSync(translationsPath, "utf-8");
  return JSON.parse(fileContent) as Record<string, string>;
}

export interface SendJobInvitationEmailParams {
  to: string;
  jobPosition: string;
  companyName: string;
  jobStartDate: string; // ISO
  jobEndDate: string; // ISO
  inviterName: string;
  language: "en" | "el";
}

export async function sendJobInvitationEmail({
  to,
  jobPosition,
  companyName,
  jobStartDate,
  jobEndDate,
  inviterName,
  language,
}: SendJobInvitationEmailParams) {
  console.log("📧 Preparing job invitation email for:", to);

  const translations = loadTranslations(language);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const dashboardLink = `${baseUrl}/${language}/dashboard`;

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

  const vars = {
    jobPosition,
    companyName,
    inviterName,
    jobStartDate: startDateString,
    jobEndDate: endDateString,
    email: to,
    dashboardUrl: dashboardLink,
  };

  const t = (key: string) =>
    replaceTemplateVars(translations[key] || key, vars);

  const htmlContent = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111827; margin: 0; padding: 0; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.12); }
    .header { background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); color: white; padding: 28px 24px; text-align: left; }
    .content { padding: 24px; }
    .job-details { background: #fef2f2; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #fecaca; }
    .job-details-item { margin: 8px 0; font-size: 14px; }
    .job-details-label { font-weight: 600; color: #7f1d1d; margin-right: 4px; }
    .link-box { background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; word-wrap: break-word; overflow-wrap: break-word;  }
    .button-container { text-align: center; margin: 20px 0; }
    .dashboard-button { display: inline-block; background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(185, 28, 28, 0.3); }
    .cta { font-weight: 600; margin-top: 16px; }
    .footer { background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://hypehire.me/logo-white.png" alt="Hype Hire" style="max-width: 140px; height: auto; display: block; margin: 0 auto 12px;" />
      <h2 style="margin: 0; font-size: 22px; text-align: center;">${t(
        "headerTitle"
      )}</h2>
      <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9; text-align: center;">${t(
        "headerSubtitle"
      )}</p>
    </div>

    <div class="content">
      <p>${t("greeting")}</p>
      <p>${t("invitedBy")}</p>

      <div class="job-details">
        <div class="job-details-item">
          <span class="job-details-label">${t("jobLabel")}:</span>
          <span>${jobPosition}</span>
        </div>
        <div class="job-details-item">
          <span class="job-details-label">${t("companyLabel")}:</span>
          <span>${companyName}</span>
        </div>
        <div class="job-details-item">
          <span class="job-details-label">${t("datesLabel")}:</span>
          <span>${startDateString} – ${endDateString}</span>
        </div>
      </div>

      <p>${t("opportunityDescription")}</p>
      <p class="cta">${t("firstComeFirstServed")}</p>

      <div class="link-box">
        <strong>${t("loginLinkLabel")}</strong><br />
        <div class="button-container">
          <a href="${dashboardLink}" class="dashboard-button">Dashboard</a>
        </div>
      </div>

      <p>${t("linkNotWorking")}</p>
      <p class="link-box">${dashboardLink}</p>
    </div>
    <div class="footer">
      <p><strong>${t("footerTitle")}</strong></p>
      <p>${t("footerSentTo")}</p>
      <p style="margin-top: 12px;">${t("footerQuestions")}</p>
    </div>
  </div>
</body>
</html>`;

  const textContent = `${t("headerTitle")}

${t("greeting")}
${t("invitedBy")}

${t("jobLabel")}: ${jobPosition}
${t("companyLabel")}: ${companyName}
${t("datesLabel")}: ${startDateString} - ${endDateString}

${t("opportunityDescription")}
${t("firstComeFirstServed")}

${t("loginLinkLabel")}
${dashboardLink}

${t("footerTitle")}
${t("footerSentTo")}
${t("footerQuestions")}
`;

  try {
    const emailAPI = new TransactionalEmailsApi();
    emailAPI.setApiKey(0, process.env.BREVO_API_KEY!);

    const message = new SendSmtpEmail();
    message.subject = t("subject");
    message.htmlContent = htmlContent;
    message.textContent = textContent;
    message.sender = {
      name: "Hype Hire",
      email: process.env.BREVO_SENDER_EMAIL || "noreply@hypehire.me",
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
