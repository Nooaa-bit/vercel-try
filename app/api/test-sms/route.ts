// app/api/test-sms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";

export const maxDuration = 300; //max time your API function is allowed to run before Vercel kills it. 300sec = 5 minutes.​ Hobby plan: 10 seconds default
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipients, message } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Missing "recipients" array' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json({ error: 'Missing "message"' }, { status: 400 });
    }

    console.log(`Queuing ${recipients.length} SMS messages...`);

    const results = [];
    for (const to of recipients) {
      const result = await sendSMS(to, message);
      results.push(result);
    }

    const successes = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Sent ${successes} of ${recipients.length} SMS`,
      results,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
