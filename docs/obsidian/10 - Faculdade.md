# Faculdade

## Estado atual

Etapas 1D, 2B e 2C implementadas e validadas. `/faculdade` funciona como central acadêmica visual integrada ao AppShell da Etapa 2A: identifica curso e período atuais, apresenta métricas compactas, matérias do período, provas planejadas nos próximos 30 dias, aulas da semana atual e resumo de períodos. `/faculdade/historico` reúne períodos concluídos ou arquivados; a página de período mantém o gerenciamento contextual. `/faculdade/materias/[id]` funciona como central da vida da matéria, com cabeçalho de curso/período/status, navegação por seções, conclusão de aulas por status, próxima aula, próxima prova planejada, dias restantes, tópicos, cronologia, outras provas e ações acadêmicas expansíveis. Curso, períodos, matérias, aulas e provas podem ser criados e editados, com mudanças de status sem exclusão física pela interface.

A conclusão exibida na central significa exclusivamente `matérias concluídas / total de matérias do período`. Não representa nota, frequência, domínio de conteúdo ou progresso pedagógico. Dias até a prova são derivados da data real; aulas da semana usam o intervalo de segunda-feira a domingo em `America/Sao_Paulo`. Quando não existem registros, a composição completa permanece visível com métricas zero e estados vazios honestos, sem fixtures persistentes.

O fluxo CRUD real foi testado com dados fictícios, incluindo persistência após recarga, histórico de período concluído e exibição de prova futura na home. Após `FACULDADE VALIDADA`, todos os registros de teste foram removidos e o estado vazio foi confirmado.

Os redesenhos das Etapas 2B e 2C foram validados em 375px, 430px, 768px, 1024px e desktop amplo, sem overflow horizontal. O detalhe da matéria prioriza a próxima prova antes das métricas no mobile e mantém o grid de aulas com próxima prova e ações no desktop. A navegação interna usa âncoras reais. A fundação backend de Materiais foi concluída na Etapa 2D.1, mas sua indicação na interface permanece não interativa: nenhuma tela ou endpoint funcional foi implementado. Criação e edição acadêmicas permanecem como ações secundárias nos formulários originais, sem alterar Server Actions, timezone, `missions` ou contratos funcionais existentes.

Materiais acadêmicos possuem metadata privada vinculada à matéria, aula opcional compatível, PDF de até 6 MiB e caminho canônico por usuário/matéria/material. O runtime real validou signed upload, leitura própria em `ready`, isolamento entre duas contas, negação anônima, ciclo de exclusão e cleanup. A IA ainda não foi implementada.

## Regras aprovadas

A organização acadêmica segue Curso → Períodos → Matérias → Aulas e Provas. `academic_courses` representa o curso; `academic_periods`, os períodos; `subjects`, as matérias; `class_sessions`, as aulas específicas; `exams`, as provas.

Períodos concluídos permanecem no histórico. Períodos podem estar planejados, ativos, concluídos ou arquivados; matérias podem estar ativas, concluídas ou arquivadas. Alterar status não exclui nem altera automaticamente os registros relacionados. Criar, editar, concluir e arquivar são ações disponíveis na interface.

Exemplo exclusivamente fictício: um curso com primeiro período concluído, segundo ativo e períodos seguintes planejados. Não registrar disciplinas, notas, horários ou outros dados acadêmicos reais no repositório público.

Cada matéria pertence a um período; cada aula e prova pertence a uma matéria. Todos os registros pertencem a um usuário. As referências incluem `user_id` para impedir vínculos com dados de outro usuário, inclusive quando o cliente chama a API diretamente.

Aulas e provas guardam horários com fuso (`timestamptz`); datas de início e fim de períodos usam `date`. Formulários recebem a hora local do navegador e enviam ISO UTC, enquanto a apresentação volta ao fuso local. Provas possuem tópicos em `text[]`, editados como uma linha por tópico. Excluir um pai com dependentes é bloqueado; arquivar é a operação indicada para preservar histórico.

## Pendências

Frontend de Materiais, integração de download/upload na aplicação e IA ficam para uma etapa autorizada posterior.

## Ideias futuras

- O frontend futuro permitirá vincular PDFs a matérias e, opcionalmente, a aulas, usando a fundação privada já implementada. Slides e outros MIME types não são aceitos na 2D.1.
- IA poderá analisar esses PDFs e sugerir conteúdo de estudo; essa integração ainda não existe.
- IA poderá sugerir planos de estudo e revisão para provas a partir dos tópicos e das aulas.
- Conteúdo gerado por IA será sempre uma sugestão: o usuário confirma antes de qualquer sugestão virar missão ou compromisso. Não haverá criação silenciosa de missões.
- Upload funcional no frontend, processamento de PDF e integração de IA ainda não foram implementados.
