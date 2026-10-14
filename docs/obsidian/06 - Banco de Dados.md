# Banco de Dados

## Atualização — 2026-10-14 / 2D.3 validada

Schema real auditado antes da implementação: analyses tinha consent_version/consented_at, schema_version smallint, resultado JSONB limitado a 131072 bytes, RLS/FORCE e índice parcial único processing por user/material, mas INSERT/UPDATE/DELETE amplo para authenticated. Tabela estava vazia. Aplicada a migration 20261014191625_proteger_analises_academicas_ia.sql (SHA-256 c920759acbb80ea244fb928bcfe41cd4b89a116b62c389ec23aa1e688d0ebeb4): revoga mutação de clientes e adiciona lease_expires_at/completion_token_hash ocultos, RPC de início e completion/failure privadas com token/lease/locks. SELECT cliente é limitado a colunas para DTO. Executor recebe somente a escrita necessária em analyses; validator continua sem CRUD genérico.

O método apply_migration falhou com sessão expirada; a mesma SQL integral foi aplicada por execute_sql e a versão/fonte foram registradas em supabase_migrations.schema_migrations. Não reaplicar. Migrations 2D.2C/2D.2D não foram editadas. schema_version=1 representa academic-material-analysis-v1. Consentimento usa gemini-pdf-analysis-consent-v1 e timestamp derivado do servidor, sem IP.

Lock material → analysis, índice único, lease de até 180 segundos limitada pelo JWT (mínimo 90 segundos restantes), token de 32 bytes guardado somente como hash. Processing ativo reutiliza; completed atual reutiliza sem provider; failed/stale só recebe nova tentativa por ação explícita. Token antigo fica inválido. Completion reexige ready e persiste atomicamente JSON validado/model real/completed_at, limpando hash/lease. Nenhuma transação fica aberta durante Gemini.

Evidências finais: 439 testes locais aprovados, incluindo 66 de IA e 2 novos do driver JSON. Integração com provider simulado: 81 checks principais, 8 de lease stale, 37 no Chromium, 15 de remoção Storage e 6 pelo pooler (4 negações de CRUD em analyses), além de 11 assertions SQL de claims/consentimento com rollback e 5 invariantes remotas. Gemini real: dois PDFs fictícios, acadêmico e hostil, processados por gemini-3.8-flash via Interactions API; 30 checks de schema, conteúdo acadêmico não vazio, persistência, reutilização, A/B e anon. A UI dos resultados reais passou em mais 28 checks desktop/mobile, sem chamadas automáticas no carregamento/refresh. Cleanup final: 8 checks pela fronteira/Storage e zero resíduos nas dez categorias remotas; credenciais temporárias de teste removidas. Lint, TypeScript, build e diff-check aprovados. Scanner confirmou ausência dos valores reais das credentials Gemini/validator no código e bundles do browser, e placeholders vazios no exemplo. npm audit de produção: zero; audit completo: 5 HIGH preexistentes na cadeia dev ESLint/fast-glob/micromatch/braces, sem correção compatível publicada; downgrade incompatível sugerido pelo npm não aplicado.

2D.3 implementada e validada, pronta para publicação autorizada em origin/main. As duas interrupções externas foram resolvidas: conector Supabase reconectado e credential Gemini corrigida localmente/aceita pelo Google. Nenhum dado pessoal real foi usado nos testes. Não iniciar 2D.4 nesta rodada; criação de missão continua reservada à próxima etapa. Vercel não foi configurada.

### Registro anterior

## Atualização — 2026-10-14 / 2D.2D concluída

Nova migration aplicada via MCP: 20261014183256_permitir_exclusao_confiavel_material_proprio.sql. SHA-256: 56d3159b04970affda42e0aeda94661dbcb1a2f9263d0566c2529843e0c56285. Acrescenta somente public.request_material_deletion(uuid), ownership-bound, executável por authenticated; PUBLIC/anon/validator sem EXECUTE. Lock da metadata antecede attempts, como na fronteira existente. Material próprio sem lease ativa entra em deleting; deleting/deleted são idempotentes. Não modifica as seis funções privadas, grants de tabelas, bucket ou policies. Expiração e fencing continuam no issuer existente.

As duas migrations aplicadas da 2D.2C permanecem byte a byte intactas, com SHA-256 2cf5a1a20efab06d774fd94c01b248e21e1c517da6a33c580321b3082fb176ff e 7150248dab4a325b9b46e4a1a0a0de58219198e44ff1bd9a0f9954a8e894fc3d. Bucket continua privado, 6291456 bytes, application/pdf, sem UPDATE Storage. A migration manual original ainda precisa reconciliar o histórico antes de um futuro db push, sem reaplicação cega.

Validação: 371 testes locais aprovados (48 novos), lint, TypeScript, build e diff-check aprovados. 130 checks runtime/browser selecionados: 48 positivos da rodada inicial, 28 da continuação, 5 de recuperação após expiração natural, 15 de cleanup pela fronteira e 34 no Chromium; mais 11 assertions SQL de claims/ownership em transação com rollback. Um argumento incorreto do harness de report foi corrigido e seu check falho foi excluído dessa contagem. A/B e anonymous reais, PATCH/DELETE diretos negados, RPC privada negada, concorrência, URLs assinadas e bytes reais exercitados. Remoção incerta foi injetada de forma controlada, sem afirmar falha natural do provider. Cleanup confirmou zero usuários, identities, sessions, materiais, attempts, analyses, matérias, períodos, cursos e objetos fictícios; credentials temporárias removidas. O hard cleanup administrativo foi limitado às duas contas fictícias identificadas, depois de todos os objetos removidos pela API; nunca houve DELETE SQL de storage.objects.

### Registro anterior

## Atualização — 2026-10-14 / 2D.2C validada

A 2D.2C foi implementada e validada. A migration 2D.2C.1, aplicada manualmente, permanece imutável; a corretiva `20261014161215_remover_dependencia_auth_executor_materiais.sql` foi aplicada via MCP para ler claims PostgREST diretamente, sem auth.uid()/auth.jwt() no executor. Prepare usa oito colunas; report usa RPC restrita.

validation_attempts mantém capability hash, generation, lease limitada a 120 segundos/JWT e unicidade de tentativa ativa. A promoção ready e SHA-256/tamanho/pdf-signature-v1 são atômicos. Assinaturas, ownership, FORCE RLS e transições preservados. Grants SET/CREATE de provisionamento são temporários e removidos; memberships finais são somente ADMIN do provisionador, SET/INHERIT false. LOGIN da validator foi provisionado separadamente, com limites de statement/lock/idle e credential local ignorada. Não reaplicar migrations aplicadas. A versão manual da primeira migration ainda requer reconciliação do histórico CLI antes de um futuro db push. Validação: 323 testes locais; 73 checks da rodada runtime principal + 11 de recuperação + 7 de cleanup Storage = 91 checks, além de três suítes SQL de fronteira/claims/transições e testes pelo pooler. A/B usou duas contas controladas reais. MIME divergente e erro transitório foram injetados de modo controlado sobre o fluxo/infraestrutura real; não se afirma que o provider produziu naturalmente essas falhas. Cinco attempts validated foram comparadas ao SHA-256/tamanho exatos do PDF fictício. Cleanup administrativo confirmou zero usuários, identities, sessions, metadata, attempts, dados acadêmicos e objetos Storage de teste. Credenciais temporárias removidas.

### Registro anterior

## Estado atual

O projeto Supabase foi criado na região South America (São Paulo). A migration `supabase/migrations/20260916124208_criar_fundacao_academica_e_missoes.sql` foi aplicada manualmente no SQL Editor, com confirmação do usuário. As seis tabelas foram acessadas pela integração autenticada e os 81 checks passaram.

As migrations `20260918114607_criar_materiais_academicos_e_storage_privado.sql` e `20260918155614_corrigir_policies_storage_exclusao_materiais_academicos.sql` também foram aplicadas manualmente. Elas criam a fundação 2D.1 e reconciliam o ciclo de remoção do Storage. O helper `supabase/tests/materials-foundation-checks.ts` permanece versionado; 33 checks runtime e 5 checks de cleanup passaram. Ao final, as duas tabelas de materiais ficaram vazias, as fixtures acadêmicas foram removidas e nenhum objeto de teste permaneceu no bucket.

A migration `20260924113838_adicionar_validating_e_select_storage_operation_aware.sql` foi aplicada manualmente na Etapa 2D.2A, sem modificar as migrations 2D.1. Ela adiciona `validating` à constraint de `file_status` e recria somente a policy `academic_materials_storage_select`. O runtime aprovou 93/93 checks principais, 8/8 de isolamento A/B e 23/23 de cleanup; ao final, não restaram materiais, análises, fixtures acadêmicas ou objetos de teste.

A 2D.2B implementou e validou prepare, upload autenticado Browser → Supabase Storage e `reportMaterialUploadFailure`, sem migration ou alteração de RLS/Auth/grants. O resultado consolidado foi 82/82 checks (54 principais, 13 A/B, 15 cleanup); metadata e análises dos dados temporários ficaram em zero, sem objetos de teste residuais. As migrations aplicadas permanecem imutáveis.

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
- O upload autenticado padrão Browser → Supabase Storage foi implementado e validado na 2D.2B, sem signed upload token ou PDF atravessando Next.js/Vercel. Sucesso mantém `pending_upload` sem abertura/download; finalize ainda não existe. O report altera somente `pending_upload → upload_failed` do proprietário, com UPDATE condicional por ID, proprietário, estado e `deleted_at IS NULL`; não altera schema, grants ou policies. Falhas incertas preservam `pending_upload`. `ready` ainda não representa fluxo funcional concluído; uma fronteira confiável de escrita permanece pendente da 2D.2C.
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
- Página visual final e finalize continuam pendentes de autorização; o formulário mínimo e upload da 2D.2B já foram validados. A fronteira confiável das transições pertence à 2D.2C, ainda não iniciada.
- Implementar análise por IA somente em etapa posterior e explicitamente autorizada.

## Ideias futuras

Histórico auditável das mudanças importantes de missões, PDFs vinculados a aulas e sugestões de estudo confirmadas pelo usuário. Evoluir somente em etapas autorizadas.
