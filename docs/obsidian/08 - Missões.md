# Missões

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
