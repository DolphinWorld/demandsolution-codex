import { cookies, headers } from "next/headers";

export async function getAnonId(): Promise<string> {
  const store = await cookies();
  return store.get("anon_id")?.value ?? "";
}

export async function getNickname(): Promise<string> {
  const store = await cookies();
  return store.get("nickname")?.value ?? "anon";
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return h.get("x-real-ip") ?? "unknown";
}
