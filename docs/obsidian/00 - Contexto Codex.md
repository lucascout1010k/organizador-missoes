# Contexto Codex

## Atualização — 2026-10-20 / 3A concluída, publicação autorizada

3A implementada e validada: a home agora consome public.missions, com grupos Atrasadas/Hoje/Concluídas hoje, progresso real e conclusão segura/idempotente sem F5. America/Sao_Paulo preserva a estratégia existente. Backlog sem data e missões futuras ficam fora do foco diário; 2D.4 continua criando somente missões sem datas automáticas. Faculdade/PDF/IA, Auth e RLS permanecem intactos. Nenhuma migration.

Validação final: 547 testes locais, 42 checks remotos A/B e 53 checks Chrome; lint, TypeScript, build e diff-check aprovados. Produção npm audit zero; audit completo mantém 5 HIGH DEV preexistentes e não resolvidos. Usuário autorizou explicitamente publicar a 3A em origin/main com essa exceção em 2026-10-20. Fixtures remotas zeradas. Sem secrets. Regras, evidências e limites em [3A — validação](../3a-validacao.md).

### Registro anterior


## Atualização — 2026-10-20 / 2D.4 concluída

A 2D.4 está implementada e validada: seleção explícita de sugestões persistidas, revisão de título/descrição/prioridade/minutos e confirmação antes de qualquer missão real. A IA nunca cria missão automaticamente. O vínculo analysis → suggestion_index → mission fica em academic_analysis_mission_links; a missão continua em missions. Origin ai/null preserva o schema anterior. Dashboard/Agenda ainda não consultam missions; nenhuma página nova foi inventada. O bloco Faculdade/PDF/IA tem o fluxo autorizado concluído funcionalmente, com publicação em origin/main autorizada e audit DEV preexistente mantido como pendência não resolvida.

Validação: 496 testes locais (57 novos), 52 checks runtime A/B reais, 19 assertions SQL com rollback, 24 checks Chrome + 6 de teclado/foco, cleanup zerado em 12 categorias. Lint, TypeScript, build Webpack e diff-check aprovados. Audit de produção zero; audit completo mantém 5 HIGH dev preexistentes sem patch compatível. Publicação em origin/main autorizada explicitamente pelo usuário com os 5 HIGH DEV preexistentes mantidos como pendência não resolvida; produção permanece com zero vulnerabilidades. Evidências e limitações em [2D.4 — validação](../2d4-validacao.md).

### Registro anterior

## Atualização — 2026-10-14 / 2D.3 validada

2D.3 implementada e validada, com consentimento explícito para analisar somente PDF próprio READY. Upload/finalize param em ready; page load/refresh nunca chamam IA. A análise produz resumo, tópicos, palavras-chave, exercícios/respostas, sugestões textuais de estudo e limitações. Nenhuma escrita em missions ou agenda, nenhum OCR/RAG/chat/Files API/tools.

Evidências finais: 439 testes locais aprovados, incluindo 66 de IA e 2 novos do driver JSON. Integração com provider simulado: 81 checks principais, 8 de lease stale, 37 no Chromium, 15 de remoção Storage e 6 pelo pooler (4 negações de CRUD em analyses), além de 11 assertions SQL de claims/consentimento com rollback e 5 invariantes remotas. Gemini real: dois PDFs fictícios, acadêmico e hostil, processados por gemini-3.8-flash via Interactions API; 30 checks de schema, conteúdo acadêmico não vazio, persistência, reutilização, A/B e anon. A UI dos resultados reais passou em mais 28 checks desktop/mobile, sem chamadas automáticas no carregamento/refresh. Cleanup final: 8 checks pela fronteira/Storage e zero resíduos nas dez categorias remotas; credenciais temporárias de teste removidas. Lint, TypeScript, build e diff-check aprovados. Scanner confirmou ausência dos valores reais das credentials Gemini/validator no código e bundles do browser, e placeholders vazios no exemplo. npm audit de produção: zero; audit completo: 5 HIGH preexistentes na cadeia dev ESLint/fast-glob/micromatch/braces, sem correção compatível publicada; downgrade incompatível sugerido pelo npm não aplicado.

2D.3 implementada e validada, pronta para publicação autorizada em origin/main. As duas interrupções externas foram resolvidas: conector Supabase reconectado e credential Gemini corrigida localmente/aceita pelo Google. Nenhum dado pessoal real foi usado nos testes. Não iniciar 2D.4 nesta rodada; criação de missão continua reservada à próxima etapa. Vercel não foi configurada.

### Registro anterior

## Atualização — 2026-10-14 / 2D.2D concluída

A 2D.2D concluiu a interface de Materiais no detalhe da matéria: listagem por proprietário/matéria, DTO mínimo, estados amigáveis, abrir/baixar PDF ready, confirmação de exclusão e retry. A atualização usa router.refresh após upload/finalize/delete/retry. Base publicada da 2D.2C: 30722ebed92ab4caa30856ac6130fb61f25c3207. A publicação desta etapa foi autorizada exclusivamente após todos os gates e cleanup. Nenhuma IA/OCR/Gemini, redesign global ou configuração da Vercel foi incluída.

Validação: 371 testes locais aprovados (48 novos), lint, TypeScript, build e diff-check aprovados. 130 checks runtime/browser selecionados: 48 positivos da rodada inicial, 28 da continuação, 5 de recuperação após expiração natural, 15 de cleanup pela fronteira e 34 no Chromium; mais 11 assertions SQL de claims/ownership em transação com rollback. Um argumento incorreto do harness de report foi corrigido e seu check falho foi excluído dessa contagem. A/B e anonymous reais, PATCH/DELETE diretos negados, RPC privada negada, concorrência, URLs assinadas e bytes reais exercitados. Remoção incerta foi injetada de forma controlada, sem afirmar falha natural do provider. Cleanup confirmou zero usuários, identities, sessions, materiais, attempts, analyses, matérias, períodos, cursos e objetos fictícios; credentials temporárias removidas.

### Registro anterior

## Atualização — 2026-10-14 / 2D.2C validada

A 2D.2C foi implementada e validada. A migration 2D.2C.1, aplicada manualmente, permanece imutável; a corretiva `20261014161215_remover_dependencia_auth_executor_materiais.sql` foi aplicada via MCP para ler claims PostgREST diretamente, sem auth.uid()/auth.jwt() no executor. Prepare usa oito colunas; report usa RPC restrita.

Validação: 323 testes locais; 73 checks da rodada runtime principal + 11 de recuperação + 7 de cleanup Storage = 91 checks, além de três suítes SQL de fronteira/claims/transições e testes pelo pooler. A/B usou duas contas controladas reais. MIME divergente e erro transitório foram injetados de modo controlado sobre o fluxo/infraestrutura real; não se afirma que o provider produziu naturalmente essas falhas. Cinco attempts validated foram comparadas ao SHA-256/tamanho exatos do PDF fictício. Cleanup administrativo confirmou zero usuários, identities, sessions, metadata, attempts, dados acadêmicos e objetos Storage de teste. Credenciais temporárias removidas. Finalize e UI mínima estão ligados; PDF válido promove ready somente após evidência atômica. A validator LOGIN foi autorizada após revisão do runtime sem TEMP, conectada via pooler com TLS verificado e credential somente em .env.local. IA/Gemini/OCR/redesign permanecem fora do escopo. Commit/push dependem dos gates finais desta rodada; Vercel não foi configurada.

### Registro anterior

## Estado atual

As Etapas 0A, 0B, 1A, 1B, 1C, 1D, 2A, 2B, 2C, 2D.1, 2D.2A e 2D.2B foram concluídas. A fundação em Next.js está publicada no repositório GitHub público `lucascout1010k/organizador-missoes`, com a branch principal `main`; a publicação da 2D.2B depende de autorização específica para push.

O projeto Supabase está configurado localmente somente com Project URL e publishable key. A Etapa 1B implementou autenticação privada por e-mail e senha, sessão SSR, proteção de rotas e logout. O cadastro público está desabilitado externamente no Supabase e não foi implementado na aplicação. O uso atual é single-user, sem e-mail fixo no código, mantendo preparação para multi-user.

A fundação de dados da Etapa 1C está implementada: migration aplicada manualmente no Supabase, seis tabelas com RLS e grants explícitos e 81 checks de integração aprovados com sessão do usuário e publishable key. A Etapa 1D implementou e validou a interface funcional da Faculdade. A Etapa 2A transformou a home em um Dashboard visual responsivo e estabeleceu a identidade dark premium em navy, azul e verde do shell privado. A Etapa 2B aplicou essa mesma identidade à central da Faculdade, com métricas acadêmicas reais, matérias, provas em 30 dias, aulas da semana, histórico e estados vazios responsivos. A Etapa 2C redesenhou o detalhe da matéria na mesma identidade, priorizando próxima prova, conclusão real das aulas, cronologia, tópicos e ações acadêmicas existentes, com composição própria para desktop e mobile.

A Etapa 2D.1 implementou somente a fundação segura de Materiais: tabelas `academic_materials` e `academic_material_analyses`, bucket privado `academic-materials`, PDF de até 6 MiB, caminho canônico por usuário/matéria/material, RLS e ciclo de exclusão controlado. As duas migrations foram aplicadas manualmente e o runtime real passou em 38/38 verificações, incluindo signed upload, isolamento entre duas contas, negação anônima e cleanup integral. Naquela etapa não foram implementados frontend, processamento de PDF ou integração de IA; `missions` permaneceu inalterada. Academia e Projetos continuam planejados. A Vercel continua não configurada e qualquer próxima etapa depende de autorização.

A Etapa 2D.2A evoluiu somente o contrato de Storage e a máquina de estados. `academic_materials.file_status` passou a admitir `validating`; em `pending_upload`, a policy de `SELECT` do objeto permite acesso apenas durante a operação interna `storage.object.upload`, enquanto a leitura normal continua negada. A leitura técnica do proprietário é admitida em `validating`, `ready` e `deleting`, mas a futura UI continuará abrindo ou baixando arquivos exclusivamente em `ready`. O runtime real aprovou 93/93 checks principais, 8/8 de isolamento A/B e 23/23 de cleanup, com negação anônima e zero erros. A arquitetura da aplicação não usará token de signed upload; o upload autenticado padrão Browser → Supabase Storage foi reservado para a 2D.2B. As migrations 2D.1 permanecem imutáveis; a 2D.2A não implementou frontend, upload/finalize ou IA.

A subetapa 2D.2B.1 foi aprovada: contratos, validação server-side e Server Action `prepareMaterialUpload`, que deriva a identidade de `auth.getClaims()`, verifica matéria/aula por proprietário, gera UUID e path canônico no servidor e insere somente metadata `pending_upload`. Seus 66 testes locais preservam a distinção entre erro técnico de claims (`PREPARE_FAILED`) e resposta normal sem identidade válida (`AUTH_REQUIRED`).

A 2D.2B.2 foi aprovada após implementação local: formulário mínimo no detalhe da matéria, seleção de um PDF em memória e upload autenticado direto Browser → Supabase Storage, com bucket fixo, path retornado pelo prepare e `upsert: false`. O envio bem-sucedido continua `pending_upload`, com mensagem de validação pendente e sem abertura/download. `reportMaterialUploadFailure` reautentica e altera somente material próprio ainda `pending_upload` para `upload_failed`; erro incerto não dispara report nem retry. Foram aprovados 245 testes locais com dependências simuladas e renderização local do formulário, sem upload ou fixtures remotas. Finalize, página visual final, exclusão e IA continuam não implementados; `missions`, Auth, RLS e migrations não foram alterados. Antes de considerar `ready` como prova de validação, a 2D.2C deverá estabelecer uma fronteira de escrita confiável para as transições.

O runtime 2D.2B foi concluído: 54 checks principais, incluindo simulações controladas e a limpeza inicial, 13 checks A/B e 15 checks de cleanup da rodada cruzada, totalizando 82/82 aprovados. O fluxo real é prepare → metadata `pending_upload` → upload Browser → Supabase Storage → UI "Arquivo enviado. Validação pendente.". O File não atravessa Next.js/Vercel; o bucket é fixo e `upsert: false`. Isolamento A/B, negação anônima e cleanup integral foram confirmados; dados e objetos temporários e diagnósticos foram removidos. Os 245/245 testes locais previamente aprovados permanecem a evidência local, sem repetição desnecessária do runtime principal.

A 2D.2B não implementa finalize, abertura/download ou exclusão funcional. Falhas incertas permanecem `pending_upload`; somente falhas explicitamente classificadas podem ser reportadas como `upload_failed`. Não houve escrita de `validating`/`ready` nem alteração de Auth/RLS/migrations/missions. `ready` ainda não representa fluxo funcional concluído ou prova confiável de validação. A referência `4. Materiais-PDF-IA` permanece reservada para uma etapa visual posterior; a 2D.2C e a IA não foram iniciadas.

## Regras aprovadas

Antes de qualquer implementação relevante:

1. Ler `00 - Contexto Codex.md`.
2. Identificar quais notas estão relacionadas à missão.
3. Ler somente as notas relevantes.
4. Depois inspecionar somente os arquivos de código necessários.
5. Implementar a mudança.
6. Executar validações.
7. Atualizar as notas afetadas.
8. Atualizar `20 - Histórico.md` quando houver mudança relevante.
9. Informar no relatório as notas consultadas, notas modificadas, arquivos modificados e testes executados.

O código executável é a fonte final da verdade técnica.

O Obsidian é o mapa documentado e atualizado dessa verdade.

Em caso de divergência, investigar o código e corrigir a documentação.

Nunca modificar código apenas para fazê-lo coincidir com documentação desatualizada.

O repositório será público. Não registrar segredos, PII nem dados pessoais reais; exemplos devem ser fictícios.

## Pendências

Executar cada etapa futura somente após aprovação.

## Ideias futuras

Evoluir o segundo cérebro junto com o código e registrar decisões arquiteturais relevantes.
