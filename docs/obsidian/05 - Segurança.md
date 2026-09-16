# Segurança

## Estado atual

O projeto Supabase e o banco existem. A Etapa 1B implementou autenticação privada; ainda não há tabelas de domínio. A aplicação usa somente Project URL e publishable key no client público. O repositório é público; dados privados nunca pertencem ao GitHub. `.env.local` não é versionado e `.env.example` contém somente nomes de variáveis e placeholders vazios.

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
- Enumeração de contas e tentativas de login indevidas.
- Cadastro público habilitado acidentalmente no provedor.

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

### Controles implementados na Etapa 1B

- Signup público desabilitado externamente no Supabase, confirmado pelo endpoint público de configurações do Auth, e ausente na aplicação.
- Somente usuários previamente criados no Supabase Auth podem entrar; não existe lista fixa de e-mails no código.
- Login por Server Action com validação de tipo, formato de e-mail e limites de tamanho. A senha não é normalizada nem armazenada pela aplicação.
- Todas as falhas de login retornam apenas `E-mail ou senha inválidos.`, sem indicar a existência da conta.
- Credenciais seguem no corpo da requisição; não são colocadas em query string, logs ou documentação.
- Proxy e layout privado exigem JWT validado por `getClaims()`; `getSession()` não é fonte de autorização server-side.
- Sessão em cookies gerenciados pelo Supabase SSR, sem sessão própria em localStorage. Cookies renovados e cabeçalhos de cache são preservados nos redirecionamentos.
- Logout remove a sessão atual; redirecionamentos têm destinos fixos e a área privada usa renderização dinâmica.
- Login válido confirmado manualmente; navegação sem sessão, credenciais fictícias inválidas, mensagem genérica, ausência de cadastro e bloqueio após logout verificados.

### Limites e verificações futuras

`getClaims()` valida assinatura e expiração do JWT; não oferece revogação instantânea de uma cópia de access token já emitida. O logout foi validado no navegador atual, onde os cookies são removidos. Verificação remota adicional será avaliada para operações sensíveis futuras.

Testes de acesso cruzado, policies, RLS, papéis e concorrência de dados dependem das etapas de domínio. Expiração natural de sessão e limitação de tentativas sob carga ainda não foram exercitadas. Antes de exposição em produção, revisar limites de Auth, controles web e configuração de HTTPS.

## Ideias futuras

Automatizar verificações de segredo e dependências no CI.
