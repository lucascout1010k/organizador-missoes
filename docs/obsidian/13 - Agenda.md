# Agenda

## Atualização — 2026-10-21 / 2E.2 — recuperação semântica validada

2E.2 permanece limitada à matéria escolhida. Sem Agenda 3B, recorrência, push, replanejamento, pesquisa cruzada ou alterações em aulas/provas/missões. Sources apontam somente para materiais próprios recuperados.

Evidências, arquitetura, custo, segurança e limites em [2E.2 — validação](../2e2-validacao.md). Entradas anteriores são históricas; esta atualização define o estado atual.

## Atualização — 2026-10-21 / 2E.1 — memória acadêmica da matéria

A próxima aula da memória acadêmica usa somente data e status persistidos de class_sessions, sem recorrência inferida ou criação por filename. Sem aula futura cadastrada, o painel informa a ausência. Pendências relacionadas aparecem em resumo; a matéria não implementa uma nova Agenda. Recorrência semanal continua fora da 2E.1.

Validação e limites da rodada em [2E.1 — validação](../2e1-validacao.md). As entradas anteriores abaixo são históricas; esta atualização define o estado atual.

## Atualização — 2026-10-20 / 3A concluída, publicação autorizada

A 3A implementa somente o consumidor diário na home; WeekAgenda continua visualização de provas. Agenda completa, planejamento de datas, backlog, reabertura, calendário, drag/drop e replanejamento ficam para 3B/etapas autorizadas. scheduled_for e due_at existentes alimentam o foco diário; conversões 2D.4 continuam sem data. Não há estrutura paralela de compromissos.

Validação final: 547 testes locais, 42 checks remotos A/B e 53 checks Chrome; lint, TypeScript, build e diff-check aprovados. Produção npm audit zero; audit completo mantém 5 HIGH DEV preexistentes e não resolvidos. Usuário autorizou explicitamente publicar a 3A em origin/main com essa exceção em 2026-10-20. Fixtures remotas zeradas. Sem secrets. Regras, evidências e limites em [3A — validação](../3a-validacao.md).

### Registro anterior


## Atualização — 2026-10-20 / 2D.4 concluída

A Agenda geral continua planejada. WeekAgenda existente mostra provas acadêmicas e não consulta missions. A 2D.4 grava somente missions e seus vínculos; não cria estrutura paralela, compromisso automático ou nova rota de Agenda. scheduled_for/due_at foram avaliados e permanecem nulos nesta conversão; a escolha de datas e a integração visual ficam para etapa própria.

Validação: 496 testes locais (57 novos), 52 checks runtime A/B reais, 19 assertions SQL com rollback, 24 checks Chrome + 6 de teclado/foco, cleanup zerado em 12 categorias. Lint, TypeScript, build Webpack e diff-check aprovados. Audit de produção zero; audit completo mantém 5 HIGH dev preexistentes sem patch compatível. Publicação em origin/main autorizada explicitamente pelo usuário com os 5 HIGH DEV preexistentes mantidos como pendência não resolvida; produção permanece com zero vulnerabilidades. Evidências e limitações em [2D.4 — validação](../2d4-validacao.md).

### Registro anterior

## Estado atual

Status: planejado / não implementado.

## Regras aprovadas

A agenda deverá apoiar o planejamento sem publicar horários pessoais reais.

## Pendências

Definir visualizações, recorrência e fusos horários.

## Ideias futuras

Visualização diária e semanal integrada às missões.
