# Segurança

## Estado atual

Sem autenticação, banco ou segredos. O repositório será público; dados privados nunca pertencem ao GitHub. `.env.local` não será versionado e `.env.example` pode ser versionado somente com nomes de variáveis e placeholders vazios.

## Regras aprovadas

Nunca expor `service_role` no navegador. Tabelas privadas futuras usarão RLS e autorização baseada no usuário autenticado. Usar dados fictícios na documentação, evitar PII em logs e manter segredos de produção nos provedores apropriados. Autenticação, autorização e RLS deverão ser testados. Se um agente detectar possível segredo, deverá interromper a tarefa.

## Pendências

Status: planejado / não implementado. Criar modelo de ameaças antes das integrações.

## Ideias futuras

Automatizar verificações de segredo e dependências no CI.
