# Arquitetura

## Estado atual

Frontend com Next.js, App Router, TypeScript e Tailwind CSS. A camada Supabase SSR possui clients separados para navegador e servidor, além de um proxy de sessão baseado em cookies. Não existe client administrativo.

A autenticação privada da Etapa 1B usa `/login` e uma Server Action com `signInWithPassword()`. O grupo `src/app/(protected)` mantém a rota `/`, com validação de JWT por `getClaims()` no layout. O proxy também verifica a identidade e redireciona navegações sem sessão. `/login` redireciona usuários autenticados para `/`.

O logout é uma Server Action com `signOut({ scope: "local" })`, seguida de revalidação do layout e redirecionamento para `/login`. Os redirecionamentos usam destinos fixos e preservam cookies atualizados pelo SSR. A área privada é renderizada dinamicamente, sem ISR.

## Regras aprovadas

Frontend responsivo. Backend com Supabase e PostgreSQL; Auth adotado na Etapa 1B. RLS, Edge Functions e tarefas agendadas serão adotados somente quando necessários e aprovados. Infraestrutura: GitHub público e Supabase; Vercel permanece planejada. Uso inicialmente single-user, com preparação multi-user e futuros registros privados vinculados a `user_id`.

## Pendências

Autorização por recurso e integração de dados de domínio permanecem planejadas. Futuras páginas privadas devem pertencer ao grupo protegido; novas operações de dados e Server Actions deverão validar identidade e autorização no próprio ponto de acesso.

## Ideias futuras

Adotar funções de borda somente quando houver justificativa técnica.
