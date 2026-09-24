# Segurança

## Estado atual

O projeto Supabase e o banco existem. A Etapa 1B implementou autenticação privada. A migration de domínio da Etapa 1C foi aplicada manualmente; CRUD próprio, negação anônima e rejeição de proprietário divergente foram verificados nas seis tabelas. A Etapa 2D.1 adicionou duas tabelas privadas e um bucket privado para materiais acadêmicos, com migrations aplicadas manualmente e 38/38 checks de runtime e cleanup aprovados. A aplicação usa somente Project URL e publishable key no client público. O repositório é público; dados privados nunca pertencem ao GitHub. `.env.local` não é versionado e `.env.example` contém somente nomes de variáveis e placeholders vazios.

## Regras aprovadas

Nunca expor `service_role` no navegador; a Etapa 1C não utiliza essa chave nem solicita senha do banco ou connection string. Tabelas privadas devem usar RLS e autorização baseada no usuário autenticado. Usar dados fictícios na documentação, evitar PII em logs e manter segredos de produção nos provedores apropriados. Autenticação, autorização e RLS deverão ser testados. Se um agente detectar possível segredo, deverá interromper a tarefa.

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

### Controles da Etapa 1C — aplicação e integração verificadas

- Seis tabelas privadas com `user_id NOT NULL` referenciando `auth.users(id)`.
- RLS habilitada explicitamente e forçada; quatro policies por tabela, limitadas a `authenticated`, com comparação entre `auth.uid()` e `user_id`.
- INSERT exige `WITH CHECK`; UPDATE exige `USING` e `WITH CHECK`, impedindo transferir registros para outro proprietário.
- Privilégios anteriores revogados de `PUBLIC`, `anon` e `authenticated` nas novas tabelas; somente SELECT, INSERT, UPDATE e DELETE são concedidos a `authenticated`. Nenhum grant de TRUNCATE, REFERENCES ou TRIGGER para clientes.
- FKs compostas validam proprietário e existência do curso, período, matéria, aula ou prova referenciados. A proteção não depende da interface.
- Origens acadêmicas das missões usam colunas geradas e FKs reais; IDs de origens ainda não implementadas não são aceitos.
- Trigger compartilhada em schema privado, `SECURITY INVOKER`, com `search_path` vazio e sem EXECUTE concedido a clientes. Não existe RPC administrativa ou função `SECURITY DEFINER` nesta migration.
- Aplicação manual e integral pelo SQL Editor, em transação. Nenhum dado de usuário é inserido pela migration.

RLS não limita papéis administrativos com `BYPASSRLS`, como o usado no SQL Editor. Os testes de aplicação usaram somente publishable key e sessão validada com `getUser()`, nunca o editor como prova de acesso autenticado. Nas seis tabelas, INSERT e UPDATE com proprietário divergente retornaram `42501`; operações anônimas também foram negadas. Sem segunda conta, a inspeção estática e a rejeição de `user_id` divergente não equivalem a um teste completo entre duas contas reais.

### Limites e verificações futuras

`getClaims()` valida assinatura e expiração do JWT; não oferece revogação instantânea de uma cópia de access token já emitida. O logout foi validado no navegador atual, onde os cookies são removidos. Verificação remota adicional será avaliada para operações sensíveis futuras.

Os 81 checks da Etapa 1C passaram e os seis registros fictícios foram removidos; consultas finais confirmaram a limpeza. Nenhuma conta foi criada ou alterada, nem credencial capturada em logs/documentação. A tela e a action temporárias foram removidas. Concorrência de dados, expiração natural de sessão e limitação de tentativas sob carga ainda não foram exercitadas. Antes de exposição em produção, revisar limites de Auth, controles web e configuração de HTTPS.

### Controles da Etapa 2D.1 — Materiais acadêmicos

- `academic_materials` e `academic_material_analyses` usam `user_id`, RLS habilitada e forçada, grants mínimos e policies por operação para `authenticated`; `anon` não recebe acesso.
- FKs compostas impedem associar material, aula, matéria ou análise de proprietários diferentes. Constraints limitam MIME, tamanho, caminho, estados e cronologia das análises.
- O bucket `academic-materials` é privado, limitado a 6 MiB e `application/pdf`. O caminho deve ser exatamente `<user_id>/<subject_id>/<material_id>/source.pdf`.
- `storage.objects` possui policies de `INSERT`, `SELECT` e `DELETE`, sem policy de `UPDATE`. Inserção exige metadata `pending_upload`; remoção exige metadata `deleting`.
- A policy técnica de `SELECT` aceita `ready` e `deleting` para viabilizar `storage.remove()`. A aplicação não deve usar essa visibilidade como autorização funcional: downloads, previews e signed URLs futuros exigem metadata `ready` e `deleted_at is null`.
- O ciclo oficial de exclusão é `ready`, `pending_upload` ou `upload_failed` → `deleting` → `storage.remove()` → `deleted` com `deleted_at`; hard delete da metadata somente depois de `deleted`.
- O runtime usou publishable key e duas contas reais, sem `service_role` ou cliente administrativo. Signed upload, magic bytes `%PDF-`, isolamento A/B, negação anônima, bloqueio de remoção em `ready`, remoção em `deleting` e cleanup foram verificados.
- `owner_id` foi apenas observado tecnicamente e não constitui fronteira de autorização. Nenhuma credencial, token ou URL assinada foi registrada.

## Ideias futuras

Automatizar verificações de segredo e dependências no CI.
