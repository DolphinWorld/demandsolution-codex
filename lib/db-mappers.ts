import type { Idea, Task, TaskLink } from "@prisma/client";
import { cleanIdeaTitle, normalizeIdeaCopy } from "@/lib/idea-copy";

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
    title: cleanIdeaTitle(idea.title),
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
