import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/forms";
import { Field } from "@/components/ui/primitives";
import { getCurrentSession } from "@/server/auth/current";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentSession()) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-ink-muted">Use your company account.</p>
      <ActionForm
        action={loginAction}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        resetOnSuccess={false}
        submitClassName="btn-primary w-full"
      >
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
          />
        </Field>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-ink-muted">
        New company?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
