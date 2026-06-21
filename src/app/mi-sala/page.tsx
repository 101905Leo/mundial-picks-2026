import { MundialPicksApp } from "@/components/mundial-picks-app";

type PageProps = {
  searchParams?: Promise<{
    phone?: string | string[];
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const phone = Array.isArray(params?.phone) ? params.phone[0] : params?.phone;

  return <MundialPicksApp initialPhone={phone ?? ""} />;
}
