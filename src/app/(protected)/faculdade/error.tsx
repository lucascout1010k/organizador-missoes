"use client";

export default function FacultyError({ reset }: { reset: () => void }) {
  return (
    <div className="page-wrap">
      <section className="empty-state">
        <span className="empty-mark">!</span>
        <h1>Não foi possível carregar a Faculdade</h1>
        <p>Verifique sua conexão e tente novamente. Seus dados não foram alterados.</p>
        <button className="button button-primary" onClick={reset} type="button">
          Tentar novamente
        </button>
      </section>
    </div>
  );
}
