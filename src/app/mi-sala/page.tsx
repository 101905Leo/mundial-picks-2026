import { MundialPicksApp } from "@/components/mundial-picks-app";

type PageProps = {
  searchParams?: Promise<{
    mode?: string | string[];
    phone?: string | string[];
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode = Array.isArray(params?.mode) ? params.mode[0] : params?.mode;
  const phone = Array.isArray(params?.phone) ? params.phone[0] : params?.phone;

  return <MundialPicksApp initialMode={mode === "register" ? "register" : "login"} initialPhone={phone ?? ""} />;
}
