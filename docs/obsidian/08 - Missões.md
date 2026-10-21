# Missões

## Atualização — 2026-10-21 / 2E.2 — recuperação semântica validada

A recuperação semântica 2E.2 não cria nem altera missões. Resposta é texto com fontes controladas e limitações; nenhuma ferramenta/ação é concedida ao modelo. Hostile real aprovado sem ações. Conversão de sugestões da análise individual continua no fluxo 2D.4 com revisão e confirmação humana.

Evidências, arquitetura, custo, segurança e limites em [2E.2 — validação](../2e2-validacao.md). Entradas anteriores são históricas; esta atualização define o estado atual.

## Atualização — 2026-10-21 / 2E.1 — memória acadêmica da matéria

A memória da matéria lista pendências pelos vínculos reais analysis → material → mission da 2D.4 e pelas origens subject/class_session/exam compatíveis. Não compara títulos. Mostra contadores de pendentes/concluídas e até cinco pendências; completed não é pendente. Tombstones sem mission_id não recriam missões. Sugestões e sua revisão/confirmação continuam no detalhe do material; nenhuma missão é criada ao abrir matéria ou material.

Validação e limites da rodada em [2E.1 — validação](../2e1-validacao.md). As entradas anteriores abaixo são históricas; esta atualização define o estado atual.

## Atualização — 2026-10-20 / 3A concluída, publicação autorizada

Dashboard é consumidor real de missions. planned/in_progress/postponed podem ser concluídas; missed fica no histórico e não entra no foco/transição. Conclusão grava completed_at server-side e é idempotente. Não havia fluxo seguro de reabertura: desfazer fica para etapa própria. Missões sem data, inclusive conversões 2D.4, permanecem backlog; nenhuma data automática ou cópia no Dashboard.

Validação final: 547 testes locais, 42 checks remotos A/B e 53 checks Chrome; lint, TypeScript, build e diff-check aprovados. Produção npm audit zero; audit completo mantém 5 HIGH DEV preexistentes e não resolvidos. Usuário autorizou explicitamente publicar a 3A em origin/main com essa exceção em 2026-10-20. Fixtures remotas zeradas. Sem secrets. Regras, evidências e limites em [3A — validação](../3a-validacao.md).

### Registro anterior


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
