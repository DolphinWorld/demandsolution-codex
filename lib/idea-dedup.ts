const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "about", "would", "should", "could", "their", "there",
  "have", "has", "had", "are", "was", "were", "will", "can", "our", "you", "they", "them", "but", "not", "use", "using",
  "app", "platform", "idea", "build", "make", "need", "want", "users", "user", "solution", "project", "feature",
  "good", "great", "best", "get", "let", "please", "just",
]);

const SYNONYMS: Record<string, string> = {
  notified: "notify",
  notification: "notify",
  notifications: "notify",
  alert: "notify",
  alerts: "notify",
  deal: "deal",
  deals: "deal",
  offer: "deal",
  offers: "deal",
  discount: "deal",
  discounts: "deal",
  promo: "deal",
  promos: "deal",
  promotion: "deal",
  promotions: "deal",
  trip: "travel",
  trips: "travel",
  traveling: "travel",
  traveller: "travel",
  travellers: "travel",
  traveler: "travel",
  travelers: "travel",
  discover: "find",
  search: "find",
  scan: "find",
  track: "find",
  rewards: "points",
  reward: "points",
  miles: "points",
};

function normalizeToken(raw: string): string {
  let token = raw.toLowerCase().trim();
  if (!token) return "";

  if (SYNONYMS[token]) {
    token = SYNONYMS[token];
  }

  if (token.endsWith("ies") && token.length > 4) {
    token = `${token.slice(0, -3)}y`;
  } else if (token.endsWith("ing") && token.length > 5) {
    token = token.slice(0, -3);
  } else if (token.endsWith("ed") && token.length > 4) {
    token = token.slice(0, -2);
  } else if (token.endsWith("s") && token.length > 3) {
    token = token.slice(0, -1);
  }

  if (SYNONYMS[token]) {
    token = SYNONYMS[token];
  }

  return token;
}

function tokenize(value: string): Set<string> {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => normalizeToken(word))
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  const tokens = new Set(words);

  // Bigrams improve semantic matching for short prompts like "travel deal".
  for (let i = 0; i < words.length - 1; i += 1) {
    const a = words[i];
    const b = words[i + 1];
    if (a && b) {
      tokens.add(`${a}_${b}`);
    }
  }

  return tokens;
}

function countOverlap(a: Set<string>, b: Set<string>) {
  let overlapAll = 0;
  let overlapUnigrams = 0;
  let overlapBigrams = 0;

  for (const token of a) {
    if (!b.has(token)) continue;

    overlapAll += 1;
    if (token.includes("_")) {
      overlapBigrams += 1;
    } else {
      overlapUnigrams += 1;
    }
  }

  return { overlapAll, overlapUnigrams, overlapBigrams };
}

export type MergeReason = "DUPLICATE" | "SUBSET";

export type DedupCandidate = {
  id: string;
  text: string;
};

export function detectMergeTarget(
  inputText: string,
  candidates: DedupCandidate[]
): { targetIdeaId: string; reason: MergeReason; similarityScore: number } | null {
  const inputTokens = tokenize(inputText);
  if (inputTokens.size < 3) return null;

  let best: { targetIdeaId: string; reason: MergeReason; similarityScore: number } | null = null;

  for (const candidate of candidates) {
    const candidateTokens = tokenize(candidate.text);
    if (candidateTokens.size < 3) continue;

    const { overlapAll, overlapUnigrams, overlapBigrams } = countOverlap(inputTokens, candidateTokens);
    if (overlapAll === 0) continue;

    const union = inputTokens.size + candidateTokens.size - overlapAll;
    const jaccard = union > 0 ? overlapAll / union : 0;
    const coverage = overlapAll / inputTokens.size;

    let reason: MergeReason | null = null;
    let score = jaccard;

    if (jaccard >= 0.58) {
      reason = "DUPLICATE";
      score = jaccard;
    } else {
      const shortInputSubset =
        inputTokens.size <= 10 &&
        overlapUnigrams >= 2 &&
        coverage >= 0.55 &&
        (overlapBigrams >= 1 || overlapUnigrams >= 3);

      const normalSubset = overlapUnigrams >= 3 && coverage >= 0.66;

      if (shortInputSubset || normalSubset) {
        reason = "SUBSET";
        score = Math.min(1, Math.max(coverage, jaccard) + (overlapBigrams > 0 ? 0.06 : 0));
      }
    }

    if (!reason) continue;

    if (!best || score > best.similarityScore) {
      best = {
        targetIdeaId: candidate.id,
        reason,
        similarityScore: Number(score.toFixed(4)),
      };
    }
  }

  return best;
}
