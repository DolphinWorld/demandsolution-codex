const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "about", "would", "should", "could", "their", "there",
  "have", "has", "had", "are", "was", "were", "will", "can", "our", "you", "they", "them", "but", "not", "use", "using",
  "app", "platform", "idea", "build", "make", "need", "want", "users", "user", "solution", "project", "feature",
]);

function tokenize(value: string): Set<string> {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  return new Set(cleaned);
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let size = 0;
  for (const token of a) {
    if (b.has(token)) size += 1;
  }
  return size;
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
  if (inputTokens.size < 6) return null;

  let best: { targetIdeaId: string; reason: MergeReason; similarityScore: number } | null = null;

  for (const candidate of candidates) {
    const candidateTokens = tokenize(candidate.text);
    if (candidateTokens.size < 6) continue;

    const overlap = intersectionSize(inputTokens, candidateTokens);
    if (overlap === 0) continue;

    const union = inputTokens.size + candidateTokens.size - overlap;
    const jaccard = union > 0 ? overlap / union : 0;
    const newCoveredByExisting = overlap / inputTokens.size;

    let reason: MergeReason | null = null;
    let score = jaccard;

    if (jaccard >= 0.62) {
      reason = "DUPLICATE";
      score = jaccard;
    } else if (newCoveredByExisting >= 0.86) {
      reason = "SUBSET";
      score = newCoveredByExisting;
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
