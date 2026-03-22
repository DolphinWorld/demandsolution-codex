const { PrismaClient } = require("@prisma/client");

const SOCIAL_REQUIREMENT_PREFIX = "User requirement from social community:";
const GENERIC_PROBLEM_STATEMENT =
  /^Build a\s+.+?\s+product for\s+.+?\s+based on the submitted idea\.$/i;

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
        rawInputText: true,
        problemStatement: true,
      },
    });

    let updates = 0;

    for (const idea of ideas) {
      const rawInputText = stripSocialRequirementPrefix(idea.rawInputText);
      const problemStatement = cleanProblemStatement(idea.problemStatement, rawInputText);

      if (rawInputText === idea.rawInputText && problemStatement === idea.problemStatement) {
        continue;
      }

      await prisma.idea.update({
        where: { id: idea.id },
        data: {
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
