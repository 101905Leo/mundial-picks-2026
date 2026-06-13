export type RoomPlanCatalogItem = {
  slug: string;
  name: string;
  participantLimit: number | null;
  durationDays: number;
  priceCop: number | null;
  benefits: string[];
};

export const roomPlanCatalog: RoomPlanCatalogItem[] = [
  {
    slug: "sala-basica",
    name: "Sala Básica",
    participantLimit: 20,
    durationDays: 365,
    priceCop: 40000,
    benefits: ["Código privado", "Ranking de la sala", "Chat del grupo", "Panel del dueño"],
  },
  {
    slug: "sala-pro",
    name: "Sala Pro",
    participantLimit: 50,
    durationDays: 365,
    priceCop: 80000,
    benefits: ["Todo lo de Básica", "Hasta 50 participantes", "Estadísticas del grupo", "Administradores adicionales"],
  },
  {
    slug: "sala-premium",
    name: "Sala Premium",
    participantLimit: 100,
    durationDays: 365,
    priceCop: 120000,
    benefits: ["Todo lo de Pro", "Hasta 100 participantes", "Panel avanzado", "Soporte prioritario"],
  },
  {
    slug: "sala-empresarial",
    name: "Sala Empresarial",
    participantLimit: null,
    durationDays: 365,
    priceCop: null,
    benefits: ["Cupo personalizado", "Configuración a medida", "Atención comercial", "Soporte prioritario"],
  },
];

export function salesWhatsAppUrl(planName: string) {
  const phone = (process.env.NEXT_PUBLIC_SALES_WHATSAPP || "573008588571").replace(/\D/g, "");
  const message = `Hola, quiero alquilar una sala privada en Mundial Picks. Me interesa el plan ${planName}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
