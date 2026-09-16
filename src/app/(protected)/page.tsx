import { logout } from "./actions";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-2xl rounded-3xl border border-emerald-950/10 bg-white p-10 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Organizador pessoal
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-emerald-950">
          Painel de Missões
        </h1>
        <p className="mt-4 text-lg text-slate-600">Sessão autenticada.</p>

        <form action={logout} className="mt-8">
          <button
            className="rounded-xl border border-emerald-800 px-4 py-2 font-semibold text-emerald-900 transition hover:bg-emerald-50"
            type="submit"
          >
            Sair
          </button>
        </form>
      </section>
    </main>
  );
}
