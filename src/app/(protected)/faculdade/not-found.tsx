import Link from "next/link";

export default function FacultyNotFound() {
  return (
    <div className="page-wrap">
      <section className="empty-state">
        <span className="empty-mark">404</span>
        <h1>Registro acadêmico não encontrado</h1>
        <p>O item pode não existir ou não estar disponível para esta sessão.</p>
        <Link className="button button-primary" href="/faculdade">Voltar para Faculdade</Link>
      </section>
    </div>
  );
}
