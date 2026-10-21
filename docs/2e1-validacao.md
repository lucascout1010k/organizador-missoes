# 2E.1 — Memória acadêmica da matéria

Data: 2026-10-21. Base: main em 49627cf7ff2676a2f98f58eee259fe930b59d53c.

## Arquitetura

PDF individual = fonte. Analysis completed = conhecimento persistido validado. Subject memory = visão acumulada determinística. 2E.2 = recuperação semântica futura.

`getSubjectAcademicMemory` é uma DAL server-only com DTO explícito. Autentica, valida UUID, verifica a matéria própria e consulta materiais não excluídos, análises schema 1, vínculos e missões em lote. Reaproveita a leitura de aulas/provas/contexto existente. São até sete consultas de dados na visão preenchida (três acadêmicas + materiais + análises + vínculos + missões), sem consulta por item. Coleções vazias dispensam consultas dependentes. Não existe cache compartilhado nem resultado acadêmico dependente de estado React.

Somente completed com resultado aprovado pelo schema Zod alimenta a memória. Ordenação da última análise usa completed_at, created_at como fallback e ID como desempate; contagem de analisados é por material distinto. Tópicos e keywords preservam a forma mais recente, normalizam NFC/trim/espaços e deduplicam sem diferenciar caixa. Plurais não são fundidos automaticamente. Análises de materiais não ready/excluídos ou órfãos ficam fora da consolidação. Resultado inválido gera aviso e não cria conhecimento falso.

O DTO inclui matéria, stats, tópicos, keywords, limitações, último material resumido, histórico dos materiais, pendências, provas, aulas e próxima aula. Nunca inclui storage_path, hashes, leases, capabilities, dados do validator, chave Gemini ou resposta bruta. Não encaminha result completo à listagem cliente. O resumo tem no máximo 420 caracteres; último conteúdo mostra até cinco tópicos; visão inicial mostra 12 tópicos e 16 keywords, com expansão dos demais tópicos. Métricas não representam percentual da disciplina concluída.

## Interface e continuidade

Lista compacta mostra metadados públicos ao proprietário, estado do arquivo e estado da análise. Analisar/Ver análise levam à rota `/faculdade/materias/[id]/materiais/[materialId]`; navegar não envia PDF ao provider. Essa rota valida ambos os IDs, owner, matéria e ausência de exclusão, e reutiliza os componentes de análise individual/2D.4: resumo, tópicos, keywords, exercícios com resposta, sugestões revisáveis, confirmação humana, limitações e missões já criadas. Uma falha de leitura da análise no detalhe gera erro recuperável, sem simular ausência de análise.

Upload preserva prepare → Browser/Storage → finalize; File não passa pelo Next.js. Botão + Enviar PDF controla expansão; ready recolhe e devolve foco, com feedback acessível. Reabrir após sucesso reinicia explicitamente o formulário. Resultados incertos mantêm a trava anterior. Aula relacionada continua opcional no upload, somente entre aulas próprias da mesma matéria; links reais também aparecem na cronologia de aulas. Não foram criadas aulas por nomes de PDFs nem alterados vínculos existentes. Próxima aula usa somente class_sessions planned futura.

Pendências usam academic_analysis_mission_links da 2D.4 ou origem explícita de matéria/aula/prova. Não há inferência por título; mission_id nulo não conta como missão existente. Missões completed são contadas separadamente; até cinco pendências são mostradas. O foco diário e a agenda anteriores permanecem intactos.

## Testes e evidências

- Suíte completa: 579/579 testes locais, sendo 32 novos de memória/detalhe. Casos: vazio, sem análise, uma/várias análises, deduplicação, datas, contadores, processing/failed/deleted, resultado inválido, missão por vínculo/origem, concluídas, outra matéria/owner, vínculo de aula opcional/compatível, próxima aula, payloads inválidos, falhas de banco e DTO mínimo.
- Testes de serviço exercitam consultas e filtros reais do código com cliente simulado. Volume de 30 materiais mantém sete consultas. Renderização de 18 materiais mantém análises completas fora da visão geral.
- Banco real: 18 assertions SQL com duas identidades fictícias, roles authenticated/anon e claims locais. A vê somente seus subjects/materials/analyses/links/missions/classes; B não lê A; anon é negado nas cinco tabelas centrais; hash de conclusão não é selecionável por authenticated. Fixtures existem somente em transação com ROLLBACK; zero usuários fictícios remanescentes. Isto testa RLS/grants sob roles reais, não equivale a uma nova rodada de login HTTP A/B.
- Browser autenticado pelo usuário: seis materiais reais, um analisado e cinco aguardando análise; tópicos persistidos; detalhe completed íntegro. Uso apenas de leitura: sem exclusão, alteração, reanálise ou criação de missão real. Navegação de volta/reload reutiliza dados persistidos. Nenhuma chamada de análise acionada.
- Desktop e mobile: screenshots inspecionados; viewport desktop 1440 e mobile 390 (375 px úteis), sem overflow horizontal. Fixture exclusivamente em memória com 18 materiais, summary longo, 12 tópicos/20 keywords e aula futura: 18 linhas, zero seções de análise completa na visão geral, 16 keywords, resumo curto, aula opcional e upload expansível/recolhível conferidos. Rota temporária removida antes do build/publicação; nenhum arquivo PDF/objeto Storage de fixture criado.

## Gates e limites

- node --test tests/*.test.mjs: 579 aprovados.
- npm run lint, npx tsc --noEmit, npm run build e git diff --check: resultados finais conferidos na rodada.
- npm audit --omit=dev: zero vulnerabilidades.
- npm audit: cinco HIGH DEV preexistentes em braces/micromatch/fast-glob/@next/eslint-plugin-next/eslint-config-next. Única correção sugerida pelo npm faz downgrade incompatível para eslint-config-next 14.2.35; não aplicada. Exceção explicitamente prevista no pedido da 2E.1.
- Primeira tentativa de build encontrou EPERM ao criar diretórios de tipos; repetição autorizada fora do sandbox de arquivos. Nenhuma configuração/gate foi enfraquecida.
- Nenhuma migration, dependência, service_role ou nova credencial introduzida. Nenhuma chamada Gemini real foi necessária. Testes anteriores de provider/upload/conversão permanecem na suíte; não se afirma nova validação de custo/retentativas do provider nesta etapa.
- Nenhum embedding, pgvector, RAG, chat, análise em lote, recorrência ou cache de memória implementado. A deduplicação conservadora pode manter singular/plural separados. A memória mostra conteúdos analisados, sem provar domínio acadêmico.

## Documentação e publicação

Consultadas: notas 00, 05, 06, 08, 09, 10, 13, 18, 19 e 20. Atualizadas: 00, 06, 08, 09, 10, 13, 18, 19 e 20. Código e testes alterados estão no diff da etapa; AGENTS.md mantém o cabeçalho regenerado automaticamente pelo Next.js.

Publicação somente após gates finais, por seleção explícita de arquivos. .env.local, .obsidian/, PDFs reais, fixture visual, logs e capturas não são versionados. Conferir HEAD local/remoto, divergência 0/0 e árvore rastreada limpa no fechamento.
