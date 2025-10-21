//vercel/lib/email/send-invitation-email.ts
import nodemailer, { SentMessageInfo } from "nodemailer";
import fs from "fs";
import path from "path";


const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  });
};


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
    "invitation-email.json"
  );
  const fileContent = fs.readFileSync(translationsPath, "utf-8");
  return JSON.parse(fileContent);
}


interface SendInvitationEmailParams {
  to: string;
  invitationToken: string;
  companyName: string;
  role: string;
  expiresAt: string;
  inviterName: string;
  language: "en" | "el";
}


export async function sendInvitationEmail({
  to,
  invitationToken,
  companyName,
  role,
  expiresAt,
  inviterName,
  language,
}: SendInvitationEmailParams) {
  const translations = loadTranslations(language);
  const transporter = createTransporter();


  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const invitationLink = `${baseUrl}/${language}/accept-invitation?token=${invitationToken}`;


  const expirationDate = new Date(expiresAt);
  const locale = language === "el" ? "el-GR" : "en-US";
  const expirationString = expirationDate.toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });


  const roleTranslations: Record<string, Record<string, string>> = {
    en: {
      talent: "Talent",
      supervisor: "Supervisor",
      company_admin: "Company Admin",
      superadmin: "Super Admin",
    },
    el: {
      talent: "Ταλέντο",
      supervisor: "Επόπτης",
      company_admin: "Διαχειριστής Εταιρείας",
      superadmin: "Υπερδιαχειριστής",
    },
  };


  const translatedRole = roleTranslations[language][role] || role;
  const vars = {
    companyName,
    inviterName,
    role: translatedRole,
    expirationDate: expirationString,
    email: to,
  };
  const t = (key: string) =>
    replaceTemplateVars(translations[key] || key, vars);


  const htmlContent = `
<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .button { display: inline-block; background: #007bff; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px 30px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; }
        .security-note { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${t("headerTitle")}</h1>
            <p>${t("headerSubtitle")}</p>
        </div>
        <div class="content">
            <p>${t("greeting")}</p>
            <p>${t("invitedBy")}</p>
            <p>${t("clickButton")}</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationLink}" class="button">${t(
    "buttonText"
  )}</a>
            </div>
            <div class="security-note">
                <strong>${t("securityTitle")}</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>${t("securityExpires")}</li>
                    <li>${t("securityOneTime")}</li>
                    <li>${t("securityIgnore")}</li>
                </ul>
            </div>
            <p>${t("afterClicking")}</p>
            <ul>
                <li>${t("feature1")}</li>
                <li>${t("feature2")}</li>
                <li>${t("feature3")}</li>
                <li>${t("feature4")}</li>
            </ul>
            <p>${t("linkNotWorking")}</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">${invitationLink}</p>
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
  )}\n\n${invitationLink}\n\n${t("securityTitle")}\n- ${t(
    "securityExpires"
  )}\n- ${t("securityOneTime")}\n- ${t("securityIgnore")}\n\n${t(
    "afterClicking"
  )}\n- ${t("feature1")}\n- ${t("feature2")}\n- ${t("feature3")}\n- ${t(
    "feature4"
  )}`;


  await transporter.sendMail({
    from: {
      name: process.env.GMAIL_FROM_NAME || companyName,
      address: process.env.GMAIL_USER!,
    },
    to,
    subject: t("subject"),
    text: textContent,
    html: htmlContent,
  });
} 