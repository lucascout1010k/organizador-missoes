# Pendências

## Atualização — 2026-10-20 / 3A concluída, publicação autorizada

3A implementada e validada. Publicação da 3A em origin/main autorizada explicitamente pelo usuário em 2026-10-20, com exceção somente para os mesmos 5 HIGH DEV preexistentes. Os avisos DEV permanecem pendentes e não resolvidos; produção zero. Nenhum upgrade incompatível ou supressão foi aplicado. Cleanup remoto zerado. Permanecem Agenda/backlog/reabertura, Vercel e melhorias Auth anteriores. Chrome emulado passou; não houve iPhone físico/WebKit.

Validação final: 547 testes locais, 42 checks remotos A/B e 53 checks Chrome; lint, TypeScript, build e diff-check aprovados. Produção npm audit zero; audit completo mantém 5 HIGH DEV preexistentes e não resolvidos. Usuário autorizou explicitamente publicar a 3A em origin/main com essa exceção em 2026-10-20. Fixtures remotas zeradas. Sem secrets. Regras, evidências e limites em [3A — validação](../3a-validacao.md).

### Registro anterior


## Atualização — 2026-10-20 / 2D.4 concluída

2D.4 implementada e validada; nenhuma fixture remota permanece. Publicação em origin/main autorizada explicitamente em 2026-10-20 com exceção documentada: npm audit completo retorna exit 1 pelos mesmos 5 HIGH preexistentes de desenvolvimento. Os avisos DEV continuam abertos e não resolvidos. Audit de produção permanece zero. Não foi aplicado downgrade incompatível. Pendências de produto separadas: listagem geral de missões, Dashboard/Agenda consumindo missions, configuração Vercel e melhorias Auth anteriores. O build padrão usa Webpack devido à falha do worker Turbopack neste Windows.

Validação: 496 testes locais (57 novos), 52 checks runtime A/B reais, 19 assertions SQL com rollback, 24 checks Chrome + 6 de teclado/foco, cleanup zerado em 12 categorias. Lint, TypeScript, build Webpack e diff-check aprovados. Audit de produção zero; audit completo mantém 5 HIGH dev preexistentes sem patch compatível. Publicação em origin/main autorizada explicitamente pelo usuário com os 5 HIGH DEV preexistentes mantidos como pendência não resolvida; produção permanece com zero vulnerabilidades. Evidências e limitações em [2D.4 — validação](../2d4-validacao.md).

### Registro anterior

## Atualização — 2026-10-14 / 2D.3 validada

2D.3 implementada e validada, pronta para publicação autorizada em origin/main. As duas interrupções externas foram resolvidas: conector Supabase reconectado e credential Gemini corrigida localmente/aceita pelo Google. Nenhum dado pessoal real foi usado nos testes. Não iniciar 2D.4 nesta rodada; criação de missão continua reservada à próxima etapa. Vercel não foi configurada.

Pendências separadas: 5 avisos HIGH preexistentes de dependências dev (produção sem vulnerabilidades); habilitação da proteção contra senhas vazadas do Supabase Auth; reconciliação da migration manual original 2D.2C antes de futuro db push; configuração futura da Vercel. Advisors SECURITY DEFINER refletem RPCs públicas autenticadas intencionais com ownership verificado; public.rls_auto_enable retorna event_trigger e não é RPC comum. Nenhuma mudança global em PUBLIC/TEMP foi feita.

Evidências finais: 439 testes locais aprovados, incluindo 66 de IA e 2 novos do driver JSON. Integração com provider simulado: 81 checks principais, 8 de lease stale, 37 no Chromium, 15 de remoção Storage e 6 pelo pooler (4 negações de CRUD em analyses), além de 11 assertions SQL de claims/consentimento com rollback e 5 invariantes remotas. Gemini real: dois PDFs fictícios, acadêmico e hostil, processados por gemini-3.8-flash via Interactions API; 30 checks de schema, conteúdo acadêmico não vazio, persistência, reutilização, A/B e anon. A UI dos resultados reais passou em mais 28 checks desktop/mobile, sem chamadas automáticas no carregamento/refresh. Cleanup final: 8 checks pela fronteira/Storage e zero resíduos nas dez categorias remotas; credenciais temporárias de teste removidas. Lint, TypeScript, build e diff-check aprovados. Scanner confirmou ausência dos valores reais das credentials Gemini/validator no código e bundles do browser, e placeholders vazios no exemplo. npm audit de produção: zero; audit completo: 5 HIGH preexistentes na cadeia dev ESLint/fast-glob/micromatch/braces, sem correção compatível publicada; downgrade incompatível sugerido pelo npm não aplicado.

### Registro anterior

## Atualização — 2026-10-14 / 2D.2D concluída

2D.2D concluída e autorizada para publicação após gates. Próxima etapa é 2D.3, ainda não iniciada. Nenhum bloqueio da interface de Materiais permanece nesta etapa.

Pendências separadas preservadas: configurar a credential server-only na Vercel somente sob autorização específica; reconciliar no histórico Supabase a migration original aplicada manualmente antes de usar db push; avaliar proteção contra senhas vazadas do Auth ([referência](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); acompanhar advisory de desenvolvimento ESLint/transitivas sem downgrade incompatível. IA/Gemini/OCR e redesign geral continuam fora do escopo.

### Registro anterior

## Atualização — 2026-10-14 / 2D.2C validada

A 2D.2C foi implementada e validada. A migration 2D.2C.1, aplicada manualmente, permanece imutável; a corretiva `20261014161215_remover_dependencia_auth_executor_materiais.sql` foi aplicada via MCP para ler claims PostgREST diretamente, sem auth.uid()/auth.jwt() no executor. Prepare usa oito colunas; report usa RPC restrita.

Pendências reais posteriores: confirmar associação Vercel e configurar credential server-only nesse ambiente antes de usar o novo finalize em produção; reconciliar histórico da migration manual antes de db push; tratar advisory dev braces quando existir correção compatível; evoluir interface da próxima etapa somente com autorização. A infraestrutura 2D.2C está validada localmente e no Supabase; nenhuma fixture permanece. Não alterar PUBLIC/TEMP. Não iniciar IA/Gemini/OCR/redesign automaticamente. Commit/push somente após os gates finais.

### Registro anterior

## Estado atual

As Etapas 1A e 1B foram validadas pelo Agente 1. A Etapa 1C implementou a fundação acadêmica e de missões. A Etapa 1D implementou a interface funcional da Faculdade, foi validada pelo usuário e teve seus dados fictícios removidos. A Etapa 2A implementou e validou o Dashboard visual e o novo shell responsivo. A Etapa 2B implementou e validou a central visual responsiva da Faculdade. A Etapa 2C implementou e validou o detalhe visual responsivo da matéria. A Etapa 2D.1 implementou e validou a fundação privada de Materiais, com 38/38 checks e cleanup integral. A Etapa 2D.2A adicionou `validating` e refinou a policy de `SELECT` do Storage, com 93/93 checks principais, 8/8 A/B e 23/23 de cleanup aprovados. A 2D.2B está concluída e validada em runtime: prepare, formulário mínimo, upload direto e report de falha, com 82/82 checks consolidados e 245 testes locais previamente aprovados. Finalize, interface final e IA continuam não implementados. A 2D.2C não foi iniciada; a próxima etapa depende de autorização.

## Regras aprovadas

Não avançar para outra etapa sem autorização e não tratar planejamento como implementação.

## Pendências

- Iniciar qualquer próxima etapa funcional ou visual somente após autorização explícita.
- Publicar a 2D.2B em `origin/main` somente após autorização explícita para push. O runtime está concluído: 54 checks principais, 13 A/B e 15 cleanup, sem resíduos. Os 54 checks e 245 testes locais anteriores não foram repetidos na rodada cruzada.
- Revisar em etapa autorizada a observação de erros reais HTTP 400 com status interno 413/415, classificados conservadoramente como incertos; não alterar a lógica aprovada sem autorização. Resultados incertos continuam `pending_upload` e não acionam report/retry automaticamente.
- Pendência arquitetural da 2D.2C: "Antes de considerar ready como prova de validação, a máquina de transições deverá ter fronteira de escrita confiável e não depender somente da RLS genérica de UPDATE."
- Definir recuperação/idempotência para prepare com resposta perdida e metadata abandonada antes de expor o fluxo completo; não repetir automaticamente a criação.
- Reconciliar o histórico de migrations antes de futura adoção do Supabase CLI.
- Concorrência e carga somente em escopo autorizado; o isolamento A/B de Materiais já foi validado com duas contas reais.
- Configuração futura da Vercel somente em etapa autorizada.
- Testes de expiração de sessão, autorização por recurso e limites de autenticação antes da exposição em produção.
- Iniciar os próximos blocos somente após autorização explícita. O upload mínimo da 2D.2B mantém sucesso em `pending_upload`, sem abertura/download; finalize, reconciliação, recuperação de metadata abandonada e interface final não estão implementados. `ready` ainda não representa fluxo funcional concluído. Após prepare o formulário não reenvia nessa montagem; múltiplos envios e recuperação após recarga precisam de desenho posterior. A referência `4. Materiais-PDF-IA` está reservada para etapa visual posterior.
- Iniciar processamento de PDF ou Gemini/IA somente em etapa posterior explicitamente autorizada.

## Ideias futuras

Manter esta lista curta, real e priorizada.
