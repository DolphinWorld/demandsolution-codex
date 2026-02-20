import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  acceptance_criteria: z.array(z.string().min(1).max(300)).max(8).optional().default([]),
  effort: z.enum(["S", "M", "L"]).optional(),
});

export const generatedSpecSchema = z.object({
  title: z.string().min(1).max(200),
  problem_statement: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  features: z.array(z.string().min(1).max(300)).min(3).max(7),
  tasks: z.array(taskSchema).min(10).max(20),
  open_questions: z.array(z.string().min(1).max(300)).max(10).default([]),
});

export type GeneratedSpec = z.infer<typeof generatedSpecSchema>;
