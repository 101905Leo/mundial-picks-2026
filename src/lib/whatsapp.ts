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

function timeoutSignal(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  };
}

function safeErrorMessage(details: string) {
  try {
    const parsed = JSON.parse(details) as { error?: { message?: string; code?: number; error_data?: { details?: string } } };
    if (parsed.error?.code === 190) {
      return "El token de Meta vencio, fue revocado o pertenece a otra app. Genera uno nuevo y actualiza WHATSAPP_ACCESS_TOKEN en Vercel. (#190)";
    }

    const message = parsed.error?.error_data?.details || parsed.error?.message;
    const code = parsed.error?.code ? ` (#${parsed.error.code})` : "";

    if (message) return `${message}${code}`;
  } catch {
    // Fall back to the raw response below.
  }

  return details.slice(0, 280);
}

export async function sendWhatsAppMessage(to: string, body: string) {
  return sendWhatsAppTemplate(to, "Mundial Picks", body);
}

export async function notifyWhatsAppUsers(body: string) {
  try {
    const config = whatsappConfig();
    const recipients = config.notifyOnlyPhone
      ? [{ phone: config.notifyOnlyPhone, name: "Mundial Picks" }]
      : (
          await prisma.user.findMany({
            where: {
              OR: [
                { isActive: true },
                { leagues: { some: {} } },
              ],
            },
            select: { phone: true, name: true },
          })
        ).map((user) => ({ phone: user.phone, name: user.name }));

    const results = await Promise.allSettled(
      recipients.map((recipient) => sendWhatsAppTemplate(recipient.phone, recipient.name, body)),
    );

    const sent = results.filter((result) => result.status === "fulfilled" && result.value.ok).length;
    const skipped = results.filter((result) => result.status === "fulfilled" && result.value.skipped).length;
    const errors = results
      .map((result) => (result.status === "fulfilled" ? result.value.error : "No se pudo enviar el mensaje"))
      .filter(Boolean);

    return {
      attempted: recipients.length,
      sent,
      skipped,
      failed: recipients.length - sent - skipped,
      errors,
    };
  } catch (error) {
    console.error("WhatsApp notification skipped", error);
    return {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 1,
      errors: ["No se pudo preparar la notificacion de WhatsApp"],
    };
  }
}

async function sendWhatsAppTemplate(to: string, name: string, body: string) {
  const config = whatsappConfig();
  const recipient = normalizePhone(to);

  if (!config.accessToken || !config.phoneNumberId || !recipient) {
    return {
      skipped: true,
      error: !recipient
        ? "No hay numero de WhatsApp para enviar la prueba"
        : "Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID en Vercel",
    };
  }

  const timeout = timeoutSignal(8000);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        signal: timeout.signal,
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
      return { skipped: false, ok: false, error: safeErrorMessage(details) };
    }

    return { skipped: false, ok: true };
  } catch (error) {
    console.error("WhatsApp notification failed", error);
    return { skipped: false, ok: false, error: "Meta no respondio a tiempo o rechazo la conexion" };
  } finally {
    timeout.cleanup();
  }
}
