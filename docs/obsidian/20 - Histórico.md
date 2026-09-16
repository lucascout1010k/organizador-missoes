# Histórico

## Estado atual

- 2026-09-15 — Etapa 0A implementada: fundação local, home mínima, documentação, Git local e controles básicos de segurança. Lint e build concluídos com sucesso.
- 2026-09-15 — Etapa 0B concluída: identidade Git local configurada, branch `main`, baseline inicial publicado no repositório público `lucascout1010k/organizador-missoes` e segundo cérebro atualizado. Vercel e Supabase permanecem não configurados.
- 2026-09-15 — O Agente 1 validou a Etapa 0B e o segundo cérebro foi sincronizado com o estado real antes do início da Etapa 1.
- 2026-09-16 — Etapa 1A concluída: dependências Supabase fixadas, clients SSR, proxy de sessão e configuração local com publishable key validados. A comunicação pública com o Auth respondeu corretamente. Nenhuma tabela, migration, autenticação ou rota protegida foi criada.
- 2026-09-16 — Etapa 1A validada pelo Agente 1. Etapa 1B implementada: login privado por e-mail e senha, cookies SSR, proteção por proxy e layout com JWT validado e logout da sessão atual. Cadastro público desabilitado no Supabase e ausente na aplicação; preparação multi-user preservada. Login manual confirmado pelo usuário e testes negativos de navegação, credenciais inválidas e logout concluídos. Bloqueio de rede do servidor local foi resolvido; diagnóstico temporário removido. Nenhuma tabela de domínio ou configuração Vercel criada. Segundo cérebro atualizado antes da Etapa 1C, que permanece não iniciada.

- 2026-09-16 — Etapa 1B validada pelo Agente 1. Etapa 1C iniciada: documentação da hierarquia acadêmica atualizada primeiro e migration local preparada com cursos, períodos históricos, matérias, aulas, provas e missões; RLS CRUD, grants mínimos e FKs por proprietário. Lint, build, TypeScript, diff check e verificações estáticas locais aprovados; varredura sem segredos ou dados pessoais identificados nos arquivos versionáveis. O SQL ainda não foi executado em PostgreSQL. Aplicação manual no Supabase e testes autenticados pendentes; nenhum commit ou push desta etapa realizado. Etapa 1D não iniciada.

- 2026-09-16 — Usuário confirmou `MIGRATION APLICADA`. Etapa 1C validada pela integração real com sessão autenticada e publishable key: 81 checks aprovados de CRUD, triggers, RLS, negação anônima, constraints, origens acadêmicas e histórico arquivado. Seis registros fictícios removidos e limpeza confirmada; tela/action temporárias removidas. Sem conta adicional, chaves privilegiadas, IA, PDF, Storage ou Vercel. Segundo cérebro sincronizado; Etapa 1D não iniciada.

- 2026-09-16 — Etapa 1D implementada e confirmada com `FACULDADE VALIDADA`: shell privado responsivo, home acadêmica e rotas de Faculdade para visão geral, histórico, períodos e matérias; criação, edição e status de curso, períodos, matérias, aulas e provas; datas locais convertidas para UTC e tópicos persistidos como lista. O fluxo real foi exercitado pela interface, incluindo histórico, recarga e prova futura na home. Fixtures removidos após a confirmação e estado vazio verificado; ação temporária de limpeza retirada. Sem migration, dependência, exclusão física permanente na UI, IA, PDF, Storage ou Vercel. Etapa 1E permanece bloqueada até autorização.

## Regras aprovadas

Registrar mudanças relevantes sem incluir dados pessoais ou segredos.

## Pendências

Atualizar após cada etapa aprovada.

## Ideias futuras

Relacionar entradas futuras às decisões técnicas afetadas.
