import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma"; // your prisma instance
import { sendInvitationEmail } from "@/lib/email/send-invitation-email";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { invitationId, language = "en" } = req.body;

    // Get invitation with related data
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        company: true,
        inviter: true,
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    // Send the email
    await sendInvitationEmail({
      to: invitation.email,
      invitationToken: invitation.token,
      companyName: invitation.company.name,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      inviterName: `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
      language,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error sending invitation:", error);
    res.status(500).json({ error: "Failed to send invitation" });
  }
}
