# Dashboard Hoje

## Atualização — 2026-10-20 / 2D.4 concluída

Auditoria 2D.4 confirmou que a home e WeekAgenda continuam consumindo dados acadêmicos/provas, sem leitura de missions. Missões convertidas existem na tabela universal e nas consultas próprias normais; ainda não há critério funcional de exibição de missões no Dashboard. Nenhum contador ou integração fictícia foi acrescentado. A Server Action invalida a home para leituras futuras, mas isso não implementa um consumidor de missions.

Validação: 496 testes locais (57 novos), 52 checks runtime A/B reais, 19 assertions SQL com rollback, 24 checks Chrome + 6 de teclado/foco, cleanup zerado em 12 categorias. Lint, TypeScript, build Webpack e diff-check aprovados. Audit de produção zero; audit completo mantém 5 HIGH dev preexistentes sem patch compatível. Publicação em origin/main autorizada explicitamente pelo usuário com os 5 HIGH DEV preexistentes mantidos como pendência não resolvida; produção permanece com zero vulnerabilidades. Evidências e limitações em [2D.4 — validação](../2d4-validacao.md).

### Registro anterior

## Estado atual

Redesenhado e validado na Etapa 2A. A home privada adota identidade dark premium em navy profundo, azul elétrico e verde para sucesso. O Dashboard apresenta saudação e data, resumos derivados de dados acadêmicos reais, próximos compromissos, agenda visual de sete dias, resumo funcional da Faculdade e cards planejados para Academia e Projetos. Estados vazios são compactos e informativos, sem porcentagens, streaks, treinos, projetos ou estatísticas fictícias.

O shell compartilhado possui sidebar e header no desktop, navegação inferior no mobile, busca e notificações em estado visual neutro, destinos futuros marcados como `Em breve` e logout funcional. A interface foi validada em 375px, 430px, 768px, 1024px e desktop amplo, sem overflow horizontal e com suporte a `prefers-reduced-motion`.

## Regras aprovadas

Apresentar o foco diário sem expor dados de outros usuários. As leituras acadêmicas respeitam sessão e RLS.

## Pendências

Missões, Agenda funcional, Academia, Projetos, Relatórios, Conquistas, busca e notificações continuam dependendo de etapas próprias.

## Ideias futuras

Resumo diário de missões e progresso.
