import Link from "next/link";
import { redirect } from "next/navigation";
import { signUpAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/forms";
import { Field } from "@/components/ui/primitives";
import { getCurrentSession } from "@/server/auth/current";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return (
    <>
      <h1 className="text-xl font-semibold">Create a company account</h1>
      <p className="mt-1 mb-6 text-sm text-ink-muted">
        You&apos;ll be the account owner. Data is only visible inside your company.
      </p>
      <ActionForm
        action={signUpAction}
        submitLabel="Create account"
        pendingLabel="Creating…"
        resetOnSuccess={false}
        submitClassName="btn-primary w-full"
      >
        <Field label="Company name" htmlFor="organizationName">
          <input id="organizationName" name="organizationName" required className="input" />
        </Field>
        <Field label="Your name" htmlFor="name">
          <input id="name" name="name" autoComplete="name" required className="input" />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters.">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            className="input"
          />
        </Field>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
