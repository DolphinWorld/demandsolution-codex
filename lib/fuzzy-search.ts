const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
  "your",
]);

export type SearchContext = {
  normalizedQuery: string;
  tokens: string[];
  trigrams: Set<string>;
};

export type SearchableIdea = {
  title: string;
  problemStatement: string;
  rawInputText: string;
  tags: string[];
};

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenizeSearchTerms(value: string): string[] {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];

  const tokens = normalized.split(" ").filter(Boolean);
  const meaningful = tokens.filter((token) => token.length >= 2 && !SEARCH_STOP_WORDS.has(token));
  return meaningful.length > 0 ? meaningful : tokens.filter((token) => token.length >= 2);
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const next = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    next[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }

    for (let j = 0; j <= b.length; j += 1) prev[j] = next[j];
  }

  return prev[b.length];
}

function tokenSimilarity(queryToken: string, candidateToken: string): number {
  if (queryToken === candidateToken) return 1;
  if (candidateToken.startsWith(queryToken) || queryToken.startsWith(candidateToken)) return 0.9;

  const maxLength = Math.max(queryToken.length, candidateToken.length);
  if (maxLength === 0) return 0;
  if (Math.abs(queryToken.length - candidateToken.length) > 3) return 0;

  const distance = levenshteinDistance(queryToken, candidateToken);
  return Math.max(0, 1 - distance / maxLength);
}

export function createTrigrams(value: string): Set<string> {
  const normalized = normalizeSearchText(value);
  if (normalized.length < 3) {
    return new Set(normalized ? [normalized] : []);
  }

  const padded = `  ${normalized}  `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i += 1) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function fuzzyTextScore(context: SearchContext, candidate: string): number {
  const candidateNormalized = normalizeSearchText(candidate);
  if (!candidateNormalized) return 0;
  if (candidateNormalized.includes(context.normalizedQuery)) return 1;

  const candidateTokens = candidateNormalized.split(" ").filter(Boolean);
  let tokenScore = 0;

  if (context.tokens.length > 0 && candidateTokens.length > 0) {
    const perToken = context.tokens.map((token) => {
      let best = 0;
      for (const candidateToken of candidateTokens) {
        const similarity = tokenSimilarity(token, candidateToken);
        if (similarity > best) best = similarity;
        if (best >= 1) break;
      }
      return best;
    });

    tokenScore = perToken.reduce((total, value) => total + value, 0) / perToken.length;
  }

  const trigramScore = jaccardSimilarity(context.trigrams, createTrigrams(candidateNormalized));
  return 0.72 * tokenScore + 0.28 * trigramScore;
}

export function computeIdeaSearchScore(context: SearchContext, idea: SearchableIdea): number {
  const titleScore = fuzzyTextScore(context, idea.title);
  const problemScore = fuzzyTextScore(context, idea.problemStatement);
  const rawScore = fuzzyTextScore(context, idea.rawInputText);
  const tagsScore = fuzzyTextScore(context, idea.tags.join(" "));
  const blended = titleScore * 0.42 + problemScore * 0.3 + rawScore * 0.2 + tagsScore * 0.08;

  return Math.max(titleScore, blended);
}
