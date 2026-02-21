const BAD_ENDINGS = new Set(["and", "or", "but", "to", "for", "with", "of", "a", "an", "the"]);

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isWeakTitle(title: string): boolean {
  const cleaned = collapseWhitespace(title).replace(/^['\"`]+|['\"`]+$/g, "");
  if (cleaned.length < 12 || cleaned.length > 110) return true;

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length < 3) return true;

  const last = words[words.length - 1]?.toLowerCase() || "";
  if (BAD_ENDINGS.has(last)) return true;

  const alphaWords = words.filter((word) => /[a-z]/i.test(word));
  if (alphaWords.length < 3) return true;

  return false;
}

function titleCase(phrase: string): string {
  const stop = new Set(["a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "with"]);
  const words = phrase.split(" ").filter(Boolean);

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && stop.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function deriveTitleFromInput(rawInputText: string): string {
  let text = collapseWhitespace(rawInputText);
  text = text
    .replace(/^i\s+(want|need|would\s+like|wish|hope)\s+(to\s+)?/i, "")
    .replace(/^please\s+/i, "")
    .replace(/^can\s+you\s+/i, "");

  const firstClause = text.split(/[.!?;:\n]/)[0] || text;
  const words = collapseWhitespace(firstClause).split(" ").filter(Boolean);

  const trimmedWords = words.slice(0, 12);
  while (trimmedWords.length && BAD_ENDINGS.has(trimmedWords[trimmedWords.length - 1].toLowerCase())) {
    trimmedWords.pop();
  }

  const fallback = trimmedWords.join(" ").trim();
  if (!fallback) return "New Product Idea";

  const withPrefix = /^build\b|^create\b|^make\b/i.test(fallback) ? fallback : `Build ${fallback}`;
  return titleCase(withPrefix);
}

export function buildMeaningfulTitle(params: {
  rawInputText: string;
  title: string;
  problemStatement?: string | null;
}): string {
  const candidate = collapseWhitespace(params.title || "");
  if (!candidate || isWeakTitle(candidate)) {
    return deriveTitleFromInput(params.rawInputText);
  }

  // If model title is just a direct clipped prefix of raw input, promote a cleaner synthesized title.
  const normalizedRaw = collapseWhitespace(params.rawInputText).toLowerCase();
  if (normalizedRaw.startsWith(candidate.toLowerCase()) && candidate.length < 26) {
    return deriveTitleFromInput(params.rawInputText);
  }

  return candidate;
}
