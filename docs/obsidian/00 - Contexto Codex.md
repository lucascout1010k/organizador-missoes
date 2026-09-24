# Contexto Codex

## Estado atual

As Etapas 0A, 0B, 1A, 1B, 1C, 1D, 2A, 2B, 2C e 2D.1 foram concluídas. A fundação em Next.js está publicada no repositório GitHub público `lucascout1010k/organizador-missoes`, com a branch principal `main`.

O projeto Supabase está configurado localmente somente com Project URL e publishable key. A Etapa 1B implementou autenticação privada por e-mail e senha, sessão SSR, proteção de rotas e logout. O cadastro público está desabilitado externamente no Supabase e não foi implementado na aplicação. O uso atual é single-user, sem e-mail fixo no código, mantendo preparação para multi-user.

A fundação de dados da Etapa 1C está implementada: migration aplicada manualmente no Supabase, seis tabelas com RLS e grants explícitos e 81 checks de integração aprovados com sessão do usuário e publishable key. A Etapa 1D implementou e validou a interface funcional da Faculdade. A Etapa 2A transformou a home em um Dashboard visual responsivo e estabeleceu a identidade dark premium em navy, azul e verde do shell privado. A Etapa 2B aplicou essa mesma identidade à central da Faculdade, com métricas acadêmicas reais, matérias, provas em 30 dias, aulas da semana, histórico e estados vazios responsivos. A Etapa 2C redesenhou o detalhe da matéria na mesma identidade, priorizando próxima prova, conclusão real das aulas, cronologia, tópicos e ações acadêmicas existentes, com composição própria para desktop e mobile.

A Etapa 2D.1 implementou somente a fundação segura de Materiais: tabelas `academic_materials` e `academic_material_analyses`, bucket privado `academic-materials`, PDF de até 6 MiB, caminho canônico por usuário/matéria/material, RLS e ciclo de exclusão controlado. As duas migrations foram aplicadas manualmente e o runtime real passou em 38/38 verificações, incluindo signed upload, isolamento entre duas contas, negação anônima e cleanup integral. O frontend de Materiais, o processamento de PDF e a integração de IA ainda não foram implementados; `missions` permaneceu inalterada. Academia e Projetos continuam planejados. A Vercel continua não configurada e qualquer próxima etapa depende de autorização.

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
