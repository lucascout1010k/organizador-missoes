# Faculdade

## Estado atual

Etapa 1C implementada: migration aplicada manualmente no Supabase, com CRUD, negações de acesso, triggers e preservação do histórico após arquivamento verificados. Dados fictícios removidos após os testes. A interface da Faculdade não foi implementada.

## Regras aprovadas

A organização acadêmica segue Curso → Períodos → Matérias → Aulas e Provas. `academic_courses` representa o curso; `academic_periods`, os períodos; `subjects`, as matérias; `class_sessions`, as aulas específicas; `exams`, as provas.

Períodos concluídos permanecem no histórico. Períodos podem estar planejados, ativos, concluídos ou arquivados; matérias podem estar ativas, concluídas ou arquivadas. Alterar status não exclui nem altera automaticamente os registros relacionados. Criar, editar, concluir e arquivar serão ações da interface futura.

Exemplo exclusivamente fictício: um curso com primeiro período concluído, segundo ativo e períodos seguintes planejados. Não registrar disciplinas, notas, horários ou outros dados acadêmicos reais no repositório público.

Cada matéria pertence a um período; cada aula e prova pertence a uma matéria. Todos os registros pertencem a um usuário. As referências incluem `user_id` para impedir vínculos com dados de outro usuário, inclusive quando o cliente chama a API diretamente.

Aulas e provas guardam horários com fuso (`timestamptz`); datas de início e fim de períodos usam `date`. Provas possuem tópicos em `text[]`. Excluir um pai com dependentes será bloqueado; arquivar é a operação indicada para preservar histórico.

## Pendências

Revisão externa da Etapa 1C. A interface completa fica para uma etapa autorizada posterior.

## Ideias futuras

- PDFs e slides serão vinculados futuramente às aulas.
- IA poderá analisar esses PDFs e sugerir conteúdo de estudo.
- IA poderá sugerir planos de estudo e revisão para provas a partir dos tópicos e das aulas.
- Conteúdo gerado por IA será sempre uma sugestão: o usuário confirma antes de qualquer sugestão virar missão ou compromisso. Não haverá criação silenciosa de missões.
- Nenhum upload, Storage, processamento de PDF ou integração de IA é implementado nesta etapa.
