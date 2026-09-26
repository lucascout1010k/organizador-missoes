# Decisões Técnicas

## Estado atual

Fundação local com npm, Next.js App Router, TypeScript, Tailwind CSS, ESLint, diretório `src/` e alias `@/*`. O baseline está publicado em um repositório GitHub público na branch `main`.

## Regras aprovadas

Evitar dependências e recursos experimentais sem necessidade. Arquitetar dados privados para multi-user mesmo com uso inicial single-user.

### GitHub público e identidade de commit

O repositório público favorece portfólio, transparência do código e documentação pública. A identidade Git é configurada somente no repositório com endereço associado à conta GitHub; o endereço não deve ser registrado na documentação. Dados pessoais e segredos permanecem fora do repositório.

### Chaves do Supabase

Projetos novos usam Supabase publishable key para componentes públicos; nenhuma secret key será adicionada até existir necessidade server-side concreta e revisão específica do Agente 1. A configuração real permanece somente em `.env.local`.

### Autenticação privada — Etapa 1B

Adotado login por e-mail e senha com `signInWithPassword()` em Server Action e cookies do `@supabase/ssr`. Não há cadastro público na aplicação; o signup também está desabilitado externamente no Supabase. A existência dos usuários é controlada pelo Auth, sem e-mail fixo ou cadastro administrativo no código, preservando a preparação multi-user.

`getClaims()` é usado no proxy e no layout privado para validar JWT. A rota `/` fica no grupo `(protected)` e `/login` é pública. Os redirecionamentos usam destinos fixos, mantêm cookies de sessão renovados e não propagam query string. Operações de domínio futuras precisarão de autorização própria e RLS.

O logout usa escopo `local` para encerrar apenas a sessão atual. O layout é revalidado após login e logout. Falhas de login mantêm mensagem genérica, inclusive falhas de transporte, evitando expor detalhes do serviço ou a existência de contas.

Nenhuma dependência adicional, tabela de domínio, migration, policy ou Edge Function foi criada na Etapa 1B. `AGENTS.md` e `CLAUDE.md`, gerados automaticamente pelo Next.js instalado ao iniciar o desenvolvimento, foram mantidos como instruções locais de trabalho.

### Fundação de dados — Etapa 1C aplicada e verificada

- Adicionar `academic_courses` às cinco tabelas mínimas para representar Curso → Períodos → Matérias → Aulas/Provas sem duplicar o curso em cada período. Não criar `profiles` sem necessidade.
- Preservar períodos e matérias concluídos/arquivados. FKs de domínio com `NO ACTION` evitam apagar o histórico em cascata; exclusão administrativa da conta Auth remove seus registros por cascade.
- Usar `user_id NOT NULL`, RLS por operação e FKs compostas por proprietário. Um ID válido de outro usuário não é referência válida para o usuário atual.
- Grants explícitos somente de CRUD a `authenticated`, sem acesso anônimo às novas tabelas, independentemente dos defaults do projeto.
- Estados em `text` com `CHECK`, evitando tipos enum adicionais nesta fundação. Mudanças futuras exigirão migration explícita.
- Manter missão universal com `origin_type`/`origin_id`. Três colunas geradas com FKs compostas protegem origens acadêmicas; apenas um ID polimórfico sem FK permitiria referências inválidas. Tipos futuros ficam reservados sem IDs até terem sua própria modelagem.
- Centralizar `updated_at` em uma função privada invoker, com `search_path` vazio, sem RPC administrativa. Preservar `created_at` em updates; não prometer auditoria imutável.
- Aplicar a migration manualmente no SQL Editor, em transação, sem solicitar credenciais elevadas. Reconciliar histórico antes de adotar `db push` no futuro.
- Não adicionar dependências nem alterar o fluxo de autenticação nesta preparação. UI de domínio, PDF, IA, Storage, academia, projetos e Vercel ficam fora do escopo.
- Manter o helper de integração sem endpoint público. A execução foi feita por uma action temporária restrita a desenvolvimento, com identidade validada, somente publishable key e limpeza por UUIDs da própria execução. A tela e a action foram removidas; 81 checks passaram. Não criar segunda conta para os testes sem autorização.

### Interface acadêmica — Etapa 1D implementada e validada

- Usar Server Components para leituras e Server Actions para mutações, mantendo o navegador sem acesso privilegiado e sem adicionar dependências.
- Derivar a identidade da sessão em toda mutação e combinar RLS com filtros explícitos de proprietário e de relacionamento, sem aceitar `user_id` enviado por formulário.
- Validar IDs, limites, status, datas e campos obrigatórios no servidor; retornar erros genéricos de persistência e mensagens específicas apenas para validação e ausência de recurso.
- Preservar histórico por status. A interface não expõe exclusão física; a remoção pontual dos fixtures ocorreu somente após confirmação e o mecanismo temporário foi retirado.
- Armazenar aulas e provas como ISO UTC em `timestamptz`, convertendo entradas locais no cliente e formatando a saída no fuso do navegador para evitar divergência de hidratação.
- Representar tópicos de prova como linhas no formulário e `text[]` no banco.
- Compartilhar um shell responsivo: sidebar em telas amplas e navegação inferior em telas pequenas, limitada a Hoje, Faculdade e Sair nesta etapa.

### Dashboard visual — Etapa 2A implementada e validada

- Manter o shell e o Dashboard como Server Components e isolar somente a identificação da rota ativa em um Client Component pequeno.
- Usar CSS Modules para a nova identidade visual do shell e Dashboard, reduzindo risco de regressão nos estilos globais da Faculdade e do login.
- Usar SVGs próprios para ícones, sem adicionar dependências.
- Alimentar resumos e compromissos somente com dados acadêmicos reais já autorizados. Módulos sem backend são apresentados como `Em breve`, sem métricas inventadas ou escrita no banco.
- Preservar destinos inexistentes como itens visuais não navegáveis, evitando rotas quebradas.
- Adotar sidebar/header no desktop e navegação inferior no mobile, com safe area, alvos de toque adequados e ausência de overflow global.
- Implementar microanimações CSS discretas e desativá-las com `prefers-reduced-motion`.
- Manter autenticação, logout, RLS, schema, consultas de proprietário e rotas acadêmicas inalterados.

### Faculdade visual — Etapa 2B implementada e validada

- Manter a central `/faculdade` como Server Component e preservar as Server Actions e formulários da Etapa 1D.
- Criar uma leitura acadêmica específica para a central sem alterar o contrato de `getFacultyOverview()`, evitando regressão no Dashboard.
- Consultar apenas campos necessários com sessão validada, RLS e filtro explícito por `user_id`; nenhuma chave privilegiada, API pública, migration ou mutation foi adicionada.
- Interpretar conclusão somente como matérias com status concluído divididas pelo total de matérias do período. Não inventar notas, frequência ou progresso individual.
- Definir a semana acadêmica como segunda-feira a domingo em `America/Sao_Paulo`; continuar formatando horários persistidos em UTC no fuso do navegador.
- Isolar o visual em `faculty-overview.module.css`, mantendo globals, AppShell, login e páginas acadêmicas internas sem acoplamento novo.
- Usar âncoras e rotas existentes na navegação interna; nenhum controle clicável sem ação real.
- Preservar a composição completa quando o banco estiver vazio, com métricas zero, mensagens honestas e criação de curso em posição secundária.
- Validar desktop e mobile como composições próprias, incluindo 375px, 430px, 768px, 1024px e desktop amplo, sem overflow horizontal e com `prefers-reduced-motion`.

### Matéria visual — Etapa 2C implementada e validada

- Manter `/faculdade/materias/[id]` como Server Component e concentrar sua composição em um componente server-side próprio, preservando os pequenos Client Components existentes apenas para formulários e apresentação local de data/hora.
- Isolar o desenho em `subject-detail.module.css`, compartilhando a identidade navy, azul e verde das Etapas 2A e 2B sem importar os CSS Modules do Dashboard ou da central da Faculdade.
- Ampliar somente a seleção relacionada de `getSubjectPage()` com metadados existentes do período; preservar consultas paralelas, sessão validada, RLS e filtros explícitos por `user_id`.
- Fixar um único timestamp na leitura `server-only` para derivar próxima aula, próxima prova, datas passadas e dias restantes de forma consistente durante a renderização, mantendo armazenamento em UTC e apresentação local existentes.
- Interpretar conclusão exclusivamente como `aulas com status completed / total de aulas`, com rótulo explícito; não representar domínio, desempenho, frequência, nota ou progresso pedagógico.
- Destacar somente a próxima prova futura com status planejado, mantendo todas as demais provas e seus tópicos disponíveis para consulta e edição.
- Preservar integralmente `SubjectForm`, `ClassSessionForm`, `ExamForm`, `ActionForm`, `DateTimeField` e as Server Actions; ações rápidas são `details` reais, sem modal ou botão inerte.
- Representar Materiais apenas como item não interativo `Em breve` e aviso contextual, sem rota, tabela, Storage, PDF, IA ou plano de revisão.
- Tratar desktop e mobile como composições próprias: grid informacional no desktop e prioridade para próxima prova, métricas, aulas, provas e ações no mobile, com safe area e ausência de overflow.
- Validar estados preenchidos e vazios com fixture apenas em memória e desenvolvimento, removida antes da revisão final; nenhum dado fictício foi persistido.

### Materiais acadêmicos — Etapa 2D.1 implementada e validada

- Versionar como imutáveis as migrations já aplicadas `20260918114607_criar_materiais_academicos_e_storage_privado.sql` e `20260918155614_corrigir_policies_storage_exclusao_materiais_academicos.sql`; qualquer nova reconciliação exige migration posterior.
- Manter `academic_materials` como metadata do PDF e `academic_material_analyses` como registro de tentativas futuras de análise. A existência da segunda tabela não significa que Gemini/IA esteja implementado.
- Manter o bucket `academic-materials` privado, com limite de 6 MiB, MIME `application/pdf` e caminho canônico `<user_id>/<subject_id>/<material_id>/source.pdf`.
- Aplicar RLS e grants mínimos às tabelas. No Storage, manter somente policies de `INSERT`, `SELECT` e `DELETE`, sem `UPDATE`.
- Adotar um único fluxo de remoção para materiais `ready`, `pending_upload` ou `upload_failed`: transicionar metadados para `deleting`, chamar `storage.remove()` e somente após sucesso concluir como `deleted` com `deleted_at` preenchido.
- Manter o estado `deleting` quando a remoção falhar, permitindo retry idempotente; não retornar automaticamente para `ready`.
- Permitir que a policy `SELECT` de `storage.objects` enxergue metadados `ready` ou `deleting`, pois a remoção pelo Storage precisa selecionar o objeto antes de excluí-lo. A policy `DELETE` aceita exclusivamente `deleting` com `deleted_at is null`.
- Manter isolamento pelo usuário autenticado e correspondência exata entre bucket, caminho canônico e metadados. Não usar `owner_id` como fronteira principal, não criar policy anônima e não criar policy `UPDATE` em `storage.objects`.
- A visibilidade técnica de `deleting` na RLS do Storage não autoriza leitura funcional. Toda futura Server Action ou Route Handler de signed URL, download ou preview deverá reler `academic_materials` e exigir `file_status = 'ready'` e `deleted_at is null` antes de acessar o objeto.
- Preservar o hard delete de `academic_materials` somente para `file_status = 'deleted'` e `deleted_at is not null`.
- Considerar `owner_id` apenas observação técnica, nunca requisito de autorização. A autorização deriva da sessão, das policies, do caminho canônico e da metadata correspondente.
- Preservar o helper `supabase/tests/materials-foundation-checks.ts` sem expô-lo como endpoint. Os runners temporários foram removidos após 33 checks runtime e 5 checks de cleanup aprovados.
- Não alterar `missions` nesta fundação e não criar missões automaticamente a partir de conteúdo futuro de IA.

### Storage operation-aware — Etapa 2D.2A aplicada e validada

- Preservar como imutáveis as duas migrations 2D.1 aplicadas. A evolução foi versionada exclusivamente em `20260924113838_adicionar_validating_e_select_storage_operation_aware.sql`.
- Adicionar `validating` à máquina de estados entre o envio do objeto e a decisão de torná-lo `ready` ou `upload_failed`.
- Permitir `SELECT` em `pending_upload` exclusivamente durante `storage.object.upload`, por meio de `storage.allow_only_operation('storage.object.upload')`; leitura normal, listagem, download e signed read permanecem negados nesse estado.
- Admitir leitura técnica do proprietário em `validating`, `ready` e `deleting`. A UI futura mantém uma regra mais restrita e só abre ou baixa o objeto quando a metadata está `ready` e `deleted_at is null`.
- Adotar na 2D.2B upload autenticado padrão diretamente do Browser para o Supabase Storage. Signed upload token foi removido da arquitetura da aplicação.
- Preservar as policies de `INSERT` e `DELETE`, a ausência de `UPDATE`, o bucket privado, caminho canônico, limite de 6 MiB, MIME PDF, Auth, grants, FKs, análises e `missions`.
- Considerar a etapa validada pelos 93/93 checks principais, 8/8 de isolamento entre duas contas e 23/23 de cleanup, incluindo negação anônima e ausência de resíduos. Nenhum frontend, upload/finalize ou IA foi implementado.

## Pendências

Registrar decisões futuras com contexto, alternativas e consequências.

## Ideias futuras

Adotar registros de decisão mais formais quando a arquitetura crescer.
