# Pendências

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
