//hype-hire/vercel/lib/email/send-forgot-password.ts
import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";

// ============================================================
// BREVO FORGOT PASSWORD EMAIL SENDER
// ============================================================

interface SendForgotPasswordEmailParams {
  to: string;
  resetLink: string;
  companyName?: string;
  expiresAt: string;
  language?: string;
}

export async function sendForgotPasswordEmail({
  to,
  resetLink,
  companyName = "Your Company",
  expiresAt,
  language = "en",
}: SendForgotPasswordEmailParams) {
  console.log("📧 Preparing to send forgot password email to:", to);
  console.log("🌐 Language:", language);
  console.log("🏢 Company Name received:", companyName);

  // Translation dictionary for email content
  const translations = {
    en: {
      title: "Reset Your Password",
      greeting: "Hello!",
      mainMessage:
        "We received a request to reset the password for your <strong>Hype Hire</strong> account. Click the button below to set a new password:",
      buttonText: "Reset Password",
      securityTitle: "Security Information:",
      expiresOn: "This reset link expires on",
      singleUse: "The link can only be used once",
      didntRequest:
        "If you didn't request this, you can safely ignore this email",
      buttonNotWork:
        "If the button doesn't work, you can copy and paste this link into your browser:",
      footerCompany: "<strong>Hype Hire</strong> - Secure Password Reset",
      footerSentTo: "This email was sent to",
      footerReason: "because you requested a password reset.",
      footerContact:
        "If you have any questions, please contact your administrator.",
      subjectLine: "🔐 Reset Your Password",
      subtitle: "Secure password reset for your account",
    },
    el: {
      title: "Επαναφορά του Κωδικού Σας",
      greeting: "Γεία σας!",
      mainMessage:
        "Λάβαμε ένα αίτημα επαναφοράς του κωδικού πρόσβασης για τον λογαριασμό σας στο <strong>Hype Hire</strong>. Κάντε κλικ στο κουμπί παρακάτω για να ορίσετε έναν νέο κωδικό:",
      buttonText: "Επαναφορά Κωδικού",
      securityTitle: "Πληροφορίες Ασφαλείας:",
      expiresOn: "Ο σύνδεσμος επαναφοράς λήγει στις",
      singleUse: "Ο σύνδεσμος μπορεί να χρησιμοποιηθεί μόνο μία φορά",
      didntRequest:
        "Αν δεν ζητήσατε αυτό, μπορείτε να αγνοήσετε με ασφάλεια αυτό το email",
      buttonNotWork:
        "Αν το κουμπί δεν λειτουργεί, μπορείτε να αντιγράψετε και να επικολλήσετε αυτόν τον σύνδεσμο στον browser σας:",
      footerCompany: "<strong>Hype Hire</strong> - Ασφαλής Επαναφορά Κωδικού",
      footerSentTo: "Αυτό το email στάλθηκε στο",
      footerReason: "επειδή ζητήσατε επαναφορά κωδικού.",
      footerContact:
        "Αν έχετε ερωτήσεις, επικοινωνήστε με τον διαχειριστή σας.",
      subjectLine: "🔐 Επαναφορά του Κωδικού Σας",
      subtitle: "Ασφαλής επαναφορά κωδικού για τον λογαριασμό σας",
    },
  };

  // Select the correct language (fallback to English)
  const t =
    translations[language as keyof typeof translations] || translations.en;

  // Calculate expiration time for user-friendly display
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

  // Professional HTML email template
  const htmlContent = `
<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.title}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f0ebe8;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #9b2c2c 0%, #7a2323 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .content { 
            padding: 30px; 
        }
        .button { 
            display: inline-block;
            background: #9b2c2c; 
            color: white !important; 
            padding: 14px 32px; 
            text-decoration: none; 
            border-radius: 6px;
            font-weight: 600;
            margin: 25px 0;
            font-size: 16px;
        }
        .footer {
            background: #f5e8d2;
            padding: 20px 30px;
            border-top: 1px solid #9b2c2c;
            font-size: 14px;
            color: #5a1a1a;
        }
        .security-note {
            background: #f5e8d2;
            border: 1px solid #9b2c2c;
            border-radius: 4px;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
        }
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
            <h1>🔐 ${t.title}</h1>
            <p>${t.subtitle}</p>
        </div>
        
        <div class="content">
            <p>${t.greeting}</p>
            
            <p>${t.mainMessage}</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" class="button">${t.buttonText}</a>
            </div>
            
            <div class="security-note">
                <strong>🔒 ${t.securityTitle}</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>${t.expiresOn} <strong>${expirationString}</strong></li>
                    <li>${t.singleUse}</li>
                    <li>${t.didntRequest}</li>
                </ul>
            </div>
            
            <p>${t.buttonNotWork}</p>
            <p style="word-break: break-all; background: #f0ebe8; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
                ${resetLink}
            </p>
        </div>
        
        <div class="footer">
            <p>${t.footerCompany}</p>
            <p>${t.footerSentTo} ${to} ${t.footerReason}</p>
            <p style="font-size: 12px; margin-top: 15px;">
                ${t.footerContact}
            </p>
        </div>
    </div>
</body>
</html>
  `;

  // Plain text version
  const textContent = `
${t.title}


${t.greeting}


${t.mainMessage.replace(/<[^>]*>/g, "")}


${t.buttonText}: ${resetLink}


${t.securityTitle}
- ${t.expiresOn} ${expirationString}
- ${t.singleUse}
- ${t.didntRequest}


---
${t.footerCompany.replace(/<[^>]*>/g, "")}
${t.footerSentTo} ${to} ${t.footerReason}
  `;

  try {
    // ✅ Initialize Brevo API
    const emailAPI = new TransactionalEmailsApi();
    emailAPI.setApiKey(0, process.env.BREVO_API_KEY!);

    // ✅ Build the message
    const message = new SendSmtpEmail();
    message.subject = t.subjectLine;
    message.htmlContent = htmlContent;
    message.textContent = textContent;
    message.sender = {
      name: companyName,
      email: process.env.BREVO_SENDER_EMAIL || "noreply@yourdomain.com",
    };
    message.to = [{ email: to }];

    console.log("📤 Sending forgot password email via Brevo...");

    // ✅ Send the email
    const response = await emailAPI.sendTransacEmail(message);

    console.log("✅ Forgot password email sent successfully!");
    console.log("📧 Message ID:", response.body.messageId);

    return {
      success: true,
      messageId: response.body.messageId,
    };
  } catch (error) {
    console.error("❌ Brevo forgot password email sending failed:", error);
    throw new Error(
      `Failed to send forgot password email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
