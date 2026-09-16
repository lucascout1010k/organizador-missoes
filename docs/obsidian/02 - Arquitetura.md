# Arquitetura

## Estado atual

Frontend com Next.js, App Router, TypeScript e Tailwind CSS. A camada Supabase SSR possui clients separados para navegador e servidor, além de um proxy de sessão baseado em cookies. Não existe client administrativo.

## Regras aprovadas

Frontend responsivo. Backend com Supabase e PostgreSQL; Auth, RLS, Edge Functions e tarefas agendadas serão adotados somente quando necessários e aprovados. Infraestrutura: GitHub público e Supabase; Vercel permanece planejada. Uso inicialmente single-user, com arquitetura multi-user e registros privados vinculados a `user_id`.

## Pendências

Status: planejado / não implementado para autenticação, autorização e integração de dados de domínio.

## Ideias futuras

Adotar funções de borda somente quando houver justificativa técnica.
