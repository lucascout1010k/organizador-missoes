# Decisões Técnicas

## Estado atual

Fundação local com npm, Next.js App Router, TypeScript, Tailwind CSS, ESLint, diretório `src/` e alias `@/*`. O baseline está publicado em um repositório GitHub público na branch `main`.

## Regras aprovadas

Evitar dependências e recursos experimentais sem necessidade. Arquitetar dados privados para multi-user mesmo com uso inicial single-user.

### GitHub público e identidade de commit

O repositório público favorece portfólio, transparência do código e documentação pública. A identidade Git é configurada somente no repositório com endereço associado à conta GitHub; o endereço não deve ser registrado na documentação. Dados pessoais e segredos permanecem fora do repositório.

### Chaves do Supabase

Projetos novos usam Supabase publishable key para componentes públicos; nenhuma secret key será adicionada até existir necessidade server-side concreta e revisão específica do Agente 1. A configuração real permanece somente em `.env.local`.

## Pendências

Registrar decisões futuras com contexto, alternativas e consequências.

## Ideias futuras

Adotar registros de decisão mais formais quando a arquitetura crescer.
