import { signIn } from "@/auth";

const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="hero-panel reveal-up">
        <p className="kicker">Google Login</p>
        <h1 className="section-title mt-2 text-3xl">Sign in as idea submitter or developer</h1>
        <p className="subtle mt-3 text-sm">Google is the only enabled auth provider right now.</p>
      </section>

      <section className="card space-y-3">
        {!googleEnabled ? (
          <p className="text-sm text-red-700">
            Google auth is not configured yet. Add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
          </p>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button className="btn w-full" type="submit">
              Continue with Google
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
