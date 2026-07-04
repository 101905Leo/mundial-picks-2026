import { existsSync, readFileSync } from "node:fs";

const requiredVariables = [
  "CRON_SECRET",
  "FOOTBALL_DATA_API_KEY",
  "FOOTBALL_DATA_COMPETITION_CODE",
  "API_FOOTBALL_KEY",
  "API_FOOTBALL_LEAGUE_ID",
  "API_FOOTBALL_SEASON",
] as const;

const envFiles = [".env.production.local", ".env.local", ".env", ".env.example"] as const;

type VariableName = (typeof requiredVariables)[number];
type EnvMap = Partial<Record<VariableName, string>>;

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.replace(/^["']|["']$/g, "").trim();
}

function parseEnvFile(path: string): EnvMap {
  if (!existsSync(path)) return {};

  const values: EnvMap = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (!requiredVariables.includes(key as VariableName)) continue;
    values[key as VariableName] = normalizeEnvValue(rawValue);
  }

  return values;
}

function maskStatus(value: string | undefined) {
  const normalized = normalizeEnvValue(value);
  return {
    present: value !== undefined,
    normalizedLength: normalized.length,
    empty: normalized.length === 0,
  };
}

function providerStatus(source: EnvMap) {
  const footballDataKey = normalizeEnvValue(source.FOOTBALL_DATA_API_KEY);
  const apiFootballKey = normalizeEnvValue(source.API_FOOTBALL_KEY);
  const footballDataCompetitionCode = normalizeEnvValue(source.FOOTBALL_DATA_COMPETITION_CODE) || "WC";
  const apiFootballLeagueId = normalizeEnvValue(source.API_FOOTBALL_LEAGUE_ID) || "1";
  const apiFootballSeason = normalizeEnvValue(source.API_FOOTBALL_SEASON) || "2026";

  return {
    footballDataCanRun: footballDataKey.length > 0,
    footballDataCompetitionCode,
    apiFootballCanRun: apiFootballKey.length > 0,
    apiFootballLeagueId,
    apiFootballSeason,
    anyProviderCanRun: footballDataKey.length > 0 || apiFootballKey.length > 0,
  };
}

function cronStatus(source: EnvMap) {
  const cronSecret = normalizeEnvValue(source.CRON_SECRET);
  return {
    manualTriggerCanAuthenticate: cronSecret.length > 0,
    externalCronNeedsSecret: true,
    expectedAuth:
      cronSecret.length > 0
        ? "Enviar ?secret=<CRON_SECRET> o Authorization: Bearer <CRON_SECRET>."
        : "Configurar CRON_SECRET real antes de usar proveedor externo o disparo manual.",
  };
}

function rowForFile(file: string, values: EnvMap, existsOverride?: boolean) {
  const providers = providerStatus(values);
  const cron = cronStatus(values);
  const exists = existsOverride ?? existsSync(file);
  const usableForRuntime = file !== ".env.example";

  return {
    archivo: file,
    existe: exists,
    usableParaRuntime: usableForRuntime,
    cronSecretLength: maskStatus(values.CRON_SECRET).normalizedLength,
    footballDataKeyLength: maskStatus(values.FOOTBALL_DATA_API_KEY).normalizedLength,
    footballDataCompetitionCode: providers.footballDataCompetitionCode,
    apiFootballKeyLength: maskStatus(values.API_FOOTBALL_KEY).normalizedLength,
    apiFootballLeagueId: providers.apiFootballLeagueId,
    apiFootballSeason: providers.apiFootballSeason,
    cronManualOK: usableForRuntime && cron.manualTriggerCanAuthenticate,
    footballDataOK: usableForRuntime && providers.footballDataCanRun,
    apiFootballOK: usableForRuntime && providers.apiFootballCanRun,
    algunProveedorOK: usableForRuntime && providers.anyProviderCanRun,
  };
}

const processValues: EnvMap = {};
for (const variable of requiredVariables) {
  if (process.env[variable] !== undefined) {
    processValues[variable] = normalizeEnvValue(process.env[variable]);
  }
}

const fileValues = envFiles.map((file) => ({
  file,
  values: parseEnvFile(file),
}));

console.log("Auditoria de variables para resultados automaticos");
console.log("No se imprimen secretos; solo presencia y longitud normalizada.\n");

console.log("Proceso actual:");
console.table([rowForFile("process.env", processValues, true)]);

console.log("\nArchivos locales:");
console.table(fileValues.map(({ file, values }) => rowForFile(file, values)));

console.log("\nDiagnostico por archivo:");
for (const { file, values } of fileValues) {
  const providers = providerStatus(values);
  const cron = cronStatus(values);
  const issues: string[] = [];

  if (!existsSync(file)) {
    issues.push("archivo no existe");
  }
  if (!cron.manualTriggerCanAuthenticate) {
    issues.push("CRON_SECRET vacio: disparo manual/proveedor externo no puede autenticar");
  }
  if (!providers.anyProviderCanRun) {
    issues.push("sin FOOTBALL_DATA_API_KEY ni API_FOOTBALL_KEY: no hay proveedor de resultados activo");
  }

  console.log(
    `- ${file}: ${issues.length ? issues.join("; ") : "configuracion minima suficiente para cron + proveedor."}`,
  );
}

const runtimeProviders = providerStatus(processValues);
const runtimeCron = cronStatus(processValues);

console.log("\nResumen runtime actual:");
console.table([
  {
    cronPuedeAutenticarManual: runtimeCron.manualTriggerCanAuthenticate,
    footballDataPuedeActualizar: runtimeProviders.footballDataCanRun,
    apiFootballPuedeActualizar: runtimeProviders.apiFootballCanRun,
    algunProveedorPuedeActualizar: runtimeProviders.anyProviderCanRun,
  },
]);

console.log("\nChecklist minimo Vercel/cron externo:");
console.log("1. Configurar CRON_SECRET real y no vacio en Vercel Production.");
console.log("2. Usar el mismo CRON_SECRET en el proveedor externo: ?secret=... o Authorization: Bearer ...");
console.log("3. Configurar al menos un proveedor: FOOTBALL_DATA_API_KEY o API_FOOTBALL_KEY.");
console.log("4. Para football-data.org, dejar FOOTBALL_DATA_COMPETITION_CODE=WC si es Mundial.");
console.log("5. Para API-Football, confirmar API_FOOTBALL_LEAGUE_ID y API_FOOTBALL_SEASON=2026.");
console.log("6. Ejecutar el endpoint con force=1 solo para disparo manual controlado.");
