import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/session";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in — no reason to show the form again.
  if (await getOptionalUser()) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="page-subtitle">Sign in to continue.</p>
        <div className="card mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
