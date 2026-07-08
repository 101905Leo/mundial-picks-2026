export type ProviderScoreValue = {
  home?: number | null;
  away?: number | null;
};

export type ProviderScoreCandidate = {
  label: string;
  score?: ProviderScoreValue | null;
};

export type NormalizedProviderScore = {
  homeScore: number | null;
  awayScore: number | null;
  source: string;
  usedPenaltyAdjustment: boolean;
  ambiguous: boolean;
};

function completeScore(score?: ProviderScoreValue | null): score is { home: number; away: number } {
  return (
    score?.home !== null &&
    score?.home !== undefined &&
    score?.away !== null &&
    score?.away !== undefined
  );
}

function hasPenaltyShootout(score?: ProviderScoreValue | null): score is { home: number; away: number } {
  return completeScore(score) && (score.home > 0 || score.away > 0);
}

function removePenalties(total: { home: number; away: number }, penalties: { home: number; away: number }) {
  const home = total.home - penalties.home;
  const away = total.away - penalties.away;

  if (home < 0 || away < 0) return null;
  if (home !== away) return null;

  return { home, away };
}

export function normalizeProviderScoreWithoutPenalties(
  candidates: ProviderScoreCandidate[],
  penalties?: ProviderScoreValue | null,
): NormalizedProviderScore {
  const penaltyShootout = hasPenaltyShootout(penalties) ? penalties : null;
  let sawAmbiguousPenaltyTotal = false;

  for (const candidate of candidates) {
    if (!completeScore(candidate.score)) continue;

    if (!penaltyShootout) {
      return {
        homeScore: candidate.score.home,
        awayScore: candidate.score.away,
        source: candidate.label,
        usedPenaltyAdjustment: false,
        ambiguous: false,
      };
    }

    const withoutPenalties = removePenalties(candidate.score, penaltyShootout);
    if (withoutPenalties) {
      return {
        homeScore: withoutPenalties.home,
        awayScore: withoutPenalties.away,
        source: `${candidate.label}-minus-penalties`,
        usedPenaltyAdjustment: true,
        ambiguous: false,
      };
    }

    if (candidate.score.home === candidate.score.away) {
      return {
        homeScore: candidate.score.home,
        awayScore: candidate.score.away,
        source: candidate.label,
        usedPenaltyAdjustment: false,
        ambiguous: false,
      };
    }

    sawAmbiguousPenaltyTotal = true;
  }

  return {
    homeScore: null,
    awayScore: null,
    source: sawAmbiguousPenaltyTotal ? "ambiguous-penalty-total" : "missing-score",
    usedPenaltyAdjustment: false,
    ambiguous: sawAmbiguousPenaltyTotal,
  };
}
