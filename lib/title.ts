import { cleanIdeaTitle, cleanProblemStatement, stripSocialRequirementPrefix } from "@/lib/idea-copy";

const MAX_TITLE_LENGTH = 80;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimLeadIn(value: string): string {
  return value
    .replace(/^i\s+(want|need|would\s+like|wish|hope)\s+(to\s+)?/i, "")
    .replace(/^please\s+/i, "")
    .replace(/^can\s+you\s+/i, "");
}

function truncateSummary(value: string, maxLength = MAX_TITLE_LENGTH): string {
  const text = collapseWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }

  let clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");

  if (lastSpace >= Math.floor(maxLength / 2)) {
    clipped = clipped.slice(0, lastSpace);
  }

  return clipped.replace(/[,:;.!?\-–—]+$/g, "").trim();
}

function deriveTitleFromInput(rawInputText: string, problemStatement?: string | null): string {
  const source =
    cleanProblemStatement(problemStatement, rawInputText) ||
    stripSocialRequirementPrefix(rawInputText);

  let text = collapseWhitespace(source);
  if (!text) {
    return "";
  }

  const contextSplit = text.split(/\bContext:\b/i)[0];
  if (contextSplit) {
    text = contextSplit;
  }

  const sentenceSplit = text.split(/[.!?]\s+/)[0];
  if (sentenceSplit) {
    text = sentenceSplit;
  }

  text = text
    .split("\n")[0]
    .trim();

  text = trimLeadIn(text);
  text = collapseWhitespace(text);

  if (!text) {
    return "";
  }

  return truncateSummary(text);
}

export function buildMeaningfulTitle(params: {
  rawInputText: string;
  title: string;
  problemStatement?: string | null;
}): string {
  const candidate = collapseWhitespace(cleanIdeaTitle(params.title || ""));
  const derived = deriveTitleFromInput(params.rawInputText, params.problemStatement);
  return derived || candidate || "New Product Idea";
}
