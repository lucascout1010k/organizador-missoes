# Faculdade

## Estado atual

Etapas 1D, 2B e 2C implementadas e validadas. `/faculdade` funciona como central acadêmica visual integrada ao AppShell da Etapa 2A: identifica curso e período atuais, apresenta métricas compactas, matérias do período, provas planejadas nos próximos 30 dias, aulas da semana atual e resumo de períodos. `/faculdade/historico` reúne períodos concluídos ou arquivados; a página de período mantém o gerenciamento contextual. `/faculdade/materias/[id]` funciona como central da vida da matéria, com cabeçalho de curso/período/status, navegação por seções, conclusão de aulas por status, próxima aula, próxima prova planejada, dias restantes, tópicos, cronologia, outras provas e ações acadêmicas expansíveis. Curso, períodos, matérias, aulas e provas podem ser criados e editados, com mudanças de status sem exclusão física pela interface.

A conclusão exibida na central significa exclusivamente `matérias concluídas / total de matérias do período`. Não representa nota, frequência, domínio de conteúdo ou progresso pedagógico. Dias até a prova são derivados da data real; aulas da semana usam o intervalo de segunda-feira a domingo em `America/Sao_Paulo`. Quando não existem registros, a composição completa permanece visível com métricas zero e estados vazios honestos, sem fixtures persistentes.

O fluxo CRUD real foi testado com dados fictícios, incluindo persistência após recarga, histórico de período concluído e exibição de prova futura na home. Após `FACULDADE VALIDADA`, todos os registros de teste foram removidos e o estado vazio foi confirmado.

Os redesenhos das Etapas 2B e 2C foram validados em 375px, 430px, 768px, 1024px e desktop amplo, sem overflow horizontal. O detalhe da matéria prioriza a próxima prova antes das métricas no mobile e mantém o grid de aulas com próxima prova e ações no desktop. A navegação interna usa âncoras reais. A fundação backend de Materiais foi concluída na Etapa 2D.1; na 2D.2B.2 local, sua seção passa a oferecer somente o formulário mínimo de upload, sem página visual final, listagem, leitura ou exclusão. Criação e edição acadêmicas permanecem como ações secundárias nos formulários originais, sem alterar suas Server Actions, timezone, `missions` ou contratos funcionais existentes.

Materiais acadêmicos possuem metadata privada vinculada à matéria, aula opcional compatível, PDF de até 6 MiB e caminho canônico por usuário/matéria/material. A Etapa 2D.2A adicionou o estado `validating`: `pending_upload` só possui `SELECT` durante a operação interna de upload, e a leitura normal continua negada nesse estado; o proprietário tem leitura técnica em `validating`, `ready` e `deleting`. A futura UI continuará permitindo abertura ou download somente em `ready`. O isolamento A/B, a negação anônima e o cleanup foram validados em runtime. O upload autenticado padrão Browser → Supabase Storage, sem signed upload token, foi implementado localmente na 2D.2B.2; seu sucesso permanece `pending_upload`. A IA ainda não foi implementada.

## Regras aprovadas

A organização acadêmica segue Curso → Períodos → Matérias → Aulas e Provas. `academic_courses` representa o curso; `academic_periods`, os períodos; `subjects`, as matérias; `class_sessions`, as aulas específicas; `exams`, as provas.

Períodos concluídos permanecem no histórico. Períodos podem estar planejados, ativos, concluídos ou arquivados; matérias podem estar ativas, concluídas ou arquivadas. Alterar status não exclui nem altera automaticamente os registros relacionados. Criar, editar, concluir e arquivar são ações disponíveis na interface.

Exemplo exclusivamente fictício: um curso com primeiro período concluído, segundo ativo e períodos seguintes planejados. Não registrar disciplinas, notas, horários ou outros dados acadêmicos reais no repositório público.

Cada matéria pertence a um período; cada aula e prova pertence a uma matéria. Todos os registros pertencem a um usuário. As referências incluem `user_id` para impedir vínculos com dados de outro usuário, inclusive quando o cliente chama a API diretamente.

Aulas e provas guardam horários com fuso (`timestamptz`); datas de início e fim de períodos usam `date`. Formulários recebem a hora local do navegador e enviam ISO UTC, enquanto a apresentação volta ao fuso local. Provas possuem tópicos em `text[]`, editados como uma linha por tópico. Excluir um pai com dependentes é bloqueado; arquivar é a operação indicada para preservar histórico.

## Pendências

O formulário mínimo aprovado foi validado em runtime na 2D.2B: prepare somente com metadata, upload direto bem-sucedido, mensagem "Arquivo enviado. Validação pendente." e metadata ainda `pending_upload`, sem abertura/download. Aula opcional, caminho canônico e UUID server-side foram conferidos. Tamanho/MIME inválidos foram rejeitados pela UX e pelo Storage; conflitos e erros incertos não liberaram acesso nem provocaram retry/report indevido. Isolamento A/B e negação anônima foram confirmados. Resultado consolidado: 54 checks principais + 13 A/B + 15 cleanup = 82/82; 245 testes locais previamente aprovados. Todos os dados e objetos temporários e diagnósticos foram removidos.

A 2D.2B está concluída: o detalhe da matéria recebeu somente um formulário mínimo de envio, com título e aula opcional. O PDF é enviado diretamente ao Storage privado, sem passar por Next.js/Vercel; sucesso continua pendente de validação, sem abertura/download. Falha explicitamente confirmada pode registrar `upload_failed` via `reportMaterialUploadFailure`; resultados incertos permanecem `pending_upload` e exigem reconciliação futura. Página final de Materiais, finalize, abertura, exclusão e IA permanecem pendentes de autorização. `ready` ainda não representa fluxo funcional concluído. A referência `4. Materiais-PDF-IA` permanece reservada para etapa visual posterior; não houve redesign nem início da 2D.2C.

## Ideias futuras

- O frontend futuro permitirá vincular PDFs a matérias e, opcionalmente, a aulas, usando a fundação privada já implementada. Slides e outros MIME types não são aceitos na 2D.1.
- IA poderá analisar esses PDFs e sugerir conteúdo de estudo; essa integração ainda não existe.
- IA poderá sugerir planos de estudo e revisão para provas a partir dos tópicos e das aulas.
- Conteúdo gerado por IA será sempre uma sugestão: o usuário confirma antes de qualquer sugestão virar missão ou compromisso. Não haverá criação silenciosa de missões.
- Upload funcional mínimo e isolamento A/B foram implementados e validados na 2D.2B; finalize, processamento de PDF e integração de IA continuam não implementados.
