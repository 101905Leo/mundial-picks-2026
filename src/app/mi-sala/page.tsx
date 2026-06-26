import { MundialPicksApp } from "@/components/mundial-picks-app";

type PageProps = {
  searchParams?: Promise<{
    mode?: string | string[];
    phone?: string | string[];
    inviteCode?: string | string[];
    code?: string | string[];
    roomCode?: string | string[];
  }>;
};

function readParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeInviteCode(value = "") {
  return value.trim().toUpperCase();
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode = readParam(params?.mode);
  const phone = readParam(params?.phone);
  const inviteCode = normalizeInviteCode(
    readParam(params?.inviteCode) ?? readParam(params?.code) ?? readParam(params?.roomCode) ?? "",
  );
  const initialMode = inviteCode && mode !== "login" ? "register" : mode === "register" ? "register" : "login";

  return <MundialPicksApp initialMode={initialMode} initialPhone={phone ?? ""} initialInviteCode={inviteCode} />;
}
