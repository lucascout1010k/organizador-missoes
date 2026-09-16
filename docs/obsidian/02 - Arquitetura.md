# Arquitetura

## Estado atual

Frontend com Next.js, App Router, TypeScript e Tailwind CSS. A camada Supabase SSR possui clients separados para navegador e servidor, além de um proxy de sessão baseado em cookies. Não existe client administrativo.

A autenticação privada da Etapa 1B usa `/login` e uma Server Action com `signInWithPassword()`. O grupo `src/app/(protected)` mantém a rota `/`, com validação de JWT por `getClaims()` no layout. O proxy também verifica a identidade e redireciona navegações sem sessão. `/login` redireciona usuários autenticados para `/`.

O logout é uma Server Action com `signOut({ scope: "local" })`, seguida de revalidação do layout e redirecionamento para `/login`. Os redirecionamentos usam destinos fixos e preservam cookies atualizados pelo SSR. A área privada é renderizada dinamicamente, sem ISR.

## Regras aprovadas

### Fundação acadêmica e missões — Etapa 1C implementada

Modelo definido: Curso → Períodos históricos → Matérias → Aulas e Provas. `academic_courses` complementa as cinco tabelas mínimas para representar o curso sem repetir seu nome em cada período. `missions` permanece independente como entidade universal, com referências acadêmicas opcionais protegidas pelo mesmo proprietário.

Toda tabela possui `user_id`, RLS e policies CRUD individuais. FKs compostas `(user_id, id)` impedem referências cruzadas. A migration foi aplicada manualmente pelo usuário e a integração foi validada em 81 checks, incluindo limpeza dos registros fictícios. O helper em `supabase/tests` não é endpoint; a tela e a Server Action temporárias de teste foram removidas. Esta etapa não inclui a interface completa, PDF, IA ou módulos adicionais.

Frontend responsivo. Backend com Supabase e PostgreSQL; Auth adotado na Etapa 1B e RLS aplicada na Etapa 1C. Edge Functions e tarefas agendadas serão adotadas somente quando necessárias e aprovadas. Infraestrutura: GitHub público e Supabase; Vercel permanece planejada. Uso inicialmente single-user, com dados privados modelados por `user_id` para multi-user.

## Pendências

Futuras páginas privadas devem pertencer ao grupo protegido; novas operações de dados e Server Actions deverão validar identidade e autorização no próprio ponto de acesso. Interface de domínio somente em etapa autorizada.

## Ideias futuras

Adotar funções de borda somente quando houver justificativa técnica.
