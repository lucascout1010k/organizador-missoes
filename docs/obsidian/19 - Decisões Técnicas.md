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

## Pendências

Registrar decisões futuras com contexto, alternativas e consequências.

## Ideias futuras

Adotar registros de decisão mais formais quando a arquitetura crescer.
