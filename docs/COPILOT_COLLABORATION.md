# Copiloto ConnectWeb — divisão de trabalho

Este arquivo coordena o trabalho paralelo entre Claude e Codex. A visão de
produto continua sendo uma só: um Copiloto contextual que ensina o lojista e
executa tarefas com segurança.

## Fronteiras atuais

### Claude — experiência e ativação

- onboarding guiado e checklist de implantação;
- botão/painel global de Ajuda + IA;
- contexto visual da rota atual;
- linguagem simples, estados vazios e atalhos de navegação;
- integração dos componentes no `AppLayout`.

### Codex — plataforma do Copiloto

- contratos tipados das ferramentas;
- registro e descoberta por módulo;
- autorização por permissões da sessão;
- classificação de risco e confirmação obrigatória;
- base para auditoria e execução server-side;
- testes unitários da plataforma.

## Arquivos reservados nesta etapa

- Claude: componentes visuais de onboarding/assistente e composição no layout.
- Codex: `src/core/copilot/**` e a documentação técnica correspondente.

Antes de editar um arquivo fora da própria fronteira, verificar `git status` e
o diff atual. Não alterar `src/styles.css`, não editar `routeTree.gen.ts` e não
reescrever histórico publicado.

## Contrato de integração

A interface poderá listar as ferramentas disponíveis para o usuário e enviar
uma solicitação de execução. O Core decide se a ferramenta está habilitada,
se o usuário possui permissão e se a ação exige confirmação. A organização e o
ator sempre vêm da sessão do servidor, nunca do texto ou payload do cliente.

