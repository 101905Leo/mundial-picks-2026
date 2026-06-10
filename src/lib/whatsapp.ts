import { prisma } from "@/lib/prisma";

function whatsappConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || "v24.0",
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "",
    notifyOnlyPhone: process.env.WHATSAPP_NOTIFY_ONLY_PHONE || "",
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || "mundial_picks_aviso",
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es_CO",
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
  return sendWhatsAppTemplate(to, "Mundial Picks", body);
}

export async function notifyWhatsAppUsers(body: string) {
  const config = whatsappConfig();
  const recipients = config.notifyOnlyPhone
    ? [{ phone: config.notifyOnlyPhone, name: "Mundial Picks" }]
    : (
        await prisma.user.findMany({
          where: { isActive: true },
          select: { phone: true, name: true },
        })
      ).map((user) => ({ phone: user.phone, name: user.name }));

  await Promise.allSettled(
    recipients.map((recipient) => sendWhatsAppTemplate(recipient.phone, recipient.name, body)),
  );
}

async function sendWhatsAppTemplate(to: string, name: string, body: string) {
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
        type: "template",
        template: {
          name: config.templateName,
          language: {
            code: config.templateLanguage,
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: name || "Jugador",
                },
                {
                  type: "text",
                  text: body,
                },
              ],
            },
          ],
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
