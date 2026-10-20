# Missões

## Atualização — 2026-10-20 / 2D.4 concluída

Sugestões de análise completed podem virar missões reais somente após seleção, revisão e confirmação. Cada missão tem category academic, status planned, origin_type ai e origin_id null; a autoridade de proveniência é o vínculo analysis/material/suggestion_index. Campos finais respeitam título 200, descrição 20000, enum de prioridade e integer positivo para minutos. Sem data automática. Retries e edições de título não mudam identidade; exclusão posterior preserva tombstone. Missões manuais continuam com o CRUD anterior. Não existe ainda UI geral de listagem/transição ou rota individual de missão.

Validação: 496 testes locais (57 novos), 52 checks runtime A/B reais, 19 assertions SQL com rollback, 24 checks Chrome + 6 de teclado/foco, cleanup zerado em 12 categorias. Lint, TypeScript, build Webpack e diff-check aprovados. Audit de produção zero; audit completo mantém 5 HIGH dev preexistentes sem patch compatível. Publicação em origin/main autorizada explicitamente pelo usuário com os 5 HIGH DEV preexistentes mantidos como pendência não resolvida; produção permanece com zero vulnerabilidades. Evidências e limitações em [2D.4 — validação](../2d4-validacao.md).

### Registro anterior

## Estado atual

Etapa 1C implementada: tabela `missions` aplicada no Supabase e validada com CRUD próprio, negações de acesso, constraints e origens acadêmicas. Os dados fictícios de teste foram removidos. A interface e a automação de missões ainda não foram implementadas.

## Regras aprovadas

Missão é a entidade universal e central: uma atividade do usuário, independentemente de sua categoria. Categorias: `academic`, `gym`, `project`, `personal`. Estados: `planned`, `in_progress`, `completed`, `postponed`, `missed`. Prioridades: `low`, `medium`, `high`.

Cada missão possui `user_id`, título, descrição opcional, planejamento (`scheduled_for`), prazo (`due_at`), duração estimada positiva e timestamps. Uma missão concluída exige `completed_at`; os demais estados exigem esse campo nulo. Os horários usam `timestamptz` e a interface futura converterá para o fuso do usuário.

`origin_type` e `origin_id` identificam a origem. Origens acadêmicas (`subject`, `class_session`, `exam`) exigem referência existente do mesmo usuário e categoria acadêmica. Colunas geradas internas permitem impor essas FKs sem confiar no cliente. Origem manual não possui `origin_id`; `pdf`, `ai`, `gym` e `project` são rótulos reservados e ainda não aceitam IDs, pois suas entidades não existem nesta etapa.

IA nunca cria compromisso silenciosamente. Ela poderá sugerir; o usuário confirma antes da criação de uma missão. As categorias futuras não significam que os módulos de Academia e Projetos estejam implementados.

## Pendências

Definir em etapas futuras autorizadas a interface, as transições de negócio e as regras de adiamento, recorrência e confirmação de sugestões.

## Ideias futuras

Motivos de adiamento e histórico de alterações.
