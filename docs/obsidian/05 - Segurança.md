# Segurança

## Estado atual

O projeto Supabase e o banco existem, mas ainda não há autenticação nem tabelas de domínio. A aplicação usa somente Project URL e publishable key no client público. O repositório é público; dados privados nunca pertencem ao GitHub. `.env.local` não é versionado e `.env.example` contém somente nomes de variáveis e placeholders vazios.

## Regras aprovadas

Nunca expor `service_role` no navegador. Tabelas privadas futuras usarão RLS e autorização baseada no usuário autenticado. Usar dados fictícios na documentação, evitar PII em logs e manter segredos de produção nos provedores apropriados. Autenticação, autorização e RLS deverão ser testados. Se um agente detectar possível segredo, deverá interromper a tarefa.

## Pendências

Revisar e ampliar o modelo de ameaças antes de cada etapa que introduzir autenticação, dados privados ou novas superfícies de ataque.

## Modelo de ameaças inicial

### Ativos protegidos

- Tarefas pessoais.
- Agenda.
- Dados acadêmicos.
- Dados de academia.
- Projetos pessoais.
- Sessão de autenticação.
- Futuras push subscriptions.

### Ameaças consideradas

- Vazamento pelo GitHub público.
- Acesso de usuário não autenticado.
- Acesso cruzado entre usuários.
- Vazamento de secret key ou `service_role`.
- Sessão roubada.
- Logs contendo PII.
- Tabela criada sem RLS.
- Grants excessivos para `anon` ou `authenticated`.
- XSS levando a roubo de sessão ou dados.
- Configuração incorreta de ambiente.

### Controles aprovados

- `.env.local` fora do Git.
- Somente publishable key no frontend.
- Nenhuma secret key no navegador.
- Supabase Auth.
- RLS obrigatório para dados privados.
- Grants mínimos.
- Testes negativos de autenticação e autorização.
- Cookies e sessão SSR.
- Validação de inputs.
- Documentação pública somente com dados fictícios.

A publishable key não é tratada como segredo. Ela identifica o cliente público; seu alcance real deverá ser limitado por Auth, grants mínimos e RLS.

## Ideias futuras

Automatizar verificações de segredo e dependências no CI.
