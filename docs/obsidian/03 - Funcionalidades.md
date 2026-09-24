# Funcionalidades

## Estado atual

Hoje é um Dashboard responsivo com saudação, data, resumos acadêmicos reais, próximos compromissos, agenda visual de sete dias, panorama da Faculdade e apresentação honesta dos módulos futuros. Faculdade possui uma central visual responsiva com curso e período atuais, matérias, provas dos próximos 30 dias, aulas da semana, conclusão de matérias por status e resumo do histórico. O detalhe da matéria apresenta cabeçalho contextual, navegação interna, conclusão das aulas por status cadastrado, próxima aula, próxima prova planejada, dias restantes, tópicos, cronologia completa, outras provas e ações expansíveis para editar a matéria e cadastrar ou editar aulas e provas. O gerenciamento de curso, períodos, matérias, aulas e provas continua disponível, incluindo criação, edição e mudanças de status.

A fundação backend de Materiais está implementada e validada: metadata privada, upload assinado de PDF, leitura pelo proprietário somente no estado funcional `ready`, isolamento A/B e exclusão em etapas. A interface ainda apresenta Materiais como recurso futuro porque nenhuma tela, Route Handler permanente, análise de PDF ou integração de IA foi implementada na Etapa 2D.1.

## Regras aprovadas

Áreas previstas: Hoje, Missões, Agenda, Academia, Faculdade, Projetos, Relatórios, Conquistas e Configurações. Hoje e Faculdade são os únicos destinos navegáveis; as demais áreas aparecem no shell como planejadas e identificadas com `Em breve`, sem links quebrados.

## Pendências

Frontend de Materiais, processamento de PDF, Gemini/IA, Missões, Agenda, Academia, Projetos, Progresso e Configurações permanecem planejados. Priorizar funcionalidades por etapa aprovada.

## Ideias futuras

Integração gradual entre planejamento, execução e análise.
