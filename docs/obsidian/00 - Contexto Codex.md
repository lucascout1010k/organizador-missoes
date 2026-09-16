# Contexto Codex

## Estado atual

As Etapas 0A, 0B, 1A, 1B, 1C e 1D foram concluídas. A fundação em Next.js está publicada no repositório GitHub público `lucascout1010k/organizador-missoes`, com a branch principal `main`.

O projeto Supabase está configurado localmente somente com Project URL e publishable key. A Etapa 1B implementou autenticação privada por e-mail e senha, sessão SSR, proteção de rotas e logout. O cadastro público está desabilitado externamente no Supabase e não foi implementado na aplicação. O uso atual é single-user, sem e-mail fixo no código, mantendo preparação para multi-user.

A fundação de dados da Etapa 1C está implementada: migration aplicada manualmente no Supabase, seis tabelas com RLS e grants explícitos e 81 checks de integração aprovados com sessão do usuário e publishable key. A Etapa 1D implementou e validou a interface funcional da Faculdade e a visão acadêmica da home. O fluxo real de curso, períodos, matérias, aulas e provas foi testado pela interface; os registros fictícios foram removidos após a confirmação `FACULDADE VALIDADA`, e a limpeza foi verificada no estado vazio. A Vercel continua não configurada e a Etapa 1E depende de autorização.

## Regras aprovadas

Antes de qualquer implementação relevante:

1. Ler `00 - Contexto Codex.md`.
2. Identificar quais notas estão relacionadas à missão.
3. Ler somente as notas relevantes.
4. Depois inspecionar somente os arquivos de código necessários.
5. Implementar a mudança.
6. Executar validações.
7. Atualizar as notas afetadas.
8. Atualizar `20 - Histórico.md` quando houver mudança relevante.
9. Informar no relatório as notas consultadas, notas modificadas, arquivos modificados e testes executados.

O código executável é a fonte final da verdade técnica.

O Obsidian é o mapa documentado e atualizado dessa verdade.

Em caso de divergência, investigar o código e corrigir a documentação.

Nunca modificar código apenas para fazê-lo coincidir com documentação desatualizada.

O repositório será público. Não registrar segredos, PII nem dados pessoais reais; exemplos devem ser fictícios.

## Pendências

Executar cada etapa futura somente após aprovação.

## Ideias futuras

Evoluir o segundo cérebro junto com o código e registrar decisões arquiteturais relevantes.
