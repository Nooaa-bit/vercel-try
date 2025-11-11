// lib/sms.ts
interface SMSJob {
  to: string;
  message: string;
  resolve: (value: SMSResponse) => void;
  reject: (reason?: unknown) => void;
}

interface SMSResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class QueuedSMS {
  private queue: SMSJob[] = [];
  private isProcessing = false;
  private intervalMs: number;

  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }

  enqueue(to: string, message: string): Promise<SMSResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ to, message, resolve, reject });
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift()!;

    try {
      const result = await this.sendSingleSMS(job.to, job.message);
      job.resolve(result);
    } catch (error) {
      job.reject(error);
    }

    setTimeout(() => this.processQueue(), this.intervalMs);
  }

  private async sendSingleSMS(
    to: string,
    message: string
  ): Promise<SMSResponse> {
    const url = process.env.SMS_GATEWAY_URL;
    const token = process.env.SMS_GATEWAY_TOKEN;

    if (!url || !token) {
      throw new Error("SMS gateway configuration missing");
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        to: to.trim(),
        message: message.trim(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(`✓ SMS sent to ${to}`);
    return {
      success: true,
      message: "SMS sent successfully",
    };
  }
}

export const smsQueue = new QueuedSMS(1000);

export async function sendSMS(
  to: string,
  message: string
): Promise<SMSResponse> {
  try {
    return await smsQueue.enqueue(to, message);
  } catch (error) {
    console.error("SMS error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
