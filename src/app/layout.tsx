import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.mundialpicks.online"),
  title: "Mundial Picks Arena | Donde tus predicciones compiten",
  description: "Donde tus predicciones compiten. Crea tu arena, invita a tu grupo y sigue el ranking.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Mundial Picks Arena | Donde tus predicciones compiten",
    description: "Donde tus predicciones compiten. Crea tu arena, invita a tu grupo y sigue el ranking.",
    url: "https://www.mundialpicks.online",
    siteName: "Mundial Picks Arena",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mundial Picks Arena | Donde tus predicciones compiten",
    description: "Donde tus predicciones compiten. Crea tu arena, invita a tu grupo y sigue el ranking.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MP Arena",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0d12",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
