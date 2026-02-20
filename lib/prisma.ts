import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var dbReadyPromise: Promise<void> | undefined;
}

export const prisma = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

async function bootstrapTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Idea (
      id TEXT PRIMARY KEY,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdByAnonId TEXT NOT NULL,
      rawInputText TEXT NOT NULL,
      targetUsers TEXT,
      platform TEXT,
      constraints TEXT,
      title TEXT NOT NULL,
      problemStatement TEXT NOT NULL,
      tags TEXT NOT NULL,
      features TEXT NOT NULL,
      openQuestions TEXT NOT NULL,
      upvotesCount INTEGER NOT NULL DEFAULT 0,
      commentsCount INTEGER NOT NULL DEFAULT 0
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Task (
      id TEXT PRIMARY KEY,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ideaId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      acceptance TEXT NOT NULL,
      effort TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      claimedByAnonId TEXT,
      claimedAt DATETIME,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ideaId) REFERENCES Idea(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TaskLink (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      url TEXT NOT NULL,
      label TEXT,
      createdByAnonId TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (taskId) REFERENCES Task(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Comment (
      id TEXT PRIMARY KEY,
      ideaId TEXT NOT NULL,
      body TEXT NOT NULL,
      createdByAnonId TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ideaId) REFERENCES Idea(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Vote (
      ideaId TEXT NOT NULL,
      anonId TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (ideaId, anonId),
      FOREIGN KEY (ideaId) REFERENCES Idea(id) ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Nickname (
      anonId TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS SubmissionRateLimit (
      id TEXT PRIMARY KEY,
      anonId TEXT NOT NULL,
      ipAddress TEXT NOT NULL,
      windowStart TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0
    );
  `);

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS SubmissionRateLimit_key ON SubmissionRateLimit(anonId, ipAddress, windowStart);`
  );
}

export async function ensureDb() {
  if (!global.dbReadyPromise) {
    global.dbReadyPromise = bootstrapTables();
  }
  return global.dbReadyPromise;
}
