# Banco de Dados

## Estado atual

O projeto Supabase foi criado na região South America (São Paulo) e o banco existe. Nenhuma tabela de domínio foi criada e nenhuma migration de domínio foi aplicada.

## Regras aprovadas

PostgreSQL via Supabase; dados privados com `user_id` e RLS obrigatório. Grants e policies serão definidos explicitamente em migrations futuras. Tabelas novas não deverão ser automaticamente expostas.

## Pendências

Modelar entidades, índices, constraints e políticas em etapa aprovada.

## Ideias futuras

Histórico auditável das mudanças importantes de missões.
