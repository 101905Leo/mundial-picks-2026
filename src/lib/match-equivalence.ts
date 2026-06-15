type MatchIdentity = {
  id?: string;
  competitionId?: string | null;
  roomId?: string | null;
  sourceKey?: string | null;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date | string;
  updatedAt?: Date | string;
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

function timestamp(value?: Date | string) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function equivalentSourcePriority(candidate: MatchScore, baseMatch: MatchScore) {
  let priority = statusPriority[candidate.status] * 1000;

  if (candidate.roomId && baseMatch.roomId && candidate.roomId === baseMatch.roomId) priority += 500;
  if (candidate.roomId === null) priority += 350;
  if (candidate.sourceKey) priority += 100;
  if (candidate.competitionId && candidate.competitionId === baseMatch.competitionId) priority += 50;
  if (candidate.homeScore !== null && candidate.awayScore !== null) priority += 10;

  return priority;
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
  if (match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null) {
    const trustedFinalEquivalent = scoredMatches
      .filter(
        (candidate) =>
          candidate.id !== match.id &&
          candidate.roomId === null &&
          Boolean(candidate.sourceKey) &&
          candidate.status === "FINISHED" &&
          candidate.homeScore !== null &&
          candidate.awayScore !== null &&
          sameMatchByTeamsAndKickoff(candidate, match),
      )
      .sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt))[0];

    const sameOfficialSource =
      trustedFinalEquivalent &&
      Boolean(match.sourceKey) &&
      trustedFinalEquivalent.sourceKey === match.sourceKey &&
      match.roomId !== null;
    const trustedFinalIsNewer =
      trustedFinalEquivalent &&
      timestamp(trustedFinalEquivalent.updatedAt) > timestamp(match.updatedAt) &&
      (trustedFinalEquivalent.homeScore !== match.homeScore || trustedFinalEquivalent.awayScore !== match.awayScore);

    if (sameOfficialSource || trustedFinalIsNewer) {
      return {
        ...match,
        homeScore: trustedFinalEquivalent.homeScore,
        awayScore: trustedFinalEquivalent.awayScore,
        status: trustedFinalEquivalent.status,
      };
    }

    return match;
  }

  const equivalent = scoredMatches
    .filter((candidate) => candidate.id !== match.id && sameMatchByTeamsAndKickoff(candidate, match))
    .sort((left, right) => {
      const priorityDelta = equivalentSourcePriority(right, match) - equivalentSourcePriority(left, match);
      if (priorityDelta !== 0) return priorityDelta;
      return timestamp(right.updatedAt) - timestamp(left.updatedAt);
    })[0];

  if (!equivalent) return match;

  const equivalentIsMoreFinal = statusPriority[equivalent.status] > statusPriority[match.status];
  const currentHasNoScore = match.homeScore === null || match.awayScore === null;
  const equivalentHasDifferentLiveScore =
    equivalent.status === "LIVE" &&
    match.status !== "FINISHED" &&
    equivalent.homeScore !== null &&
    equivalent.awayScore !== null &&
    (match.homeScore !== equivalent.homeScore || match.awayScore !== equivalent.awayScore);

  if (!currentHasNoScore && !equivalentIsMoreFinal && !equivalentHasDifferentLiveScore) {
    return match;
  }

  return {
    ...match,
    homeScore: equivalent.homeScore,
    awayScore: equivalent.awayScore,
    status: equivalent.status,
  };
}
