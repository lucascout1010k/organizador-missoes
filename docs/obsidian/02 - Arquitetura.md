# Arquitetura

## Estado atual

Frontend com Next.js, App Router, TypeScript e Tailwind CSS. A camada Supabase SSR possui clients separados para navegador e servidor, além de um proxy de sessão baseado em cookies. Não existe client administrativo.

A autenticação privada da Etapa 1B usa `/login` e uma Server Action com `signInWithPassword()`. O grupo `src/app/(protected)` mantém a rota `/`, com validação de JWT por `getClaims()` no layout. O proxy também verifica a identidade e redireciona navegações sem sessão. `/login` redireciona usuários autenticados para `/`.

O logout é uma Server Action com `signOut({ scope: "local" })`, seguida de revalidação do layout e redirecionamento para `/login`. Os redirecionamentos usam destinos fixos e preservam cookies atualizados pelo SSR. A área privada é renderizada dinamicamente, sem ISR.

A Etapa 1D adicionou um shell privado responsivo compartilhado entre Hoje e Faculdade. A Etapa 2A refatorou sua camada visual: sidebar e header no desktop, navegação inferior no mobile, CSS Modules para isolar o novo design e um Client Component pequeno apenas para estado ativo da navegação. A Etapa 2B manteve `/faculdade` como Server Component e adicionou uma leitura `server-only` específica para sua central, paralelizando cursos, períodos, matérias, provas dos próximos 30 dias e aulas da semana atual. Essa leitura valida a sessão, filtra explicitamente por `user_id` e preserva RLS; o contrato usado pelo Dashboard não foi alterado. A Etapa 2C manteve `/faculdade/materias/[id]` como Server Component e isolou sua composição visual em `subject-detail.tsx` e CSS Module próprio. `getSubjectPage()` continua paralelizando matéria, aulas e provas e passou a retornar somente metadados já existentes do período e um timestamp único da leitura, usado para derivar próxima aula, próxima prova e dias restantes sem inconsistência durante a renderização. O visual da central e do detalhe permanece semanticamente desacoplado. Mutações continuam nas Server Actions existentes, com validação no servidor e revalidação das rotas afetadas. Componentes client-side permanecem limitados a interações pontuais e à conversão/apresentação de data e hora no fuso do navegador.

Rotas acadêmicas atuais: `/faculdade`, `/faculdade/historico`, `/faculdade/periodos/[id]` e `/faculdade/materias/[id]`.

A Etapa 2D.1 adicionou a fundação de dados para materiais sem criar rota ou frontend. `academic_materials` guarda metadata e ciclo de vida do arquivo; `academic_material_analyses` reserva tentativas futuras de análise com consentimento, estado e resultado estruturado. O bucket `academic-materials` é privado, aceita somente `application/pdf` até 6 MiB e usa o caminho canônico `<user_id>/<subject_id>/<material_id>/source.pdf`. As tabelas e os objetos são isolados pelo usuário autenticado e pela correspondência exata com a metadata.

No Storage existem policies somente de `INSERT`, `SELECT` e `DELETE`; não existe policy de `UPDATE`. A leitura técnica da policy de objetos admite metadata `ready` ou `deleting` porque `storage.remove()` precisa selecionar antes de excluir. Isso não autoriza download funcional durante `deleting`: qualquer futura Server Action ou Route Handler de download, preview ou signed URL deverá reler a metadata e exigir `file_status = 'ready'` e `deleted_at is null`.

## Regras aprovadas

### Fundação acadêmica e missões — Etapa 1C implementada

Modelo definido: Curso → Períodos históricos → Matérias → Aulas e Provas. `academic_courses` complementa as cinco tabelas mínimas para representar o curso sem repetir seu nome em cada período. Materiais pertencem a matérias e podem referenciar uma aula do mesmo usuário e da mesma matéria. `missions` permanece independente como entidade universal e não foi alterada pela Etapa 2D.1.

Toda tabela possui `user_id`, RLS e policies CRUD individuais. FKs compostas `(user_id, id)` impedem referências cruzadas. A migration foi aplicada manualmente pelo usuário e a integração foi validada em 81 checks, incluindo limpeza dos registros fictícios. O helper em `supabase/tests` não é endpoint; a tela e a Server Action temporárias de teste foram removidas. Esta etapa não inclui a interface completa, PDF, IA ou módulos adicionais.

Frontend responsivo. Backend com Supabase e PostgreSQL; Auth adotado na Etapa 1B e RLS aplicada na Etapa 1C. Edge Functions e tarefas agendadas serão adotadas somente quando necessárias e aprovadas. Infraestrutura: GitHub público e Supabase; Vercel permanece planejada. Uso inicialmente single-user, com dados privados modelados por `user_id` para multi-user.

## Pendências

Futuras páginas privadas devem pertencer ao grupo protegido; novas operações de dados e Server Actions deverão validar identidade e autorização no próprio ponto de acesso. Novos domínios somente em etapa autorizada.

## Ideias futuras

Adotar funções de borda somente quando houver justificativa técnica.
