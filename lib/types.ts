import type { Idea, Task, TaskLink } from "@prisma/client";

export type TaskView = Task & { links: TaskLink[] };

export type IdeaView = Idea & {
  tasks: TaskView[];
};
