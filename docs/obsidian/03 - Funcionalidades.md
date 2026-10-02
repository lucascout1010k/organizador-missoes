# Funcionalidades

## Estado atual

Hoje é um Dashboard responsivo com saudação, data, resumos acadêmicos reais, próximos compromissos, agenda visual de sete dias, panorama da Faculdade e apresentação honesta dos módulos futuros. Faculdade possui uma central visual responsiva com curso e período atuais, matérias, provas dos próximos 30 dias, aulas da semana, conclusão de matérias por status e resumo do histórico. O detalhe da matéria apresenta cabeçalho contextual, navegação interna, conclusão das aulas por status cadastrado, próxima aula, próxima prova planejada, dias restantes, tópicos, cronologia completa, outras provas e ações expansíveis para editar a matéria e cadastrar ou editar aulas e provas. O gerenciamento de curso, períodos, matérias, aulas e provas continua disponível, incluindo criação, edição e mudanças de status.

A fundação backend de Materiais está implementada e validada. A 2D.2B acrescentou o formulário mínimo no detalhe da matéria, com título, aula opcional e seleção de um PDF de até 6 MiB. `prepareMaterialUpload` recebe somente metadata, valida ownership e gera o identificador/caminho no servidor. O navegador autenticado envia o File diretamente ao bucket privado `academic-materials`, com `upsert: false`, sem signed upload token e sem bytes de PDF atravessando Next.js/Vercel.

Sucesso informa "Arquivo enviado. Validação pendente." e mantém `pending_upload` sem abertura/download. `reportMaterialUploadFailure` pode registrar `upload_failed` somente sobre material próprio ainda pendente; resultados incertos não alteram automaticamente o estado nem provocam retry. A etapa foi validada em 82/82 checks consolidados, incluindo isolamento A/B, negação anônima e cleanup integral, além de 245/245 testes locais previamente aprovados.

Finalize, página visual final, abertura/download, exclusão funcional, análise de PDF e IA não estão implementados. `ready` ainda não representa fluxo funcional concluído. A referência local `4. Materiais-PDF-IA` está reservada para etapa visual posterior.

## Regras aprovadas

Áreas previstas: Hoje, Missões, Agenda, Academia, Faculdade, Projetos, Relatórios, Conquistas e Configurações. Hoje e Faculdade são os únicos destinos navegáveis; as demais áreas aparecem no shell como planejadas e identificadas com `Em breve`, sem links quebrados.

## Pendências

Interface final de Materiais, finalize, abertura/download, exclusão funcional, processamento de PDF, Gemini/IA, Missões, Agenda, Academia, Projetos, Progresso e Configurações permanecem planejados. O upload mínimo já está implementado; a 2D.2C não foi iniciada. Priorizar funcionalidades por etapa aprovada.

## Ideias futuras

Integração gradual entre planejamento, execução e análise.
