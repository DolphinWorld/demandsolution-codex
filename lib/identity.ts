import { cookies, headers } from "next/headers";

function looksLikeAnonId(value: string): boolean {
  return value.length >= 8 && value.length <= 128;
}

export async function getAnonId(): Promise<string> {
  const store = await cookies();
  const cookieAnon = store.get("anon_id")?.value ?? "";
  if (looksLikeAnonId(cookieAnon)) return cookieAnon;

  const h = await headers();
  const headerAnon = h.get("x-anon-id")?.trim() ?? "";
  if (looksLikeAnonId(headerAnon)) return headerAnon;

  return "";
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
