# Faculdade

## Estado atual

Etapa 1D implementada e validada. `/faculdade` mostra curso, período atual, matérias, próximas provas e períodos; `/faculdade/historico` reúne períodos concluídos ou arquivados; páginas de período e matéria oferecem gerenciamento contextual. Curso, períodos, matérias, aulas e provas podem ser criados e editados, com mudanças de status sem exclusão física pela interface.

O fluxo CRUD real foi testado com dados fictícios, incluindo persistência após recarga, histórico de período concluído e exibição de prova futura na home. Após `FACULDADE VALIDADA`, todos os registros de teste foram removidos e o estado vazio foi confirmado.

## Regras aprovadas

A organização acadêmica segue Curso → Períodos → Matérias → Aulas e Provas. `academic_courses` representa o curso; `academic_periods`, os períodos; `subjects`, as matérias; `class_sessions`, as aulas específicas; `exams`, as provas.

Períodos concluídos permanecem no histórico. Períodos podem estar planejados, ativos, concluídos ou arquivados; matérias podem estar ativas, concluídas ou arquivadas. Alterar status não exclui nem altera automaticamente os registros relacionados. Criar, editar, concluir e arquivar são ações disponíveis na interface.

Exemplo exclusivamente fictício: um curso com primeiro período concluído, segundo ativo e períodos seguintes planejados. Não registrar disciplinas, notas, horários ou outros dados acadêmicos reais no repositório público.

Cada matéria pertence a um período; cada aula e prova pertence a uma matéria. Todos os registros pertencem a um usuário. As referências incluem `user_id` para impedir vínculos com dados de outro usuário, inclusive quando o cliente chama a API diretamente.

Aulas e provas guardam horários com fuso (`timestamptz`); datas de início e fim de períodos usam `date`. Formulários recebem a hora local do navegador e enviam ISO UTC, enquanto a apresentação volta ao fuso local. Provas possuem tópicos em `text[]`, editados como uma linha por tópico. Excluir um pai com dependentes é bloqueado; arquivar é a operação indicada para preservar histórico.

## Pendências

Evoluções além do escopo acadêmico atual ficam para uma etapa autorizada posterior.

## Ideias futuras

- PDFs e slides serão vinculados futuramente às aulas.
- IA poderá analisar esses PDFs e sugerir conteúdo de estudo.
- IA poderá sugerir planos de estudo e revisão para provas a partir dos tópicos e das aulas.
- Conteúdo gerado por IA será sempre uma sugestão: o usuário confirma antes de qualquer sugestão virar missão ou compromisso. Não haverá criação silenciosa de missões.
- Nenhum upload, Storage, processamento de PDF ou integração de IA é implementado nesta etapa.
