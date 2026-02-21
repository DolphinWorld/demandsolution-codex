import OpenAI from "openai";
import { generatedSpecSchema, type GeneratedSpec } from "@/lib/spec-schema";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
      {
        title: "Platform architecture and stack decisions",
        description: "Define system boundaries, data model shape, and deployment strategy.",
        acceptance_criteria: ["Architecture doc covers frontend, API, data, hosting"],
        effort: "M",
      },
      {
        title: "Core idea lifecycle implementation",
        description: "Implement create, browse, detail, and deletion lifecycle for ideas.",
        acceptance_criteria: ["Users can submit and manage idea threads end-to-end"],
        effort: "L",
      },
      {
        title: "Community interaction layer",
        description: "Support upvotes, discussion comments, and moderation-safe posting.",
        acceptance_criteria: ["Voting and commenting are stable and abuse-guarded"],
        effort: "M",
      },
      {
        title: "Developer collaboration workflow",
        description: "Support task claiming, working signals, and progress status updates.",
        acceptance_criteria: ["Developers can coordinate without account friction"],
        effort: "M",
      },
      {
        title: "Solution submission and evaluation",
        description: "Provide solution posting, feedback votes/comments, and submitter approval flow.",
        acceptance_criteria: ["Approved solutions are clearly visible in the thread"],
        effort: "M",
      },
      {
        title: "Authentication and identity policy",
        description: "Establish anonymous defaults and optional authenticated identity actions.",
        acceptance_criteria: ["Access checks are enforced across APIs and UI"],
        effort: "M",
      },
      {
        title: "Quality, monitoring, and release readiness",
        description: "Add validation, error handling, and basic operational diagnostics for production.",
        acceptance_criteria: ["Critical paths have test coverage and observable logs"],
        effort: "M",
      },
    ],
    open_questions: [
      "Should submitters be able to edit/delete ideas in this version?",
      "Do you want to add similar-ideas matching via embeddings now or later?",
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
    "- 6 to 12 general implementation tasks (workstreams, not tiny subtasks)",
    "- each task should be outcome-oriented and broad enough for a developer to own",
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

    let content: string | null = null;

    try {
      const response = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a product requirements assistant. Always output valid JSON only, no markdown.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      content = response.choices[0]?.message?.content ?? null;
    } catch {
      // Network/auth/provider errors should not break idea submission.
      continue;
    }

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
