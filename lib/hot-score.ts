export function scoreHot(upvotes: number, createdAt: Date): number {
  const ageHours = Math.max(1, (Date.now() - createdAt.getTime()) / 3600000);
  return upvotes / Math.pow(ageHours + 2, 0.8);
}
