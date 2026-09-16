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
