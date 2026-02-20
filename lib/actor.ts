import { auth } from "@/auth";
import { getAnonId } from "@/lib/identity";

export async function getActor() {
  const session = await auth();
  const anonId = await getAnonId();

  return {
    session,
    userId: session?.user?.id ?? null,
    anonId: anonId || null,
  };
}
