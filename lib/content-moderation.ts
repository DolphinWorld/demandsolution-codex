const BLOCK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "hate slur", pattern: /\b(?:nigger|faggot|kike|chink)\b/i },
  { label: "sexual slur", pattern: /\b(?:cunt|whore)\b/i },
  { label: "explicit profanity", pattern: /\b(?:fuck|motherfucker|shit|asshole|bitch)\b/i },
  { label: "violent abuse", pattern: /\b(?:rape|kill\s+all|exterminate\s+all)\b/i },
];

export function findBlockedContent(...inputs: Array<string | undefined | null>) {
  const text = inputs
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .slice(0, 5000);

  if (!text) {
    return { blocked: false, labels: [] as string[] };
  }

  const labels = BLOCK_PATTERNS.filter((item) => item.pattern.test(text)).map((item) => item.label);

  return {
    blocked: labels.length > 0,
    labels,
  };
}
