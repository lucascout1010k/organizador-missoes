# Verificação da fundação — Etapa 1C

`foundation-checks.ts` exporta `verifyFoundation(client, anonymous)`. Não executa automaticamente e não publica endpoint. Recebe um client Supabase SSR com sessão do usuário e um client sem sessão; ambos devem usar somente a publishable key do mesmo projeto. Nunca fornecer client administrativo.

O helper valida a identidade com `getUser()` e não recebe IDs de registros do chamador. Cria seus próprios UUIDs e dados fictícios, sem registrar identidade, cookies, tokens ou erros completos. Só consulta e modifica os IDs desta execução. A limpeza no `finally` usa esses IDs e o proprietário autenticado, dos filhos para os pais. Falhas de limpeza tornam o resultado reprovado; não ignorar esse resultado nem repetir cegamente após falha de transporte.

## Execução realizada

Em 2026-09-16, após confirmação manual de aplicação da migration, o helper foi chamado por uma Server Action temporária no ambiente local de desenvolvimento. A sessão foi validada no servidor e a execução/limpeza foi autorizada pelo usuário. A página e a action temporárias foram removidas após a verificação; nenhum endpoint de testes permanece na aplicação.

Resultado: **81 checks aprovados**, com seis registros fictícios inseridos e depois removidos; consultas finais confirmaram ausência dos IDs de teste.

- 24 checks de CRUD próprio: INSERT com default de proprietário, SELECT, UPDATE com trigger e DELETE, nas seis tabelas.
- 12 rejeições de INSERT/UPDATE com proprietário divergente: `42501`.
- 24 rejeições anônimas de SELECT/INSERT/UPDATE/DELETE: `42501`.
- Quatro exclusões de pais referenciados bloqueadas: `23503`.
- Três origens acadêmicas geradas verificadas: matéria, aula e prova.
- Seis testes negativos de constraints/referência: duração, conclusão, origem inexistente, ID de origem reservada, título vazio e datas invertidas.
- Dois checks de leitura após arquivamento: período e matéria.
- Seis confirmações finais de limpeza.

## Limites

Não foi criada segunda conta. A tentativa com UUID de proprietário divergente comprova rejeição por RLS, mas não substitui um teste completo A/B com dados pertencentes a duas contas reais. As FKs compostas e as policies também foram revisadas estaticamente. Não foram testadas concorrência, expiração natural da sessão, exclusão administrativa de conta ou carga.

Para repetir, usar um harness local temporário autenticado com verificação de identidade e proteção CSRF, sem publicar rotas de teste. Revisar e autorizar as mutações e a limpeza antes da execução. Não solicitar senha, token, connection string ou chave privilegiada ao usuário. Revalidar a limpeza antes de remover o harness.
# Conversão de sugestões — 2D.4

Testes locais: `node --test tests/*.test.mjs`. Não exigem contas, ambiente ou rede.

Os runners remotos `suggestion-missions-runtime.mjs`, `suggestion-missions-browser.mjs` e `suggestion-missions-review.mjs` são execução explícita, fora da suíte local. Usam somente publishable key e sessões fictícias; não provisionam contas nem chamam Gemini. Exigem fixtures controladas, nunca análises reais. O procedimento da rodada e cleanup estão em `docs/2d4-validacao.md`.

Configuração temporária ignorada `.env.2d4-runtime.json`: objetos `a` e `b` com `id`, `email` em `example.invalid` e `password`; IDs de `subject`, `material`, `analysis`, `processing`, `failed`, `deletedAnalysis` e `bAnalysis` das fixtures. O runtime exige o projeto conferido e oito sugestões na análise completed. Para repetir a rodada em outra análise fictícia, `SUGGESTION_RUNTIME_ANALYSIS_ID` aceita somente o namespace controlado 2d4.

Browser: iniciar o build em `localhost:3100`; instalar/disponibilizar Playwright fora das dependências do produto, com Chrome. `PLAYWRIGHT_MODULE_PATH` permite indicar o pacote disponível no runtime e `UI_SCREENSHOT_DIRECTORY` define uma pasta local para capturas. A fixture UI usa os IDs documentados no runner, com título `PDF fictício UI 2D.4` na matéria fictícia. Executar primeiro browser e depois review. Remover todas as fixtures e a configuração temporária após os testes.

`suggestion-missions-checks.sql` exige as fixtures identificadas no próprio script e uma conversão prévia no índice zero. Valida 19 assertions e falha controlada no segundo INSERT; executa integralmente com `ROLLBACK`. Não executar trechos isolados em dados reais.

## Dashboard Hoje — 3A

`dashboard-runtime.mjs` e `dashboard-browser.mjs` são runners explícitos, fora da suíte local, usando somente publishable key e sessões fictícias. Não chamam Gemini nem tocam missões reais. Preparar administrativamente duas contas fictícias confirmadas com UUIDs `3a000000-0000-4000-8000-000000000001`/`002`, e-mails `dashboard-3a-a-<nonce>@example.invalid`/`dashboard-3a-b-<nonce>@example.invalid` e senhas aleatórias temporárias; guardar somente no arquivo ignorado `.env.3a-runtime.json` como `{a:{id,email,password},b:{id,email,password}}`. Nunca registrar senhas em Git, docs ou logs. Signup público permanece desativado.

Executar runtime uma vez; ele insere apenas missões de namespace controlado `3a000000`, registra seus IDs no arquivo ignorado e testa serviço real/getClaims/PostgREST/RLS. Browser exige build em `localhost:3100`, Chrome e `PLAYWRIGHT_MODULE_PATH` se o pacote estiver fora do projeto. `UI_SCREENSHOT_DIRECTORY` é opcional. O browser começa com os resultados do runtime, valida 53 checks e remove somente suas missões A conhecidas para provar estado vazio.

Após os testes, encerrar sessões, remover as duas contas somente depois de conferir UUID **e** e-mail fictícios e verificar ausência em users/identities/sessions/missions/dados acadêmicos/materials/analyses/links/Storage. Apagar o arquivo temporário com credenciais. Não versionar fixtures ou capturas. Detalhes e limites em [3A — validação](../../docs/3a-validacao.md).

---
