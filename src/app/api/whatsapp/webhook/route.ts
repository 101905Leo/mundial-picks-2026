import { NextRequest } from "next/server";

type WebhookRecord = Record<string, unknown>;

function asRecord(value: unknown): WebhookRecord | null {
  return typeof value === "object" && value !== null ? (value as WebhookRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as unknown;
  const root = asRecord(payload);

  const statusEvents: WebhookRecord[] = [];
  const incomingMessages: WebhookRecord[] = [];

  for (const entry of asArray(root?.entry)) {
    const entryRecord = asRecord(entry);

    for (const change of asArray(entryRecord?.changes)) {
      const changeRecord = asRecord(change);
      const value = asRecord(changeRecord?.value);

      if (!value) continue;

      for (const status of asArray(value.statuses)) {
        const statusRecord = asRecord(status);
        if (statusRecord) statusEvents.push(statusRecord);
      }

      for (const message of asArray(value.messages)) {
        const messageRecord = asRecord(message);
        if (messageRecord) incomingMessages.push(messageRecord);
      }
    }
  }

  if (statusEvents.length > 0) {
    console.log(
      "WhatsApp status webhook",
      JSON.stringify(
        statusEvents.map((status) => ({
          id: status.id,
          status: status.status,
          timestamp: status.timestamp,
          recipientId: status.recipient_id,
          errors: status.errors,
        })),
      ),
    );
  }

  if (incomingMessages.length > 0) {
    console.log(
      "WhatsApp incoming message webhook",
      JSON.stringify(
        incomingMessages.map((message) => ({
          id: message.id,
          from: message.from,
          type: message.type,
          timestamp: message.timestamp,
        })),
      ),
    );
  }

  return Response.json({
    received: true,
    statuses: statusEvents.length,
    messages: incomingMessages.length,
  });
}
