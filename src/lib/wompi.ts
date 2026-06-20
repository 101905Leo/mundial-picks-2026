import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const currency = "COP";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function wompiApiBase() {
  return process.env.WOMPI_ENVIRONMENT === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function requiresWompiEventSecret() {
  return process.env.NODE_ENV === "production" || process.env.WOMPI_ENVIRONMENT === "production";
}

function assertMatchingAmount(receivedAmountInCents: number | undefined, expectedAmountInCents: number, label: string) {
  if (!Number.isFinite(receivedAmountInCents)) {
    throw new Error(`Wompi no entrego un monto valido para validar ${label}`);
  }

  if (receivedAmountInCents !== expectedAmountInCents) {
    throw new Error(`El monto recibido por Wompi no coincide con el monto esperado para ${label}`);
  }
}

export function entryFee() {
  const priceCop = envNumber("ENTRY_FEE_COP", 50000);
  return {
    priceCop,
    amountInCents: priceCop * 100,
  };
}

export function wompiCheckoutUrl(params: {
  publicKey: string;
  reference: string;
  amountInCents: number;
  signature: string;
  redirectUrl: string;
  customerName: string;
  customerPhone: string;
}) {
  const url = new URL("https://checkout.wompi.co/p/");
  url.searchParams.set("public-key", params.publicKey);
  url.searchParams.set("currency", currency);
  url.searchParams.set("amount-in-cents", String(params.amountInCents));
  url.searchParams.set("reference", params.reference);
  url.searchParams.set("signature:integrity", params.signature);
  url.searchParams.set("redirect-url", params.redirectUrl);
  url.searchParams.set("customer-data:full-name", params.customerName);
  url.searchParams.set("customer-data:phone-number", params.customerPhone.replace(/\D/g, ""));
  url.searchParams.set("customer-data:phone-number-prefix", "+57");
  return url.toString();
}

function wompiKeys() {
  const publicKey = process.env.WOMPI_PUBLIC_KEY;
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;

  if (!publicKey || !integritySecret) {
    throw new Error("Faltan WOMPI_PUBLIC_KEY o WOMPI_INTEGRITY_SECRET en .env");
  }

  return { publicKey, integritySecret };
}

export async function createWompiEntryCheckout(user: { id: string; name: string; phone: string }) {
  const { publicKey, integritySecret } = wompiKeys();

  const fee = entryFee();
  const reference = `entry_${user.id}_${Date.now()}`;
  const signature = sha256(`${reference}${fee.amountInCents}${currency}${integritySecret}`);

  await prisma.entryPayment.create({
    data: {
      userId: user.id,
      reference,
      amountInCents: fee.amountInCents,
    },
  });

  return {
    reference,
    priceCop: fee.priceCop,
    checkoutUrl: wompiCheckoutUrl({
      publicKey,
      reference,
      amountInCents: fee.amountInCents,
      signature,
      redirectUrl: `${appUrl()}/entry/success`,
      customerName: user.name,
      customerPhone: user.phone,
    }),
  };
}

export async function createWompiRoomCheckout(params: {
  leagueId: string;
  user: { name: string; phone: string };
  amountInCents: number;
  maxParticipants?: number;
}) {
  const { publicKey, integritySecret } = wompiKeys();
  const amountInCents = params.amountInCents;
  if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
    throw new Error("El plan de la sala no tiene un monto valido para Wompi");
  }

  const reference = `room_${params.leagueId}_${Date.now()}`;
  const signature = sha256(`${reference}${amountInCents}${currency}${integritySecret}`);

  await prisma.league.update({
    where: { id: params.leagueId },
    data: {
      paymentReference: reference,
      paymentStatus: "PENDING",
      paymentAmountInCents: amountInCents,
      paidAt: null,
      ...(typeof params.maxParticipants === "number" ? { maxParticipants: params.maxParticipants } : {}),
    },
  });

  return {
    reference,
    amountInCents,
    checkoutUrl: wompiCheckoutUrl({
      publicKey,
      reference,
      amountInCents,
      signature,
      redirectUrl: `${appUrl()}/entry/success`,
      customerName: params.user.name,
      customerPhone: params.user.phone,
    }),
  };
}

export async function getWompiTransaction(transactionId: string) {
  const privateKey = process.env.WOMPI_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Falta WOMPI_PRIVATE_KEY en .env");
  }

  const response = await fetch(`${wompiApiBase()}/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${privateKey}`,
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.messages?.join(", ") || "No se pudo consultar la transaccion en Wompi");
  }

  return payload.data as {
    id: string;
    reference: string;
    status: string;
    amount_in_cents: number;
  };
}

export async function approveEntryPayment(reference: string, transactionId?: string, amountInCents?: number) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.entryPayment.findUnique({
      where: { reference },
    });

    if (!payment) {
      throw new Error("Inscripcion no encontrada");
    }

    assertMatchingAmount(amountInCents, payment.amountInCents, "la inscripcion");

    if (payment.paidAt) {
      return payment;
    }

    const paidAt = new Date();
    const updatedPayment = await tx.entryPayment.update({
      where: { reference },
      data: {
        status: "APPROVED",
        transactionId: transactionId || payment.transactionId,
        paidAt,
      },
    });

    await tx.user.update({
      where: { id: payment.userId },
      data: {
        entryPaidAt: paidAt,
        isActive: true,
      },
    });

    return updatedPayment;
  });
}

export async function approveRoomPayment(reference: string, transactionId?: string, status = "APPROVED", amountInCents?: number) {
  const currentPayment = await prisma.league.findUnique({
    where: { paymentReference: reference },
    select: { paymentAmountInCents: true },
  });

  if (!currentPayment) {
    throw new Error("Pago de sala no encontrado");
  }

  if (status === "APPROVED") {
    assertMatchingAmount(amountInCents, currentPayment.paymentAmountInCents, "la sala");
  }

  const paidAt = status === "APPROVED" ? new Date() : null;

  return prisma.league.update({
    where: { paymentReference: reference },
    data: {
      paymentStatus: status,
      paidAt,
      paymentReference: reference,
    },
    select: {
      id: true,
      name: true,
      paidAt: true,
      paymentStatus: true,
      paymentAmountInCents: true,
    },
  });
}

export async function applyWompiPayment(
  reference: string,
  transactionId?: string,
  status = "APPROVED",
  amountInCents?: number,
) {
  if (reference.startsWith("room_")) {
    return {
      type: "room" as const,
      payment: await approveRoomPayment(reference, transactionId, status, amountInCents),
    };
  }

  if (status === "APPROVED") {
    return {
      type: "entry" as const,
      payment: await approveEntryPayment(reference, transactionId, amountInCents),
    };
  }

  await prisma.entryPayment.updateMany({
    where: { reference },
    data: { status, transactionId },
  });

  return { type: "entry" as const, payment: null };
}

function getByPath(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value) {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export function verifyWompiEvent(event: {
  data?: unknown;
  timestamp?: number;
  signature?: { properties?: string[]; checksum?: string };
}) {
  const secret = process.env.WOMPI_EVENTS_SECRET;

  if (!secret) return !requiresWompiEventSecret();
  if (!event.signature?.properties?.length || !event.signature.checksum || !event.timestamp) return false;

  const values = event.signature.properties.map((property) => String(getByPath(event.data, property) ?? "")).join("");
  const expected = sha256(`${values}${event.timestamp}${secret}`);
  return expected.toUpperCase() === event.signature.checksum.toUpperCase();
}
