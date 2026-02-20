import { signIn } from "@/auth";

const providerConfig = [
  { id: "google", label: "Continue with Google", enabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) },
  { id: "github", label: "Continue with GitHub", enabled: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) },
  { id: "apple", label: "Continue with Apple", enabled: Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) },
  { id: "facebook", label: "Continue with Facebook", enabled: Boolean(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) },
];

export default function LoginPage() {
  const enabled = providerConfig.filter((provider) => provider.enabled);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="hero-panel reveal-up">
        <p className="kicker">OIDC Login</p>
        <h1 className="section-title mt-2 text-3xl">Sign in as idea submitter or developer</h1>
        <p className="subtle mt-3 text-sm">
          Supported providers: Google, GitHub, Apple, and optionally Facebook.
        </p>
      </section>

      <section className="card space-y-3">
        {enabled.length === 0 ? (
          <p className="text-sm text-red-700">
            No auth providers are configured yet. Add provider env vars to enable login.
          </p>
        ) : (
          enabled.map((provider) => (
            <form
              key={provider.id}
              action={async () => {
                "use server";
                await signIn(provider.id, { redirectTo: "/" });
              }}
            >
              <button className="btn w-full" type="submit">
                {provider.label}
              </button>
            </form>
          ))
        )}
      </section>
    </div>
  );
}
