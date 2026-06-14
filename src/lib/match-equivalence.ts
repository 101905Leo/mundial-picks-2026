type MatchIdentity = {
  id?: string;
  competitionId?: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date | string;
};

type MatchScore = MatchIdentity & {
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
};

export function normalizeTeamName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  const aliases: Record<string, string> = {
    usa: "unitedstates",
    unitedstatesofamerica: "unitedstates",
    usmnt: "unitedstates",
    korearepublic: "southkorea",
    republicofkorea: "southkorea",
    iriran: "iran",
    coteivoire: "ivorycoast",
    ctedivoire: "ivorycoast",
  };

  return aliases[normalized] ?? normalized;
}

function kickoffDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function sameMatchByTeamsAndKickoff(left: MatchIdentity, right: MatchIdentity) {
  const bothHaveCompetition = Boolean(left.competitionId && right.competitionId);
  if (bothHaveCompetition && left.competitionId !== right.competitionId) return false;

  const leftDate = kickoffDate(left.startsAt);
  const rightDate = kickoffDate(right.startsAt);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return false;
  if (Math.abs(leftDate.getTime() - rightDate.getTime()) > 18 * 60 * 60 * 1000) return false;

  return (
    normalizeTeamName(left.homeTeam) === normalizeTeamName(right.homeTeam) &&
    normalizeTeamName(left.awayTeam) === normalizeTeamName(right.awayTeam)
  );
}

export function resolveEffectiveMatchScore<T extends MatchScore>(match: T, scoredMatches: MatchScore[]) {
  if ((match.status === "LIVE" || match.status === "FINISHED") && match.homeScore !== null && match.awayScore !== null) {
    return match;
  }

  const equivalent = scoredMatches.find(
    (candidate) => candidate.id !== match.id && sameMatchByTeamsAndKickoff(candidate, match),
  );

  if (!equivalent) return match;

  return {
    ...match,
    homeScore: equivalent.homeScore,
    awayScore: equivalent.awayScore,
    status: equivalent.status,
  };
}
