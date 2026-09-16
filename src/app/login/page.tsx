import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (typeof data?.claims?.sub === "string") {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <LoginForm />
    </main>
  );
}
