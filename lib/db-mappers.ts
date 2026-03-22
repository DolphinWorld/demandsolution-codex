import type { Idea, Task, TaskLink } from "@prisma/client";
import { normalizeIdeaCopy } from "@/lib/idea-copy";
import { buildMeaningfulTitle } from "@/lib/title";

export function parseJsonArray<T>(value: string, fallback: T[] = []): T[] {
  try {
    return JSON.parse(value) as T[];
  } catch {
    return fallback;
  }
}

export function mapIdea(idea: Idea) {
  const normalizedCopy = normalizeIdeaCopy({
    rawInputText: idea.rawInputText,
    problemStatement: idea.problemStatement,
  });

  return {
    ...idea,
    title: buildMeaningfulTitle({
      rawInputText: normalizedCopy.rawInputText,
      title: idea.title,
      problemStatement: normalizedCopy.problemStatement,
    }),
    rawInputText: normalizedCopy.rawInputText,
    problemStatement: normalizedCopy.problemStatement,
    tags: parseJsonArray<string>(idea.tags),
    features: parseJsonArray<string>(idea.features),
    open_questions: parseJsonArray<string>(idea.openQuestions),
  };
}

export function mapTask(task: Task & { links?: TaskLink[] }) {
  return {
    ...task,
    acceptance_criteria: parseJsonArray<string>(task.acceptance),
    links: task.links ?? [],
  };
}
