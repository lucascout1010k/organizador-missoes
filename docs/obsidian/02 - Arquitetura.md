# Arquitetura

## Estado atual

Frontend com Next.js, App Router, TypeScript e Tailwind CSS. A camada Supabase SSR possui clients separados para navegador e servidor, além de um proxy de sessão baseado em cookies. Não existe client administrativo.

A autenticação privada da Etapa 1B usa `/login` e uma Server Action com `signInWithPassword()`. O grupo `src/app/(protected)` mantém a rota `/`, com validação de JWT por `getClaims()` no layout. O proxy também verifica a identidade e redireciona navegações sem sessão. `/login` redireciona usuários autenticados para `/`.

O logout é uma Server Action com `signOut({ scope: "local" })`, seguida de revalidação do layout e redirecionamento para `/login`. Os redirecionamentos usam destinos fixos e preservam cookies atualizados pelo SSR. A área privada é renderizada dinamicamente, sem ISR.

A Etapa 1D adicionou um shell privado responsivo compartilhado entre Hoje e Faculdade. A Etapa 2A refatorou sua camada visual: sidebar e header no desktop, navegação inferior no mobile, CSS Modules para isolar o novo design e um Client Component pequeno apenas para estado ativo da navegação. A Etapa 2B manteve `/faculdade` como Server Component e adicionou uma leitura `server-only` específica para sua central, paralelizando cursos, períodos, matérias, provas dos próximos 30 dias e aulas da semana atual. Essa leitura valida a sessão, filtra explicitamente por `user_id` e preserva RLS; o contrato usado pelo Dashboard não foi alterado. A Etapa 2C manteve `/faculdade/materias/[id]` como Server Component e isolou sua composição visual em `subject-detail.tsx` e CSS Module próprio. `getSubjectPage()` continua paralelizando matéria, aulas e provas e passou a retornar somente metadados já existentes do período e um timestamp único da leitura, usado para derivar próxima aula, próxima prova e dias restantes sem inconsistência durante a renderização. O visual da central e do detalhe permanece semanticamente desacoplado. Mutações continuam nas Server Actions existentes, com validação no servidor e revalidação das rotas afetadas. Componentes client-side permanecem limitados a interações pontuais e à conversão/apresentação de data e hora no fuso do navegador.

Rotas acadêmicas atuais: `/faculdade`, `/faculdade/historico`, `/faculdade/periodos/[id]` e `/faculdade/materias/[id]`.

A Etapa 2D.1 adicionou a fundação de dados para materiais sem criar rota ou frontend. `academic_materials` guarda metadata e ciclo de vida do arquivo; `academic_material_analyses` reserva tentativas futuras de análise com consentimento, estado e resultado estruturado. O bucket `academic-materials` é privado, aceita somente `application/pdf` até 6 MiB e usa o caminho canônico `<user_id>/<subject_id>/<material_id>/source.pdf`. As tabelas e os objetos são isolados pelo usuário autenticado e pela correspondência exata com a metadata.

No Storage existem policies somente de `INSERT`, `SELECT` e `DELETE`; não existe policy de `UPDATE`. A Etapa 2D.2A acrescentou `validating` à máquina de estados e tornou a policy de `SELECT` sensível à operação: em `pending_upload`, o objeto é selecionável apenas durante `storage.object.upload`; a leitura normal continua negada. Para o proprietário, a leitura técnica normal admite metadata `validating`, `ready` ou `deleting`. Isso não amplia a autorização funcional da futura UI: abertura, preview e download exigirão metadata `ready` e `deleted_at is null`.

O fluxo implementado e validado em runtime na 2D.2B usa upload autenticado padrão diretamente do Browser para o Supabase Storage, sem signed upload token. Após o envio bem-sucedido, a metadata permanece `pending_upload`; a transição para `validating` e a decisão autoritativa futura dependem de finalize, ainda não implementado. `ready` não representa fluxo funcional concluído nesta entrega. A 2D.2A apenas preparou e validou o contrato de banco e Storage. A integração de IA continua inexistente.

## Regras aprovadas

### Prepare de Materiais — 2D.2B.1 implementada localmente

O domínio está separado em `src/lib/academic/materials/{types,validation,data}.ts`. A Server Action em `faculdade/materias/[id]/materiais/actions.ts` recebe somente metadata, valida a entrada em runtime e usa o client SSR existente. `materials/data.ts` é `server-only` e limita as consultas por identidade validada e relacionamento. O INSERT é explícito e cria exclusivamente `pending_upload`, com `deleted_at = null`; o retorno contém apenas `ok`, `materialId`, `storagePath` e `fileStatus`.

A 2D.2B.1 não introduziu consumidor browser, leitura de Storage, UPDATE, exclusão ou escrita em estados posteriores. Falhas retornam códigos estáveis e mensagens sanitizadas; não há logs de metadata ou sessão. Erro técnico de `getClaims()` retorna `PREPARE_FAILED`; sem erro, identidade ausente/inválida retorna `AUTH_REQUIRED`. Prepare não é idempotente: uma resposta perdida pode deixar metadata criada e não deve provocar repetição automática. A confiança nas transições para `ready` dependerá de uma fronteira de escrita a definir na 2D.2C.

### Upload browser e comunicação de falha — 2D.2B.2

`MaterialUploadForm` é um Client Component mínimo montado no detalhe existente da matéria, sem nova página visual final. Recebe apenas a matéria, opções de aulas e referências de Server Actions. O File permanece em memória e somente seis campos pequenos entram no prepare. O SDK browser envia o File a `academic-materials`, no caminho exato retornado pelo servidor, com `upsert: false` e MIME PDF; nenhum byte do arquivo passa por Next.js/Vercel.

O controlador separa a interação React do fluxo testável, trava submissões sincronicamente antes do primeiro await e bloqueia nova tentativa nessa montagem depois de prepare bem-sucedido ou resultado incerto. Não há upload em effect, progresso inventado, retry automático, leitura de existência, URL pública ou signed upload token. Sucesso informa "Arquivo enviado. Validação pendente." sem chamar finalize ou alterar `pending_upload`.

Somente rejeição explícita allowlisted de Storage com código/status coerentes dispara `reportMaterialUploadFailure`. A action reautentica e executa um UPDATE único filtrado por material, proprietário, `pending_upload` e `deleted_at IS NULL`, alterando exclusivamente `file_status` para `upload_failed`. Zero linhas ou falha de report não são sucesso; nenhum estado posterior pode ser sobrescrito por report atrasado. Transporte, timeout, abort, 5xx, conflito e código desconhecido ficam incertos e exigem reconciliação futura.

### Verificação do transporte — 2D.2B.3

A 2D.2B.3 comprovou o transporte real pelo formulário da matéria: a Server Action recebeu apenas seis campos primitivos e o File foi enviado diretamente ao endpoint do Storage. O diagnóstico temporário não recebeu o File nem no cleanup: a prova física usou metadata técnica de listagem em `deleting`. Autenticação ausente foi exercitada com o SDK real sem sessão; erro técnico de claims, 5xx, status 0, abort/timeout e rejeição coerente do controlador foram explicitamente simulados. Reports atrasados em `deleting`/`deleted` foram reais; `validating`/`ready` continuaram apenas nos testes locais, sem escrita remota desses estados.

A rodada cruzada confirmou prepare/report e operações de metadata/Storage negados para B sobre recursos de A, incluindo overwrite e paths inventados. As fontes reais das actions de B foram executadas em memória com client autenticado real, claims e consultas reais; isso exercita seus corpos de autorização, não uma segunda rodada do transporte HTTP de Server Actions. A leitura técnica de A em `deleting` forneceu controle positivo para distinguir isolamento de negação por estado. Resultado consolidado: 54 checks principais + 13 A/B + 15 cleanup = 82/82; 245 testes locais previamente aprovados. Todos os diagnósticos foram removidos. Auth/RLS/migrations/missions permanecem intactos. A referência `4. Materiais-PDF-IA` continua reservada para o redesign posterior, não implementado.

### Fundação acadêmica e missões — Etapa 1C implementada

Modelo definido: Curso → Períodos históricos → Matérias → Aulas e Provas. `academic_courses` complementa as cinco tabelas mínimas para representar o curso sem repetir seu nome em cada período. Materiais pertencem a matérias e podem referenciar uma aula do mesmo usuário e da mesma matéria. `missions` permanece independente como entidade universal e não foi alterada pela Etapa 2D.1.

Toda tabela possui `user_id`, RLS e policies CRUD individuais. FKs compostas `(user_id, id)` impedem referências cruzadas. A migration foi aplicada manualmente pelo usuário e a integração foi validada em 81 checks, incluindo limpeza dos registros fictícios. O helper em `supabase/tests` não é endpoint; a tela e a Server Action temporárias de teste foram removidas. Esta etapa não inclui a interface completa, PDF, IA ou módulos adicionais.

Frontend responsivo. Backend com Supabase e PostgreSQL; Auth adotado na Etapa 1B e RLS aplicada na Etapa 1C. Edge Functions e tarefas agendadas serão adotadas somente quando necessárias e aprovadas. Infraestrutura: GitHub público e Supabase; Vercel permanece planejada. Uso inicialmente single-user, com dados privados modelados por `user_id` para multi-user.

## Pendências

Futuras páginas privadas devem pertencer ao grupo protegido; novas operações de dados e Server Actions deverão validar identidade e autorização no próprio ponto de acesso. Novos domínios somente em etapa autorizada.

## Ideias futuras

Adotar funções de borda somente quando houver justificativa técnica.
