const { PrismaClient } = require("@prisma/client");

const SOCIAL_REQUIREMENT_PREFIX = "User requirement from social community:";
const GENERIC_PROBLEM_STATEMENT =
  /^Build a\s+.+?\s+product for\s+.+?\s+based on the submitted idea\.$/i;
const MAX_TITLE_LENGTH = 80;

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripSocialRequirementPrefix(value) {
  if (!value) return "";

  const trimmed = String(value).trim();
  if (!trimmed) return "";

  if (trimmed.startsWith(SOCIAL_REQUIREMENT_PREFIX)) {
    return trimmed.slice(SOCIAL_REQUIREMENT_PREFIX.length).trim();
  }

  return trimmed;
}

function cleanProblemStatement(problemStatement, rawInputText) {
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

function cleanIdeaTitle(title) {
  return stripSocialRequirementPrefix(title);
}

function trimLeadIn(value) {
  return value
    .replace(/^i\s+(want|need|would\s+like|wish|hope)\s+(to\s+)?/i, "")
    .replace(/^please\s+/i, "")
    .replace(/^can\s+you\s+/i, "");
}

function truncateSummary(value, maxLength = MAX_TITLE_LENGTH) {
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

function deriveTitleFromInput(rawInputText, problemStatement) {
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

  text = text.split("\n")[0].trim();
  text = trimLeadIn(text);
  text = collapseWhitespace(text);

  if (!text) {
    return "";
  }

  return truncateSummary(text);
}

function buildMeaningfulTitle(title, rawInputText, problemStatement) {
  const candidate = collapseWhitespace(cleanIdeaTitle(title || ""));
  const derived = deriveTitleFromInput(rawInputText, problemStatement);
  return derived || candidate || "New Product Idea";
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL || "";

  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    console.log("Idea copy cleanup skipped. DATABASE_URL is not a PostgreSQL connection string.");
    return;
  }

  const prisma = new PrismaClient();

  try {
    const ideas = await prisma.idea.findMany({
      select: {
        id: true,
        title: true,
        rawInputText: true,
        problemStatement: true,
      },
    });

    let updates = 0;

    for (const idea of ideas) {
      const rawInputText = stripSocialRequirementPrefix(idea.rawInputText);
      const problemStatement = cleanProblemStatement(idea.problemStatement, rawInputText);
      const title = buildMeaningfulTitle(idea.title, rawInputText, problemStatement);

      if (
        title === idea.title &&
        rawInputText === idea.rawInputText &&
        problemStatement === idea.problemStatement
      ) {
        continue;
      }

      await prisma.idea.update({
        where: { id: idea.id },
        data: {
          title,
          rawInputText,
          problemStatement,
        },
      });

      updates += 1;
    }

    console.log(`Idea copy cleanup complete. Updated ${updates} row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Idea copy cleanup failed.");
  console.error(error);
  process.exit(1);
});
