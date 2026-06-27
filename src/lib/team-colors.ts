import type { CSSProperties } from "react";

type TeamAccent = {
  primary: string;
  primaryRgb: string;
  secondary: string;
  secondaryRgb: string;
};

const DEFAULT_ACCENT: TeamAccent = {
  primary: "#38bdf8",
  primaryRgb: "56, 189, 248",
  secondary: "#f4bd4f",
  secondaryRgb: "244, 189, 79",
};

const TEAM_ACCENTS: Record<string, TeamAccent> = {
  argentina: { primary: "#75aadb", primaryRgb: "117, 170, 219", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  brazil: { primary: "#009b3a", primaryRgb: "0, 155, 58", secondary: "#ffdf00", secondaryRgb: "255, 223, 0" },
  colombia: { primary: "#fcd116", primaryRgb: "252, 209, 22", secondary: "#ce1126", secondaryRgb: "206, 17, 38" },
  mexico: { primary: "#006847", primaryRgb: "0, 104, 71", secondary: "#ce1126", secondaryRgb: "206, 17, 38" },
  "united states": { primary: "#3c3b6e", primaryRgb: "60, 59, 110", secondary: "#b22234", secondaryRgb: "178, 34, 52" },
  usa: { primary: "#3c3b6e", primaryRgb: "60, 59, 110", secondary: "#b22234", secondaryRgb: "178, 34, 52" },
  canada: { primary: "#ff0000", primaryRgb: "255, 0, 0", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  germany: { primary: "#dd0000", primaryRgb: "221, 0, 0", secondary: "#ffce00", secondaryRgb: "255, 206, 0" },
  france: { primary: "#0055a4", primaryRgb: "0, 85, 164", secondary: "#ef4135", secondaryRgb: "239, 65, 53" },
  spain: { primary: "#aa151b", primaryRgb: "170, 21, 27", secondary: "#f1bf00", secondaryRgb: "241, 191, 0" },
  portugal: { primary: "#006600", primaryRgb: "0, 102, 0", secondary: "#ff0000", secondaryRgb: "255, 0, 0" },
  england: { primary: "#cf142b", primaryRgb: "207, 20, 43", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  netherlands: { primary: "#ff7f00", primaryRgb: "255, 127, 0", secondary: "#21468b", secondaryRgb: "33, 70, 139" },
  japan: { primary: "#bc002d", primaryRgb: "188, 0, 45", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  morocco: { primary: "#c1272d", primaryRgb: "193, 39, 45", secondary: "#006233", secondaryRgb: "0, 98, 51" },
  uruguay: { primary: "#0038a8", primaryRgb: "0, 56, 168", secondary: "#fcd116", secondaryRgb: "252, 209, 22" },
  switzerland: { primary: "#d52b1e", primaryRgb: "213, 43, 30", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  belgium: { primary: "#fae042", primaryRgb: "250, 224, 66", secondary: "#ed2939", secondaryRgb: "237, 41, 57" },
  croatia: { primary: "#ff0000", primaryRgb: "255, 0, 0", secondary: "#171796", secondaryRgb: "23, 23, 150" },
  ghana: { primary: "#fcd116", primaryRgb: "252, 209, 22", secondary: "#006b3f", secondaryRgb: "0, 107, 63" },
  senegal: { primary: "#00853f", primaryRgb: "0, 133, 63", secondary: "#fdef42", secondaryRgb: "253, 239, 66" },
  norway: { primary: "#ba0c2f", primaryRgb: "186, 12, 47", secondary: "#00205b", secondaryRgb: "0, 32, 91" },
  australia: { primary: "#00843d", primaryRgb: "0, 132, 61", secondary: "#ffcd00", secondaryRgb: "255, 205, 0" },
  paraguay: { primary: "#d52b1e", primaryRgb: "213, 43, 30", secondary: "#0038a8", secondaryRgb: "0, 56, 168" },
  turkey: { primary: "#e30a17", primaryRgb: "227, 10, 23", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  ecuador: { primary: "#ffdd00", primaryRgb: "255, 221, 0", secondary: "#ef3340", secondaryRgb: "239, 51, 64" },
  "ivory coast": { primary: "#f77f00", primaryRgb: "247, 127, 0", secondary: "#009e60", secondaryRgb: "0, 158, 96" },
  curacao: { primary: "#002b7f", primaryRgb: "0, 43, 127", secondary: "#f9e814", secondaryRgb: "249, 232, 20" },
  tunisia: { primary: "#e70013", primaryRgb: "231, 0, 19", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  egypt: { primary: "#ce1126", primaryRgb: "206, 17, 38", secondary: "#000000", secondaryRgb: "0, 0, 0" },
  iran: { primary: "#239f40", primaryRgb: "35, 159, 64", secondary: "#da0000", secondaryRgb: "218, 0, 0" },
  "new zealand": { primary: "#00247d", primaryRgb: "0, 36, 125", secondary: "#cc142b", secondaryRgb: "204, 20, 43" },
  "cape verde": { primary: "#003893", primaryRgb: "0, 56, 147", secondary: "#f7d116", secondaryRgb: "247, 209, 22" },
  "saudi arabia": { primary: "#006c35", primaryRgb: "0, 108, 53", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  iraq: { primary: "#ce1126", primaryRgb: "206, 17, 38", secondary: "#007a3d", secondaryRgb: "0, 122, 61" },
  algeria: { primary: "#006233", primaryRgb: "0, 98, 51", secondary: "#d21034", secondaryRgb: "210, 16, 52" },
  austria: { primary: "#ed2939", primaryRgb: "237, 41, 57", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  jordan: { primary: "#007a3d", primaryRgb: "0, 122, 61", secondary: "#ce1126", secondaryRgb: "206, 17, 38" },
  "dr congo": { primary: "#007fff", primaryRgb: "0, 127, 255", secondary: "#f7d618", secondaryRgb: "247, 214, 24" },
  uzbekistan: { primary: "#1eb53a", primaryRgb: "30, 181, 58", secondary: "#0099b5", secondaryRgb: "0, 153, 181" },
  panama: { primary: "#005293", primaryRgb: "0, 82, 147", secondary: "#d21034", secondaryRgb: "210, 16, 52" },
  "south africa": { primary: "#007a4d", primaryRgb: "0, 122, 77", secondary: "#ffb612", secondaryRgb: "255, 182, 18" },
  "south korea": { primary: "#c60c30", primaryRgb: "198, 12, 48", secondary: "#003478", secondaryRgb: "0, 52, 120" },
  czechia: { primary: "#d7141a", primaryRgb: "215, 20, 26", secondary: "#11457e", secondaryRgb: "17, 69, 126" },
  bosnia: { primary: "#002395", primaryRgb: "0, 35, 149", secondary: "#fecb00", secondaryRgb: "254, 203, 0" },
  "bosnia and herzegovina": { primary: "#002395", primaryRgb: "0, 35, 149", secondary: "#fecb00", secondaryRgb: "254, 203, 0" },
  qatar: { primary: "#8a1538", primaryRgb: "138, 21, 56", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  haiti: { primary: "#00209f", primaryRgb: "0, 32, 159", secondary: "#d21034", secondaryRgb: "210, 16, 52" },
  scotland: { primary: "#005eb8", primaryRgb: "0, 94, 184", secondary: "#ffffff", secondaryRgb: "255, 255, 255" },
  sweden: { primary: "#006aa7", primaryRgb: "0, 106, 167", secondary: "#fecc00", secondaryRgb: "254, 204, 0" },
};

function normalizeTeamName(team: string) {
  return team
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function accentForTeam(team: string) {
  return TEAM_ACCENTS[normalizeTeamName(team)] ?? DEFAULT_ACCENT;
}

export function matchAccentStyle(homeTeam: string, awayTeam: string): CSSProperties {
  const home = accentForTeam(homeTeam);
  const away = accentForTeam(awayTeam);

  return {
    "--match-home-accent": home.primary,
    "--match-home-accent-rgb": home.primaryRgb,
    "--match-home-secondary": home.secondary,
    "--match-home-secondary-rgb": home.secondaryRgb,
    "--match-away-accent": away.primary,
    "--match-away-accent-rgb": away.primaryRgb,
    "--match-away-secondary": away.secondary,
    "--match-away-secondary-rgb": away.secondaryRgb,
  } as CSSProperties;
}
