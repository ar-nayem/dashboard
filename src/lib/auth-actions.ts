"use server";

import { redirect } from "next/navigation";
import { getStoredPasswordHash, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

const WRONG_PASSWORD_ERROR = "Incorrect password.";

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const storedHash = await getStoredPasswordHash();

  // Same message whether the hash is unset or the password is wrong — no
  // signal about which.
  if (!storedHash || !verifyPassword(password, storedHash)) {
    return { error: WRONG_PASSWORD_ERROR };
  }

  await createSession();
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
