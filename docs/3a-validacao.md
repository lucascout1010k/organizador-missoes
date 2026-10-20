# 3A — Dashboard Hoje funcional

Implementação e validação em 2026-10-20, a partir de `ecce9e968866561bf22d4c5ffb5185039132c40d`, branch `main`. Publicação em origin/main autorizada explicitamente pelo usuário em 2026-10-20, com exceção apenas para os cinco HIGH DEV preexistentes, mantidos documentados e não resolvidos. Nenhuma migration necessária.

## Auditoria e semântica

O catálogo remoto do projeto Organizador Missoes foi confrontado com as migrations e o código. `public.missions` é a fonte única. Campos reais: UUID id/user_id, title/description, category, status, priority, scheduled_for/due_at em timestamptz, estimated_minutes, origin_type/origin_id, três origens geradas, created_at/updated_at/completed_at. Constraints de conclusão, origem, categoria e FKs de proprietário preservadas; índices por user/status, agendamento, prazo e origens, PK e unique(user_id,id) confirmados. Trigger de updated_at preservada.

RLS habilitada e forçada; authenticated mantém CRUD próprio com USING/WITH CHECK por auth.uid. Anon não recebe CRUD. Executor de conversão mantém somente permissões anteriores de leitura/inserção e suas policies. Nenhuma nova role, chave privilegiada, grant, policy ou RPC.

O dia usa `America/Sao_Paulo`, já adotado pelo cabeçalho e semana acadêmica. Limites são meia-noite local inclusiva e próxima meia-noite exclusiva, calculados com Intl/IANA e enviados em UTC à consulta. Não se usa a data UTC do host como dia do usuário. A UI informa horário de Brasília. Não há preferência individual de fuso nesta etapa.

- Abertas: planned, in_progress e postponed. Pode-se concluir uma adiada ainda não reagendada; seu estado continua explícito até a conclusão. missed representa histórico de não realização e fica fora do foco/transição desta etapa.
- Atrasada: aberta com scheduled_for **ou** due_at anterior ao começo do dia. Uma data futura no outro campo não esconde um prazo/agendamento anterior. Horário passado no mesmo dia continua em Hoje.
- Hoje: aberta com agendamento ou prazo dentro do dia, sem condição de atraso anterior. Cada missão aparece uma única vez.
- Concluída hoje: completed_at dentro do dia e status completed, independentemente do agendamento original. Conclusões antigas ficam fora, mesmo com agendamento hoje.
- Futura: ambos os campos de planejamento fora do alcance passado/hoje; excluída. Sem data: backlog, excluído. Sugestões 2D.4 continuam sem datas automáticas e serão planejadas pela futura Agenda.

Ordem: atrasadas → hoje → concluídas hoje; em cada grupo high/medium/low; menor instante de planejamento/prazo/conclusão disponível; created_at e id como desempates estáveis. A UI diferencia Agendada/Prazo e mostra a data de conclusão.

## Consulta, DTO e progresso

`src/lib/missions/service.ts` é server-only. getClaims valida a sessão e o sub UUID; o servidor deriva userId e filtra explicitamente user_id além de RLS. Um predicado PostgREST reúne abertas com data anterior ao fim do dia e concluídas no intervalo atual. A coleta usa páginas de 500 em ordem created_at/id, evitando truncamento silencioso pelo limite padrão do provider. Não há query por missão, joins, consulta extra por contador ou state manager. O caso normal usa uma request de coleta. A consulta acadêmica independente roda em paralelo.

DTO explícito entrega somente id para ação, título, descrição de até 240 caracteres, prioridade, categoria/origem traduzidas, duração, datas já formatadas, estado e grupo. Sem owner, origin_id, análise, suggestionIndex, capabilities ou secrets. Não busca contexto acadêmico adicional. Textos são escapados pelo React.

Progresso = conclusões de hoje / (abertas de hoje + atrasadas abertas + conclusões de hoje). Cada missão entra uma vez; concluir uma atrasada preserva o denominador e aumenta o numerador. Concluir algo originalmente sem data/futuro por outro consumidor faz a conclusão contar como trabalho realizado hoje. Porcentagem arredondada; zero de zero mostra 0%, sem XP, streak ou progresso fictício. A fórmula aparece em linguagem simples na interface.

## Conclusão e limites

`completeMission` aceita objeto estrito `{missionId}`. UUID inválido/campos extras falham antes de autenticar. getClaims é reexecutado; busca por ID+owner; apenas planned/in_progress/postponed podem virar completed. O servidor grava status e completed_at juntos, usando seu relógio. Compare-and-set por owner/ID/estado lido/completed_at null impede sobrescrever o timestamp da primeira conclusão. Se perder a corrida, relê e retorna sucesso somente se o vencedor concluiu. Já completed retorna sucesso sem UPDATE. Ausência/inacessibilidade usam erro genérico sem revelar outro proprietário.

Double click tem lock síncrono e botão disabled no cliente, complementados pela condição atômica no banco. Retry após resposta perdida, refresh e aba desatualizada preservam estado/timestamp. Não há efeitos colaterais de XP. Não existe domínio seguro implementado de reabertura; a conclusão é unilateral nesta etapa.

O CRUD próprio autenticado preexistente da fundação foi preservado: esta Server Action impede escolher owner/status/completed_at no seu payload, mas não transforma os timestamps em trilha inviolável nem revoga a API REST de edição própria. Segurança de acesso cruzado é garantida também por RLS. Não foi ampliado o hardening de toda escrita de missions nesta etapa.

`revalidatePath('/')` e `router.refresh()` atualizam lista, grupos e contadores. Loading é imediato, progresso só muda depois de persistir. Erro preserva a lista anterior e permite retry explícito. Outra aba parada não recebe push/realtime; seu submit/refresh reconcilia com o banco. Uma página aberta atravessando a meia-noite recalcula ao atualizar/navegar; não há timer ou atualização automática de Agenda.

## Evidências

| Gate | Resultado |
| --- | --- |
| Testes locais | 547/547 (496 existentes + 51 novos) |
| Runtime remoto com sessões A/B reais e publishable key | 42/42 na rodada final |
| Chrome headless contra build de produção | 53/53 na rodada final |
| Lint | aprovado |
| TypeScript sem emissão | aprovado |
| Build Webpack | aprovado |
| Diff whitespace | aprovado |
| npm audit --omit=dev | zero vulnerabilidades |
| npm audit completo | 5 HIGH DEV preexistentes e não resolvidos; exceção de publicação explicitamente autorizada |

Testes locais cobrem dia/fuso/ano/limites, agendamento e prazo, backlog/futuras/missed, completions antigas, progresso, ordem estável, DTO, paginação, anon, owner/não owner, inexistente, UUID inválido, estados, getClaims inválido/erro, payload extra e autoridade forjada, falha de banco/transporte, retry, timestamp preservado e concorrência. Renderização estática cobre vazio, erro recuperável, acessibilidade da ação, prioridade/origem e texto hostil.

Runtime remoto percorre getClaims real → serviço real → PostgREST/RLS: A e B isolados nos dois sentidos; anon negado; UPDATE REST cruzado sem efeito; oito conclusões simultâneas; retry/resposta perdida; datas e progresso persistidos. UI percorre login → Dashboard → ação real → banco → feedback/grupos/progresso → reload e segunda aba desatualizada. POST direto testa owner/UUID/inexistente e user_id/status/completed_at/extra forjados. Erro de transporte é injetado bloqueando a request no harness, não atribuído ao provider. Loading usa atraso controlado da request real, sem progresso falso.

Larguras 320/375/390/414/768/1440 passaram sem overflow, inclusive título longo, badges flexíveis e texto hostil. Botões >=44 px, modalidade de teclado/focus-visible, Enter e reduced-motion. Capturas desktop/mobile foram inspecionadas. Trata-se de emulação Chrome, sem teste em iPhone físico/WebKit. UI acadêmica, cards planejados, Auth, PDF e IA preservados. Sem chamada Gemini, upload, calendário completo ou nova rota de Agenda.

O primeiro harness de teclado usava foco programático ainda em modalidade de mouse; foi corrigido para emitir Tab antes do teste. Uma primeira tentativa de browser não alcançou o servidor isolado; o build foi iniciado no mesmo ambiente de rede do Chrome. Essas tentativas não integram a contagem final. A correção de inferência TypeScript e um default incorreto do harness de input null foram resolvidos antes dos gates finais.

## Cleanup e pendências

Somente duas contas fictícias `example.invalid` e missões de namespace exclusivo foram usadas. Nenhuma missão real foi fixture. Sessões de teste foram encerradas; os dois usuários fictícios foram removidos com filtro de UUID e e-mail. Checagem final administrativa confirmou zero users, identities, sessions, missions, dados acadêmicos, materials, analyses, links e objetos Storage desse namespace. Scanner final: 157 arquivos de código, testes, SQL, docs e bundles, zero ocorrências dos secrets e senhas fictícias. Arquivos temporários com credenciais foram removidos do workspace; `.env.local` permaneceu intacto/ignorado. Runners remotos versionáveis não contêm credenciais nem executam na suíte local.

Audit completo mantém @next/eslint-plugin-next, eslint-config-next, fast-glob, micromatch e braces (mesmos cinco HIGH DEV da etapa anterior). Não houve downgrade, alteração de lockfile ou supressão do audit. O usuário autorizou explicitamente a exceção e a publicação da 3A em origin/main em 2026-10-20: manter os cinco HIGH DEV como pendência preexistente, confirmar produção zero, preservar todos os demais gates e não forçar upgrade incompatível. A exceção não marca os avisos DEV como resolvidos. Agenda geral/reabertura/planejamento do backlog, demais módulos, Vercel e pendências Auth anteriores permanecem fora do escopo.

Notas consultadas: 00, 05, 06, 08, 09, 10, 13, 14, 18, 19, 20. Notas atualizadas: 00, 05, 06, 08, 09, 13, 14, 18, 19, 20. As entradas anteriores permanecem como histórico, com a atualização 3A no topo como estado vigente.

Reprodução: `node --test tests/*.test.mjs`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check`, `npm audit`, `npm audit --omit=dev`. Runtime/browser estão em `supabase/tests/dashboard-runtime.mjs` e `dashboard-browser.mjs`; preparação/cleanup de contas são administrativos e explícitos, fora do app.
