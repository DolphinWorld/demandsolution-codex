import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const profile = await prisma.developerProfile.findUnique({ where: { userId } });

  async function saveProfile(formData: FormData) {
    "use server";

    const current = await auth();
    const currentUserId = current?.user?.id;
    if (!currentUserId) {
      redirect("/login");
    }

    const displayName = String(formData.get("displayName") || "").trim();
    if (displayName.length < 2 || displayName.length > 50) {
      redirect("/me/profile?error=display_name");
    }

    const headline = String(formData.get("headline") || "").trim();
    const bio = String(formData.get("bio") || "").trim();
    const githubUrl = String(formData.get("githubUrl") || "").trim();
    const websiteUrl = String(formData.get("websiteUrl") || "").trim();

    await prisma.developerProfile.upsert({
      where: { userId: currentUserId },
      create: {
        userId: currentUserId,
        displayName,
        headline: headline || null,
        bio: bio || null,
        githubUrl: githubUrl || null,
        websiteUrl: websiteUrl || null,
      },
      update: {
        displayName,
        headline: headline || null,
        bio: bio || null,
        githubUrl: githubUrl || null,
        websiteUrl: websiteUrl || null,
      },
    });

    redirect("/me/profile?saved=1");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="hero-panel reveal-up">
        <p className="kicker">Developer Profile</p>
        <h1 className="section-title mt-2 text-3xl">Create your contributor profile</h1>
        <p className="subtle mt-2 text-sm">Your profile name is used for task claims, work votes, and submitted solutions.</p>
      </section>

      <form action={saveProfile} className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Display name</label>
          <input name="displayName" required minLength={2} maxLength={50} className="input" defaultValue={profile?.displayName || session?.user?.name || ""} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Headline</label>
          <input name="headline" maxLength={120} className="input" defaultValue={profile?.headline || ""} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bio</label>
          <textarea name="bio" maxLength={500} className="input min-h-28" defaultValue={profile?.bio || ""} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">GitHub URL</label>
          <input name="githubUrl" type="url" className="input" defaultValue={profile?.githubUrl || ""} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Website URL</label>
          <input name="websiteUrl" type="url" className="input" defaultValue={profile?.websiteUrl || ""} />
        </div>

        <button type="submit" className="btn btn-primary">Save Profile</button>
      </form>
    </div>
  );
}
