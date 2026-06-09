import { prisma } from "@/lib/prisma";

function whatsappConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || "v24.0",
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "",
    notifyOnlyPhone: process.env.WHATSAPP_NOTIFY_ONLY_PHONE || "",
  };
}

function normalizePhone(phone: string) {
  const config = whatsappConfig();
  const digits = phone.replace(/\D/g, "");

  if (!digits) return "";
  if (phone.trim().startsWith("+")) return digits;
  if (config.defaultCountryCode && digits.length <= 10) {
    return `${config.defaultCountryCode}${digits}`;
  }

  return digits;
}

export async function sendWhatsAppMessage(to: string, body: string) {
  const config = whatsappConfig();
  const recipient = normalizePhone(to);

  if (!config.accessToken || !config.phoneNumberId || !recipient) {
    return { skipped: true };
  }

  const response = await fetch(
    `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: {
          preview_url: false,
          body,
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    console.error("WhatsApp notification failed", details);
    return { skipped: false, ok: false };
  }

  return { skipped: false, ok: true };
}

export async function notifyWhatsAppUsers(body: string) {
  const config = whatsappConfig();
  const phones = config.notifyOnlyPhone
    ? [config.notifyOnlyPhone]
    : (
        await prisma.user.findMany({
          select: { phone: true },
        })
      ).map((user) => user.phone);

  await Promise.allSettled(phones.map((phone) => sendWhatsAppMessage(phone, body)));
}
