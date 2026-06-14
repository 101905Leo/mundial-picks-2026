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

const statusPriority: Record<MatchScore["status"], number> = {
  SCHEDULED: 0,
  LIVE: 1,
  FINISHED: 2,
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
  const equivalent = scoredMatches
    .filter((candidate) => candidate.id !== match.id && sameMatchByTeamsAndKickoff(candidate, match))
    .sort((left, right) => statusPriority[right.status] - statusPriority[left.status])[0];

  if (!equivalent) return match;

  const equivalentIsMoreFinal = statusPriority[equivalent.status] > statusPriority[match.status];
  const currentHasNoScore = match.homeScore === null || match.awayScore === null;
  const equivalentHasDifferentFinalScore =
    equivalent.status === "FINISHED" &&
    equivalent.homeScore !== null &&
    equivalent.awayScore !== null &&
    (match.homeScore !== equivalent.homeScore || match.awayScore !== equivalent.awayScore);
  const equivalentHasDifferentLiveScore =
    equivalent.status === "LIVE" &&
    match.status !== "FINISHED" &&
    equivalent.homeScore !== null &&
    equivalent.awayScore !== null &&
    (match.homeScore !== equivalent.homeScore || match.awayScore !== equivalent.awayScore);

  if (!currentHasNoScore && !equivalentIsMoreFinal && !equivalentHasDifferentFinalScore && !equivalentHasDifferentLiveScore) {
    return match;
  }

  return {
    ...match,
    homeScore: equivalent.homeScore,
    awayScore: equivalent.awayScore,
    status: equivalent.status,
  };
}
