# Autenticação

## Estado atual

A Etapa 1B implementou autenticação privada com Supabase Auth, usando a infraestrutura SSR da Etapa 1A. Cadastro público desabilitado externamente no Supabase e não implementado na aplicação.

`/login` oferece apenas e-mail, senha e o botão Entrar. Uma Server Action valida os campos e chama `signInWithPassword()`. Em sucesso, revalida o layout e redireciona para `/`; em falha, exibe somente `E-mail ou senha inválidos.`.

Proxy e layout de `src/app/(protected)` verificam a identidade com `getClaims()`. A home mostra somente conteúdo neutro e o botão Sair. Acesso sem sessão redireciona para `/login`; acesso autenticado a `/login` redireciona para `/`.

O botão Sair chama uma Server Action com `signOut({ scope: "local" })`. A sessão atual é encerrada, o layout é revalidado e o navegador volta para `/login`. Outras sessões não são encerradas por esse botão.

## Regras aprovadas

Somente usuários previamente criados no Supabase Auth podem entrar. Nenhum e-mail autorizado fica fixo no código. O uso é single-user nesta fase, com preparação multi-user mantida para o futuro. OAuth, magic link, login anônimo e cadastro não fazem parte desta etapa.

Sessões ficam em cookies do Supabase SSR. Não registrar credenciais nem respostas sensíveis; não usar `getSession()` para autorizar no servidor.

### Validações da Etapa 1B

- Login manual positivo confirmado pelo usuário com `LOGIN VALIDADO`, sem captura de credenciais.
- `/login` acessível sem sessão; `/` redireciona para `/login` sem sessão.
- Credenciais fictícias inválidas não liberam a área privada e retornam a mensagem genérica.
- Nenhuma interface de cadastro ou login social.
- Usuário autenticado em `/login` volta para `/`.
- Logout retorna ao login; novo acesso a `/` continua bloqueado.

Durante o teste local, a restrição de rede do processo de desenvolvimento impediu a comunicação com o Auth (`status: 0`). Reiniciar o servidor com acesso de rede resolveu o bloqueio e permitiu validar o login real. A instrumentação temporária foi removida.

## Pendências

Recuperação de acesso na aplicação, testes de expiração natural da sessão e autorização de dados de domínio serão tratados somente em etapas aprovadas.

## Ideias futuras

Experiência de acesso simples e segura em múltiplos dispositivos.
