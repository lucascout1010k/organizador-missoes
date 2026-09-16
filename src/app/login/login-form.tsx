"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, INITIAL_STATE);

  return (
    <form
      action={formAction}
      className="w-full max-w-md space-y-5 rounded-3xl border border-emerald-950/10 bg-white p-8 shadow-sm"
    >
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-emerald-950" htmlFor="email">
          E-mail
        </label>
        <input
          autoComplete="email"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={isPending}
          id="email"
          maxLength={254}
          name="email"
          required
          spellCheck={false}
          type="email"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-emerald-950" htmlFor="password">
          Senha
        </label>
        <input
          aria-describedby={state.error ? "login-error" : undefined}
          autoComplete="current-password"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={isPending}
          id="password"
          maxLength={1024}
          name="password"
          required
          type="password"
        />
      </div>

      {state.error ? (
        <p aria-live="polite" className="text-sm font-medium text-red-700" id="login-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        aria-busy={isPending}
        className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        Entrar
      </button>
    </form>
  );
}
