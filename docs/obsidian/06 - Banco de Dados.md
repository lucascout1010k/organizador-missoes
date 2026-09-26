# Banco de Dados

## Estado atual

O projeto Supabase foi criado na região South America (São Paulo). A migration `supabase/migrations/20260916124208_criar_fundacao_academica_e_missoes.sql` foi aplicada manualmente no SQL Editor, com confirmação do usuário. As seis tabelas foram acessadas pela integração autenticada e os 81 checks passaram.

As migrations `20260918114607_criar_materiais_academicos_e_storage_privado.sql` e `20260918155614_corrigir_policies_storage_exclusao_materiais_academicos.sql` também foram aplicadas manualmente. Elas criam a fundação 2D.1 e reconciliam o ciclo de remoção do Storage. O helper `supabase/tests/materials-foundation-checks.ts` permanece versionado; 33 checks runtime e 5 checks de cleanup passaram. Ao final, as duas tabelas de materiais ficaram vazias, as fixtures acadêmicas foram removidas e nenhum objeto de teste permaneceu no bucket.

A migration `20260924113838_adicionar_validating_e_select_storage_operation_aware.sql` foi aplicada manualmente na Etapa 2D.2A, sem modificar as migrations 2D.1. Ela adiciona `validating` à constraint de `file_status` e recria somente a policy `academic_materials_storage_select`. O runtime aprovou 93/93 checks principais, 8/8 de isolamento A/B e 23/23 de cleanup; ao final, não restaram materiais, análises, fixtures acadêmicas ou objetos de teste.

## Regras aprovadas

PostgreSQL via Supabase, com exposição automática de tabelas desativada no projeto. Toda tabela privada nasce com UUID como chave primária, `user_id NOT NULL REFERENCES auth.users(id)`, RLS explícita e grants mínimos. O default de `user_id` é `auth.uid()`, mas a segurança é imposta pelas policies, não pelo default.

### Modelo aplicado

| Tabela | Conteúdo e relacionamento |
| --- | --- |
| `academic_courses` | Curso com nome e status; raiz do histórico acadêmico. |
| `academic_periods` | Curso obrigatório, nome, número, ano, termo, status e datas inicial/final opcionais. |
| `subjects` | Período obrigatório, nome, código opcional e status. |
| `class_sessions` | Matéria obrigatória, título, data/hora, notas opcionais e status. |
| `exams` | Matéria obrigatória, título, data/hora, tópicos `text[]`, notas opcionais e status. |
| `missions` | Entidade universal: título, descrição, categoria, estado, prioridade, agenda, prazo, estimativa e origem opcional. |
| `academic_materials` | Metadata do PDF, matéria obrigatória, aula opcional compatível, caminho privado e ciclo do arquivo. |
| `academic_material_analyses` | Tentativas futuras de análise, consentimento, provedor/modelo, estado, resultado ou erro. A integração de IA ainda não existe. |

Não há `profiles`, integração de IA, tabelas de academia ou projetos. Categorias e rótulos de origem reservados não representam implementação desses módulos. `missions` não foi alterada pela Etapa 2D.1.

### Materiais e Storage — estado após a Etapa 2D.2A

- `academic_materials` aceita somente `application/pdf`, tamanho entre 1 byte e 6 MiB e caminho canônico `<user_id>/<subject_id>/<material_id>/source.pdf`.
- Estados do arquivo: `pending_upload`, `validating`, `ready`, `upload_failed`, `deleting` e `deleted`. `deleted_at` deve existir exatamente no estado `deleted`.
- O material pertence a uma matéria do mesmo proprietário. A aula é opcional, mas, quando presente, deve pertencer ao mesmo usuário e à mesma matéria.
- `academic_material_analyses` admite `processing`, `completed` e `failed`, com constraints para coerência de `result`, `error_code`, `completed_at` e cronologia do consentimento. Apenas uma tentativa `processing` pode existir por material.
- Ambas as tabelas têm RLS habilitada e forçada, policies próprias e grants CRUD apenas para `authenticated`.
- O bucket `academic-materials` é privado, limitado a 6291456 bytes e ao MIME `application/pdf`.
- Storage possui policies de `INSERT`, `SELECT` e `DELETE`; não existe policy de `UPDATE`. `INSERT` exige `pending_upload`; `DELETE` exige `deleting`. Em `pending_upload`, `SELECT` é permitido somente quando `storage.allow_only_operation('storage.object.upload')` confirma a operação interna de upload. A leitura normal aceita `validating`, `ready` e `deleting` para o proprietário.
- A aplicação deve reler a metadata e exigir `ready` com `deleted_at is null` antes de abrir ou servir download/preview. A visibilidade técnica de `validating` e `deleting` não é autorização funcional da UI.
- O upload autenticado padrão Browser → Supabase Storage está planejado para a 2D.2B. A arquitetura da aplicação não usará signed upload token.
- Fluxo de exclusão: `ready`/`pending_upload`/`upload_failed` → `deleting` → remover objeto → `deleted` com `deleted_at` → hard delete opcional.

### Integridade e histórico

- Curso → Períodos → Matérias → Aulas e Provas. Concluir ou arquivar não remove registros nem os oculta por RLS.
- FKs de domínio incluem `user_id` e o ID do pai, com chaves únicas `(user_id, id)` nas tabelas referenciadas. Isso impede vínculos entre proprietários diferentes.
- Exclusão de pais com dependentes usa `NO ACTION`: exige tratar os filhos explicitamente, preservando o histórico contra exclusão em cascata acidental. Prefere-se arquivamento.
- Exclusão de uma conta pelo Auth usa `ON DELETE CASCADE` em todas as tabelas privadas. Essa operação administrativa não é implementada pela aplicação nem faz parte dos testes.
- Nomes e títulos não podem ser vazios e têm limite de 200 caracteres. Notas e descrições têm limite de 20 mil caracteres; código tem até 50, termo até 100.
- Número do período e minutos estimados são positivos quando informados; ano fica entre 1 e 9999; data final não pode preceder a inicial quando ambas existem.
- Estados, categorias e prioridades usam `text` com `CHECK`. Os valores permitidos estão nas notas de Faculdade e Missões e no SQL.
- `topics` aceita lista vazia ou vetor unidimensional, sem itens nulos, com até 100 itens e 20 mil caracteres no total.
- Datas do período usam `date`; aulas, provas, missões e timestamps usam `timestamptz`. A interface futura será responsável pela apresentação no fuso do usuário.
- `completed_at` só existe quando a missão está `completed`, e é obrigatório nesse estado. Alterações de status devem atualizar esse campo na mesma operação.

### Origens de missões

`origin_type` e `origin_id` são opcionais. Origens `subject`, `class_session` e `exam` exigem ID existente do mesmo proprietário e categoria `academic`.

Três colunas geradas armazenadas (`origin_subject_id`, `origin_class_session_id`, `origin_exam_id`) derivam o ID conforme o tipo e sustentam FKs compostas reais. Clientes não devem tentar gravá-las. Origens nulas, manuais ou reservadas (`pdf`, `ai`, `gym`, `project`) exigem `origin_id` nulo até existir modelagem específica.

### Timestamps

Todas as tabelas possuem `created_at` e `updated_at`. Uma função compartilhada `app_private.set_updated_at()` mantém `created_at` inalterado durante UPDATE e redefine `updated_at` pelo relógio do banco. Os defaults de INSERT são `now()`; os timestamps não constituem trilha de auditoria inviolável.

A função é `SECURITY INVOKER`, tem `search_path` vazio e não consulta outras tabelas. Schema e função não têm privilégios concedidos a `PUBLIC`, `anon` ou `authenticated`. As seis triggers são criadas pela migration, sem conceder poder de criar triggers aos clientes.

### Índices

Além de PKs e cinco chaves únicas compostas, há 16 índices explícitos, sempre começando por `user_id`: status; curso/número do período; período da matéria; matéria/data da aula; matéria e data da prova; agendamento e prazo da missão. Origens de missão têm índices parciais por proprietário e ID não nulo. As referências de domínio têm índices no lado dos filhos.

### RLS e grants

Cada tabela possui `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` e quatro policies para `authenticated`: SELECT/DELETE com `USING`, INSERT com `WITH CHECK` e UPDATE com ambos. Todas comparam `(select auth.uid()) = user_id`.

São revogados os privilégios de tabela para `PUBLIC`, `anon` e `authenticated`; depois são concedidos somente SELECT, INSERT, UPDATE e DELETE a `authenticated`, além de USAGE no schema `public`. Não há policies anônimas nem RPC privilegiada. CRUD próprio passou; operações anônimas e INSERT/UPDATE com proprietário divergente retornaram `42501` nas seis tabelas. A revisão estática complementa os testes; não foi utilizada segunda conta real.

### Aplicação manual

Executar o arquivo completo uma única vez no SQL Editor do projeto correto. A migration usa `BEGIN`/`COMMIT`, não contém registros pessoais e notifica o PostgREST para recarregar o schema. Não executar trechos isolados nem remover constraints para contornar erro. Se houver erro, interromper e investigar antes de tentar novamente.

O arquivo não é idempotente: uma segunda execução deve falhar, evitando mascarar divergência estrutural. Aplicação pelo SQL Editor não registra automaticamente a versão no histórico do Supabase CLI. Antes de um futuro `db push`, reconciliar o histórico com o schema efetivamente aplicado; não reaplicar esta migration cegamente.

## Pendências

- Reconciliar histórico de migrations antes de futura adoção do Supabase CLI.
- Implementar frontend e o fluxo autenticado de upload/finalize somente na 2D.2B autorizada; a 2D.2A preparou apenas banco e Storage.
- Implementar análise por IA somente em etapa posterior e explicitamente autorizada.

## Ideias futuras

Histórico auditável das mudanças importantes de missões, PDFs vinculados a aulas e sugestões de estudo confirmadas pelo usuário. Evoluir somente em etapas autorizadas.
