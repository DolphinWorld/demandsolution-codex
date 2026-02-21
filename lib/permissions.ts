export const ADMIN_EMAILS = new Set(["jacksuyu@gmail.com"]);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export function canDeleteIdea(params: {
  ideaOwnerUserId: string | null;
  ideaOwnerAnonId: string | null;
  actorUserId: string | null;
  actorAnonId: string | null;
  actorEmail?: string | null;
}): boolean {
  if (isAdminEmail(params.actorEmail)) return true;

  if (params.actorUserId) {
    return params.ideaOwnerUserId === params.actorUserId;
  }

  if (!params.ideaOwnerUserId && params.actorAnonId) {
    return params.ideaOwnerAnonId === params.actorAnonId;
  }

  return false;
}
