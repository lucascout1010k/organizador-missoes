# 2D.4 — sugestões de IA em missões

Estado em 2026-10-20: 2D.4 implementada e validada, com publicação em origin/main autorizada explicitamente pelo usuário. A autorização aceita a exceção do `npm audit` completo: cinco HIGH preexistentes de desenvolvimento permanecem abertos, documentados e não resolvidos. Produção permanece com zero vulnerabilidades; nenhum upgrade incompatível foi forçado.

## Arquitetura

`academic_analysis_mission_links` registra proprietário, análise, material, missão, índice e timestamp; não duplica o texto original. `UNIQUE(analysis_id,suggestion_index)` fixa a identidade mesmo após edição de título. FKs compostas validam proprietário e correspondência análise/material/missão. `missions` continua sendo a única fonte de missões reais.

`origin_type='ai'`, `origin_id=NULL`, categoria `academic`, estado `planned`. A constraint anterior de origens permanece. O vínculo é a autoridade de proveniência; o rótulo `ai` isolado não comprova conversão, pois o CRUD próprio anterior de missões permanece disponível. Nenhum campo de origem se torna obrigatório para missões manuais.

Exclusão de missão vinculada preserva o vínculo com `mission_id=NULL`: a sugestão continua consumida e o retry não a recria. FKs preservam a origem histórica contra hard delete isolado; exclusão administrativa de uma conta fictícia e seus filhos por cascade foi exercitada no cleanup.

## Fronteiras e atomicidade

A Server Action `createMissionsFromAnalysisSuggestions` recebe somente `analysisId`, índices e, opcionalmente, os quatro campos finais editáveis. Zod estrito rejeita extras em todos os níveis. O servidor valida `getClaims`, busca análise própria completed/schema v1, relê o resultado persistido com Zod, verifica material próprio ready/sem exclusão e valida os campos finais. Não aceita proprietário, material, missão, origem ou sugestão original como autoridade do browser.

Cada item chama a RPC pública invoker `create_analysis_suggestion_mission`, que delega para a função definer no schema privado `app_missions_private`. Seu proprietário é um executor específico NOLOGIN/NOINHERIT/NOBYPASSRLS, sem memberships, DDL persistente, service_role ou acesso ao schema gerenciado `auth`. Claims verificadas pelo PostgREST exigem sub UUID, role authenticated e exp numérico futuro; sub separado conflitante é rejeitado. As policies também restringem o proprietário e usam identidade calculada uma vez por consulta.

A função revalida análise, material, índice, sugestão persistida e campos finais. Bloqueia material antes de análise, compatível com a ordem de exclusão/completion existente. Missão e vínculo são inseridos na mesma transação; falha do segundo INSERT desfaz o primeiro. Respostas perdidas, double click, duas abas e retry consultam o vínculo existente. O lote tem transação por item e retorna `created`, `already_created` ou `failed` individualmente, sem esconder sucesso parcial.

Clientes não recebem INSERT/UPDATE/DELETE da tabela de vínculos nem poderes novos de CRUD nas tabelas existentes. Grants de `UPDATE(id)` do executor em materiais/análises servem exclusivamente aos row locks. As funções de conversão não atualizam esses IDs, estados do PDF ou conteúdo da análise. Executor/validator anteriores não receberam novas permissões.

Campos finais: título 1..200 code points após NFC/trim, descrição até 20000, prioridade low/medium/high e minutos inteiros 1..2147483647, conforme `integer` positivo existente. A sugestão original conserva os limites da análise v1. Conteúdo hostil permanece texto; não há HTML interpretado ou `dangerouslySetInnerHTML`.

## Migrations aplicadas

Arquivos locais foram alinhados às versões efetivamente registradas por `apply_migration`. Fontes locais e remotas foram comparadas por MD5 após normalizar CRLF e whitespace final, com igualdade nas três versões. Esse hash é somente evidência de correspondência, não assinatura de segurança.

| Versão | Finalidade | MD5 normalizado |
| --- | --- | --- |
| `20261020202827` | Tabela, FKs, grants, RLS e conversão atômica | `029281a931b484ede49c951b0bac6caf` |
| `20261020204757` | Remover dependência de auth.uid/schema gerenciado | `d11e303d43ca3e7c903db846f3a2e86c` |
| `20261020205231` | InitPlan nas policies e comparação UUID indexável | `4c5403512273dd6f58c817ce0a2821d5` |

A primeira migration foi validada com rollback e aplicada. O primeiro runtime positivo revelou que grants em `auth` não são delegados ao provisionador, e a criação foi negada sem gravar missão. A corretiva foi validada com rollback e aplicada com `ALTER POLICY`, preservando policies durante a troca. Tentativas anteriores de substituir policies com DROP retornaram `Invalid or expired requestState`, sem confirmação de execução; a versão com DROP não foi aplicada nem versionada. Nenhuma migration anterior à 2D.4 foi editada.

## UI e integração

Na seção Sugestões de estudo: checkbox real por sugestão, título/descrição/minutos/prioridade, revisão de uma ou várias, quatro campos editáveis e botão final explícito. Selecionar, revisar, carregar e atualizar a página não criam missão. Request em andamento desabilita controles; estados e erros usam texto/aria-live, foco visível e labels explícitos. A seleção tem trava síncrona contra double click.

Conversões são carregadas do banco no DTO mínimo e reaparecem como “Adicionada às missões” após refresh. O resultado imediato também atualiza o estado local. Falha por item mantém a revisão para retry; nenhuma resposta bruta SQL/provider é mostrada.

Datas opcionais foram avaliadas: o schema possui scheduled_for/due_at, mas esta conversão os deixa nulos. Não há data automática. A auditoria confirmou que Dashboard Hoje/WeekAgenda consultam dados acadêmicos e provas, sem consultas a missions; não existe listagem funcional de missões nem rota individual. Por isso não foram inventadas integração, página ou ação “Ver missão”. Consultas normais a `missions` retornaram os registros criados. Integração visual geral de Missões/Agenda continua pendente de etapa própria.

## Evidências

Os gates locais e ambos os audits foram repetidos após a autorização explícita de publicação, com os mesmos resultados: 496/496, lint/TypeScript/build/diff aprovados, produção zero e audit completo com os cinco HIGH DEV preexistentes ainda abertos.

| Validação | Resultado |
| --- | --- |
| Testes locais existentes + novos | 496/496, sendo 57 novos |
| Runtime remoto final com sessões reais A/B e publishable key | 52/52 |
| Assertions SQL com rollback | 19/19 |
| Chrome headless na aplicação em produção | 24/24 |
| Revisão adicional de teclado/foco/validação | 6/6 |
| Categorias de cleanup remoto | 12/12 zeradas |
| Lint | aprovado |
| TypeScript sem emissão | aprovado |
| Build de produção | aprovado com Webpack |
| Diff whitespace | aprovado |
| npm audit de produção | zero vulnerabilidades |
| npm audit completo | 5 HIGH preexistentes, exclusivamente dev; exit 1 |

Runtime remoto final repetido após a otimização de RLS em outra análise fictícia: A não converte B; B não converte A; B converte a própria análise; anon negado; UUID/índices inválidos; processing/failed/material deleted; campos excessivos, enums e minutos inválidos; user/material/origin/mission forjados; CRUD direto de vínculos negado; análise não editável; seis chamadas simultâneas gerando uma única missão; retry com título diferente retornando a mesma missão; strings script/HTML persistidas como texto; criação/remoção manual preservadas e tombstone funcionando.

SQL provou RLS/FORCE/grants, proprietário/configuração da função, ausência de membership, claims inválidas/expiradas/conflitantes, unicidade e FK de material. Um trigger temporário condicionado à fixture forçou falha no INSERT do vínculo; contagem de missões ficou intacta e nenhum vínculo apareceu. Toda a suíte e o trigger foram desfeitos por rollback.

Browser percorreu login real → página da matéria → seleção → revisão → Server Action → RPC → leitura normal do banco → feedback → refresh. Validou os campos finais persistidos, ausência de criação antes da confirmação, duas abas, payload forjado na action e sessão B contra análise de A. Larguras 320/375/390/414/768/1440 sem overflow horizontal, inclusive revisão mobile. Teclado Space seleciona, foco entra na revisão/retorna ao cancelar e título vazio falha na validação nativa. Isso é emulação em Chrome headless, não teste em aparelho físico.

Somente análises/metadatas fictícias foram preparadas para esta etapa. Nenhum upload PDF, chamada Gemini ou nova análise de documento real foi necessário. Os testes anteriores do provider, consentimento e conteúdo hostil continuaram passando. Não se afirma um novo teste Gemini real nesta rodada.

Cleanup confirmou zero fixtures em users, identities, sessions, courses, periods, subjects, materials, analyses, missions, links, validation_attempts e Storage. Antes da remoção havia 2 contas fictícias, 13 vínculos, 11 missões e zero objetos Storage. Remoção administrativa foi limitada aos dois UUIDs e e-mails fictícios conferidos, sem DELETE SQL em storage.objects.

## Limitações e exceção autorizada de publicação

O worker CSS do Turbopack encerrou antes de conectar, inclusive fora do sandbox e com outro runtime Node. Webpack, opção suportada pelo Next instalado, compilou corretamente; `build` foi explicitamente definido como `next build --webpack`, com TypeScript e otimizações habilitados. Não houve alteração de dependências ou redução de verificações.

`npm audit` completo mantém a cadeia dev eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces. A versão publicada de braces continua 3.0.3, incluída no advisory GHSA-vfj7-8cjw-p6xm; o patch eslint-config-next 16.4.2 também depende de fast-glob. O npm sugere downgrade incompatível para 14.2.35; não foi aplicado. O audit de produção retorna zero. O usuário autorizou explicitamente publicar em origin/main com essa exceção. Os cinco avisos DEV continuam pendentes e não foram mascarados, ignorados no audit completo ou marcados como resolvidos.

Advisors de segurança mantêm os avisos anteriores de RPCs de materiais e `rls_auto_enable` event_trigger, além de proteção contra senhas vazadas desativada. Não se executou `rls_auto_enable`. A definição real das novas policies foi confirmada com subselect/UUID; EXPLAIN autenticado confirmou InitPlan 1 e Bitmap Index Scan por user_id. O advisor de performance ainda devolveu aviso initplan, apesar dessa definição/plano, e não foi usado como prova de que a alteração falhou.

Scanner local verificou 139 arquivos de código, testes, SQL, documentação e bundles estáticos contra os valores reais das credentials server-only e senhas fictícias: zero ocorrências. As credentials temporárias de fixture foram removidas do workspace após o cleanup; .env.local permaneceu intacto e fora do Git. .obsidian/ preexistente não foi alterado nem incluído.

Vercel, calendário inteligente, replanejamento, notificações, PWA e demais módulos não foram implementados.
