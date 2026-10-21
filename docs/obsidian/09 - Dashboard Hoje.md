# Dashboard Hoje

## Atualização — 2026-10-21 / 2E.2 — recuperação semântica validada

2E.2 acrescenta perguntas dentro de uma matéria. Dashboard Hoje, foco diário e transições de missions permanecem no fluxo 3A. Cobertura pesquisável é separada da quantidade analisada/concluída. Navegação e refresh não chamam o provider; resposta fica apenas na sessão React.

Evidências, arquitetura, custo, segurança e limites em [2E.2 — validação](../2e2-validacao.md). Entradas anteriores são históricas; esta atualização define o estado atual.

## Atualização — 2026-10-21 / 2E.1 — memória acadêmica da matéria

A memória da matéria apenas oferece navegação ao foco de hoje; não substitui nem duplica sua lógica. Dashboard, conclusão idempotente e classificação America/Sao_Paulo foram preservados. Missões relacionadas sem data continuam visíveis na memória acadêmica, mesmo quando ficam fora do foco diário.

Validação e limites da rodada em [2E.1 — validação](../2e1-validacao.md). As entradas anteriores abaixo são históricas; esta atualização define o estado atual.

## Atualização — 2026-10-20 / 3A concluída, publicação autorizada

3A funcional. Dia em America/Sao_Paulo, meia-noite inclusiva/próxima exclusiva. Atrasada: aberta com agendamento OU prazo anterior ao dia; Hoje: agendamento OU prazo no dia, sem atraso anterior; concluída hoje: completed_at no dia. Sem data/futuras/missed/conclusões antigas excluídas. Grupos nessa ordem, prioridade high/medium/low, menor instante, created_at/id. Progresso: concluídas hoje / (abertas hoje + atrasadas abertas + concluídas hoje). DTO mínimo, prioridade/origem/duração/datas/estado, conclusão/loading/erro/vazio reais e refresh sem F5, preservando dark premium e cards existentes.

Validação final: 547 testes locais, 42 checks remotos A/B e 53 checks Chrome; lint, TypeScript, build e diff-check aprovados. Produção npm audit zero; audit completo mantém 5 HIGH DEV preexistentes e não resolvidos. Usuário autorizou explicitamente publicar a 3A em origin/main com essa exceção em 2026-10-20. Fixtures remotas zeradas. Sem secrets. Regras, evidências e limites em [3A — validação](../3a-validacao.md).

### Registro anterior


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
