# Agenda

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
