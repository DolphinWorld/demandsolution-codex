import OpenAI from "openai";
import { generatedSpecSchema, type GeneratedSpec } from "@/lib/spec-schema";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function fallbackSpec(rawInputText: string, platform?: string | null, targetUsers?: string | null): GeneratedSpec {
  const title = rawInputText.slice(0, 80) || "Community Idea";
  const audience = targetUsers?.trim() || "general users";
  const targetPlatform = platform?.trim() || "web";

  return {
    title,
    problem_statement: `Build a ${targetPlatform} product for ${audience} based on the submitted idea.`,
    tags: ["community", "spec"],
    features: [
      "Idea submission form with optional context fields",
      "LLM-based requirement generation",
      "Public idea detail page with structured sections",
    ],
    tasks: [
      { title: "Set up project scaffold", description: "Initialize Next.js + Prisma + SQLite", acceptance_criteria: ["Project runs locally"], effort: "S" },
      { title: "Add anon identity middleware", description: "Create persistent anon_id cookie", acceptance_criteria: ["Cookie is present on first visit"], effort: "S" },
      { title: "Create POST /api/ideas", description: "Accept raw input and optional context", acceptance_criteria: ["Request validation works"], effort: "S" },
      { title: "Implement LLM generation service", description: "Generate strict JSON spec", acceptance_criteria: ["JSON validated with schema"], effort: "M" },
      { title: "Persist idea and tasks", description: "Save generated spec in database", acceptance_criteria: ["Idea and tasks stored"], effort: "S" },
      { title: "Create home page list", description: "Show ideas sorted by hot/new", acceptance_criteria: ["Cards render title, tags, counts"], effort: "S" },
      { title: "Create idea detail page", description: "Render problem, features, tasks", acceptance_criteria: ["All core sections visible"], effort: "M" },
      { title: "Add upvote endpoints", description: "Toggle vote per anon cookie", acceptance_criteria: ["One vote per anon_id"], effort: "S" },
      { title: "Add comments endpoints", description: "Create and list comments", acceptance_criteria: ["Comment count updates"], effort: "S" },
      { title: "Add task claim/status/link endpoints", description: "Claim tasks and attach links", acceptance_criteria: ["Claimant can update task"], effort: "M" },
    ],
    open_questions: [
      "Should submitters be able to edit/delete ideas in V0.1?",
      "Do you want to enable similar-ideas matching now or defer to V0.2?",
    ],
  };
}

function promptForSpec(input: {
  raw_input_text: string;
  target_users?: string;
  platform?: string;
  constraints?: string;
}): string {
  return [
    "Turn the idea into a buildable product specification JSON.",
    "Return strict JSON only.",
    "Rules:",
    "- 3 to 7 features",
    "- 10 to 20 concrete implementation tasks",
    "- do not hallucinate external integrations unless requested",
    "- place missing details in open_questions",
    "Input:",
    JSON.stringify(input),
  ].join("\n");
}

export async function generateSpec(input: {
  raw_input_text: string;
  target_users?: string;
  platform?: string;
  constraints?: string;
}): Promise<GeneratedSpec> {
  if (!openai) {
    return fallbackSpec(input.raw_input_text, input.platform, input.target_users);
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const basePrompt = promptForSpec(input);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = attempt === 0 ? basePrompt : `${basePrompt}\nFix output as valid JSON matching required schema.`;

    const response = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a product requirements assistant. Always output valid JSON only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) continue;

    try {
      const parsed = JSON.parse(content);
      return generatedSpecSchema.parse(parsed);
    } catch {
      continue;
    }
  }

  return fallbackSpec(input.raw_input_text, input.platform, input.target_users);
}
