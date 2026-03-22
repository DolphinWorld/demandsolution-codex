const SOCIAL_REQUIREMENT_PREFIX = "User requirement from social community:";
const GENERIC_PROBLEM_STATEMENT =
  /^Build a\s+.+?\s+product for\s+.+?\s+based on the submitted idea\.$/i;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stripSocialRequirementPrefix(value: string | null | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith(SOCIAL_REQUIREMENT_PREFIX)) {
    return trimmed.slice(SOCIAL_REQUIREMENT_PREFIX.length).trim();
  }

  return trimmed;
}

export function cleanProblemStatement(
  problemStatement: string | null | undefined,
  rawInputText: string | null | undefined,
): string {
  const cleanedRawInput = stripSocialRequirementPrefix(rawInputText);
  const cleanedProblem = stripSocialRequirementPrefix(problemStatement);

  if (!cleanedProblem) {
    return cleanedRawInput;
  }

  if (GENERIC_PROBLEM_STATEMENT.test(cleanedProblem)) {
    return cleanedRawInput || cleanedProblem;
  }

  return cleanedProblem;
}

export function normalizeIdeaCopy(input: {
  rawInputText: string | null | undefined;
  problemStatement: string | null | undefined;
}) {
  const rawInputText = stripSocialRequirementPrefix(input.rawInputText);
  const problemStatement = cleanProblemStatement(input.problemStatement, rawInputText);

  return {
    rawInputText,
    problemStatement,
  };
}

export function looksLikeDirtyIdeaCopy(input: {
  rawInputText: string | null | undefined;
  problemStatement: string | null | undefined;
}) {
  const currentRaw = collapseWhitespace(input.rawInputText || "");
  const currentProblem = collapseWhitespace(input.problemStatement || "");
  const normalized = normalizeIdeaCopy(input);

  return (
    currentRaw !== collapseWhitespace(normalized.rawInputText) ||
    currentProblem !== collapseWhitespace(normalized.problemStatement)
  );
}
