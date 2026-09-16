"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 1024;

export type LoginState = {
  error: string | null;
};

function readCredentials(formData: FormData) {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");

  if (typeof emailValue !== "string" || typeof passwordValue !== "string") {
    return null;
  }

  const email = emailValue.trim();

  if (
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email) ||
    passwordValue.length === 0 ||
    passwordValue.length > MAX_PASSWORD_LENGTH
  ) {
    return null;
  }

  return { email, password: passwordValue };
}

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const credentials = readCredentials(formData);

  if (!credentials) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      return { error: GENERIC_LOGIN_ERROR };
    }
  } catch {
    return { error: GENERIC_LOGIN_ERROR };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
