# Deploy e Infraestrutura

## Estado atual

GitHub configurado com o repositório público `lucascout1010k/organizador-missoes`. A branch principal é `main`. O projeto Supabase existe na região South America (São Paulo) e a aplicação possui configuração local com credenciais públicas. As duas migrations oficiais da Etapa 2D.1 foram aplicadas manualmente no projeto real e validadas em runtime; nenhum deploy automatizado ou mudança de Vercel foi realizado.

## Regras aprovadas

O código-fonte público fica em `https://github.com/lucascout1010k/organizador-missoes`. Segredos ficam fora do repositório e somente nos provedores apropriados.

Migrations aplicadas manualmente devem permanecer versionadas e imutáveis. Antes de futura adoção de `supabase db push`, reconciliar o histórico remoto com os arquivos locais para evitar reaplicação. `.env.local`, credenciais de teste, tokens e URLs assinadas nunca entram no Git.

## Pendências

Status: planejado / não implementado para Vercel. Definir ambientes, CI, domínio e processo de deploy em etapas autorizadas.

## Ideias futuras

Validações automáticas antes de publicação.
