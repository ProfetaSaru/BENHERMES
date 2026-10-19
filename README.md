# 📋 Gerador de Relatório de Atividades

Aplicação web moderna para registro e organização cronológica de atividades diárias, com geração e cópia instantânea de relatórios formatados para a área de transferência.

Construída com **React 18**, **TypeScript**, **Vite** e estilização modular, estruturada rigorosamente sob o conceito **Nevernester** (zero duplicação de marcação visual, guard clauses e hooks desacoplados).

---

## ✨ Funcionalidades

- **⏱️ Registro de Tarefas**: Cadastro com horário inicial, horário final, título da atividade e descrição detalhada opcional.
- **🔠 Títulos Padronizados em Maiúsculo**: Conversão automática em tempo real para letras maiúsculas (UPPERCASE) durante a digitação e no relatório final.
- **📅 Ordenação Cronológica Automática**: As atividades são organizadas automaticamente pelo horário de início.
- **🛡️ Validação de Horários**: Bloqueio de horários inconsistentes (hora final anterior à hora inicial) com feedback visual imediato.
- **✏️ Edição & Exclusão**: Modificação ágil de tarefas cadastradas e exclusão individual com confirmação.
- **🗑️ Limpeza em Lote**: Modal acessível para remoção de todos os registros salvos com suporte à tecla `ESC`.
- **📋 Geração de Relatório com 1 Clique**: Preview do relatório formatado e botão de cópia direta para a área de transferência (`navigator.clipboard`).
- **💾 Persistência Local**: Sincronização automática e segura no `localStorage` do navegador sob a chave `'relatorio-atividades'`.
- **📱 Design Responsivo & Acessível**: Layout em duas colunas para desktop e empilhado em dispositivos móveis, com micro-animações e ícones [`lucide-react`](https://lucide.dev/).
- **💾 Histórico Universal com Restauração Fiel**: Qualquer relatório salvo no histórico (seja de atividades ou baseado em modelo) é restaurado completamente com todos os campos e modelo ativo pronto para edição.
- **⚡ Rascunhos Temporários em Tempo Real**: Cada modelo mantém automaticamente seus dados preenchidos no navegador, lembrando o último modelo utilizado mesmo após recarregar a página (F5).

---

## 📑 Como Criar Novos Relatórios (Expansíveis e Não Expansíveis)

A aplicação utiliza um motor dinâmico baseado em arquivos **Markdown (.md)** com metadados **YAML Frontmatter** no topo. Existem dois tipos de relatórios:

| Tipo | `expandable` | Comportamento | Casos de Uso Típicos |
| :--- | :---: | :--- | :--- |
| **Expansível** | `true` | Integra o painel de cadastro de tarefas diárias com horários e suporte a variáveis extras de cabeçalho. | Relatório Diário Clássico, Grade de Produtividade em Tabela. |
| **Não Expansível** | `false` | Funciona como formulário dinâmico puro. Transforma variáveis do markdown em inputs e textareas automáticos. | Pós-Mortem / Incidentes, Onboarding de Novo Colaborador, Passagem de Plantão, Comunicados. |

---

### 1. Anatomia e Sintaxe de um Arquivo de Modelo (.md)

Todo modelo possui um bloco **Frontmatter** no topo (entre `---`) seguido pelo corpo do documento em Markdown:

```markdown
---
title: Nome Exibido no Catálogo
description: Descrição curta do objetivo do relatório
category: atividades # categorias: atividades | incidentes | rh | suporte | comunicados | geral
icon: FileText       # ícone Lucide: FileText, TableProperties, AlertTriangle, UserCheck, Radio, etc.
expandable: true     # true para expansível (com tarefas) ou false para não expansível (formulário)
---

# 📋 TÍTULO DO RELATÓRIO
**Data:** {{data_atual}}
**Responsável:** {{nome_colaborador}}

---

{{conteudo_ou_tarefas}}
```

#### 🏷️ Variáveis Dinâmicas e Tags Especiais

- **Campos de Texto Simples:** `{{nome_campo}}` cria um input de texto comum.
- **Campos Multilinha (Textarea):** Adicione o sufixo `:textarea` (ex: `{{observacoes:textarea}}`) ou utilize nomes como `descricao`, `motivo`, `detalhes`, `pendencias`, `acoes`.
- **Campos de Senha:** Use o sufixo `:password` (ex: `{{senha_temporaria:password}}`) para gerar um campo com botão de mostrar/ocultar senha.
- **Variáveis Automáticas do Sistema:** `{{data_atual}}` e `{{hora_atual}}` são preenchidas automaticamente com a data e hora do momento.
- **Tags de Tarefas e Produtividade (Exclusivo para `expandable: true`):**
  - `{{tarefas}}`: Insere as tarefas cadastradas no formato de lista clássica com horários.
  - `{{tarefas_tabela}}` ou `{{tabela_tarefas}}`: Formata as tarefas cadastradas diretamente em uma tabela Markdown organizada.
  - `{{bloco_produtividade}}`: Gera o bloco operacional completo organizado por seções (Desbloqueados, Formalização, Anuência, Tentativas de contato), separadores padronizados, contagem de itens e TMA calculado.
  - `{{tma}}` / `{{tma_medio}}`: Tempo Médio de Atendimento calculado automaticamente a partir dos horários inicial e final (ex: `22 min`).
  - `{{total_geral_finalizado}}`: Total de atendimentos concluídos com hora inicial e final.
  - `{{total_desbloqueados}}`, `{{total_formalizados}}`, `{{total_anuencia}}`: Contadores específicos por etapa.
  - `{{tentativas_contato}}`: Lista de contatos no formato `CPF HORA`.

- **Categorias e Rótulos Customizados no Frontmatter:**
  - `categories`: Lista de etapas/categorias que geram botões de seleção rápida (pills) no formulário (ex.: `[Desbloqueados, Formalização, Anuência, Tentativas de contato]`). Para tentativas de contato, a hora final torna-se opcional automaticamente.
  - `itemLabel`: Rótulo dinâmico do formulário (ex.: `CPF do Cliente`), alterando o título e os botões da interface.

---

### 2. Exemplo: Criando um Relatório EXPANSÍVEL

Um relatório expansível permite que o usuário adicione quantas atividades quiser ao longo do dia, podendo também solicitar campos extras (como número da sprint, squad ou colaborador):

Crie o arquivo em `src/templates/reports/atividades-sprint.md`:

```markdown
---
title: Fechamento de Sprint Diária
description: Registro de atividades integrado com metas e identificação da sprint
category: atividades
icon: TableProperties
expandable: true
---

# 🏃‍♂️ RELATÓRIO DIÁRIO DE SPRINT

**Sprint:** {{numero_sprint}}
**Squad / Projeto:** {{nome_squad}}
**Data:** {{data_atual}} às {{hora_atual}}

---

### 🎯 Metas e Entregas do Dia
{{metas_atingidas:textarea}}

---

### 📋 Atividades Realizadas
{{tarefas_tabela}}

---

### 🚧 Bloqueios e Impedimentos
{{impedimentos:textarea}}
```

---

### 2.1 Exemplo: Relatório de Produtividade com Categorias por CPF e TMA

Para relatórios operacionais divididos em etapas (ex.: Desbloqueados, Formalização, Anuência e Tentativas de contato) com cálculo de Tempo Médio de Atendimento:

Crie o arquivo em `src/templates/reports/produtividade-atendimento.md`:

```markdown
---
title: Relatório de Produtividade & TMA
description: Apontamento operacional por CPF com cálculo automático de totais por etapa e TMA
category: operacional
icon: Activity
expandable: true
categories:
  - Desbloqueados
  - Formalização
  - Anuência
  - Tentativas de contato
itemLabel: CPF do Cliente
---

RELATÓRIO DE PRODUTIVIDADE - {{nome_colaborador}}
========================================
{{bloco_produtividade}}
```

---

### 3. Exemplo: Criando um Relatório NÃO EXPANSÍVEL

Um relatório não expansível gera uma interface de formulário direto, ideal para checklists, registros pontuais, comunicados ou incidentes:

Crie o arquivo em `src/templates/reports/checklist-deploy.md`:

```markdown
---
title: Checklist de Deploy em Produção
description: Registro e validação de liberação de versão em ambiente produtivo
category: suporte
icon: Radio
expandable: false
---

# 🚀 RELATÓRIO DE DEPLOY EM PRODUÇÃO

**Versão / Tag:** {{versao_sistema}}
**Ambiente:** {{ambiente}}
**Horário de Início:** {{hora_inicio}}
**Horário de Término:** {{hora_termino}}
**Responsável pelo Deploy:** {{responsavel}}

---

## 🔍 Validações Realizadas
- [x] Backup de banco de dados executado
- [x] Migrations aplicadas sem erros
- [x] Testes de fumaça (Smoke Tests) validados

### 📝 Observações e Rollback Plan
{{observacoes_rollback:textarea}}
```

---

### 4. Como Registrar Novos Modelos no Código-Fonte

Após criar seu arquivo `.md` na pasta `src/templates/reports/`:

1. Abra o arquivo [`src/templates/reports/index.ts`](src/templates/reports/index.ts).
2. Importe o arquivo utilizando a diretiva `?raw` do Vite:
   ```ts
   import checklistDeployRaw from './checklist-deploy.md?raw';
   ```
3. Adicione o modelo ao array `BUILTIN_TEMPLATES`:
   ```ts
   export const BUILTIN_TEMPLATES: MarkdownTemplateMeta[] = [
     // Modelos existentes...
     { ...parseMarkdownTemplate(checklistDeployRaw, 'checklist-deploy').meta, isBuiltin: true },
   ];
   ```

Pronto! Ao salvar, o novo modelo aparecerá automaticamente no catálogo **"Mudar Modelo"**, já com suporte a salvamento no histórico, filtros e restauração completos.

---

### 5. Como Adicionar pela Própria Interface Web (Sem Alterar Código)

Você também pode adicionar modelos diretamente pelo navegador:

1. No Gerador, clique no botão **"Mudar Modelo"**.
2. Escolha uma das opções disponíveis:
   - **"Novo Modelo"**: Abre um editor integrado com syntax highlighting e validação em tempo real. Digite seu frontmatter e corpo markdown e clique em salvar.
   - **"Importar .md"**: Selecione qualquer arquivo `.md` do seu computador.
   - **"Gerar Prompt para IA"**: Copia um prompt estruturado para que o ChatGPT, Claude ou Gemini gere o modelo Markdown exato pronto para você colar no sistema.

---

## 🏗️ Arquitetura & Conceito Nevernester

O projeto adota o princípio **Nevernester** para manter o código limpo, legível e altamente sustentável:

1. **Componentes Atômicos Reutilizáveis (Zero Marcação Duplicada)**:
   - `Button`: Botão polimórfico com suporte a variantes (`primary`, `secondary`, `danger`, `text`, `edit`, `delete`) e ícones integrados.
   - `FormField`, `Input`, `Textarea`: Encapsulam labels, tags de campos opcionais e estilos de foco consistentes.
   - `Modal`: Diálogo modal de confirmação acessível com backdrop blur, foco e atalho `Escape`.
   - `SectionHeading` & `Panel`: Containers e cabeçalhos reutilizáveis para os blocos da aplicação.
   - `Badge` & `NotificationToast`: Indicadores visuais e alertas temporários com auto-dismiss.

2. **Lógica Desacoplada em Custom Hooks (Guard Clauses & Early Returns)**:
   - [`useTasks`](src/hooks/useTasks.ts): Responsável por operações CRUD, ordenação e persistência local.
   - [`useTaskForm`](src/hooks/useTaskForm.ts): Gestão do estado do formulário e validações com retornos antecipados.
   - [`useNotification`](src/hooks/useNotification.ts): Sistema de toasts com gerenciamento de tempo sem vazamento de memória.

---

## 📂 Estrutura de Pastas

```
Gerador-de-Relatorio/
├── legacy_backup/             # Arquivos originais (Vanilla HTML/JS/CSS) preservados
├── src/
│   ├── types/
│   │   └── task.ts            # Interfaces TypeScript tipadas estritamente
│   ├── hooks/
│   │   ├── useTasks.ts        # Hook para CRUD e persistência no localStorage
│   │   ├── useTaskForm.ts     # Hook para formulário e validações
│   │   └── useNotification.ts # Hook para alertas temporários
│   ├── utils/
│   │   ├── formatReport.ts    # Formatação do texto do relatório
│   │   └── storage.ts         # Leitura e escrita segura no localStorage
│   ├── styles/
│   │   ├── variables.css      # Design tokens e variáveis de tema
│   │   ├── global.css         # Reset global e layout
│   │   └── components.css     # Estilos modulares e responsivos
│   ├── components/
│   │   ├── common/            # Componentes atômicos reutilizáveis
│   │   │   ├── Button.tsx
│   │   │   ├── FormField.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Panel.tsx
│   │   │   ├── SectionHeading.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── NotificationToast.tsx
│   │   ├── layout/
│   │   │   └── Header.tsx
│   │   └── task/
│   │       ├── TaskItem.tsx
│   │       ├── TaskList.tsx
│   │       ├── TaskForm.tsx
│   │       ├── ReportPreview.tsx
│   │       └── ReportPanel.tsx
│   ├── App.tsx                # Composição principal da aplicação
│   └── main.tsx               # Ponto de entrada React
├── index.html                 # HTML raiz do Vite
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)
- Gerenciador de pacotes `npm`

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/ProfetaSaru/Gerador-de-Relatorio.git
cd Gerador-de-Relatorio
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173/`.

### Build de Produção

Para validar a tipagem TypeScript e gerar os arquivos otimizados para produção:
```bash
npm run build
```

Para visualizar localmente o build gerado:
```bash
npm run preview
```

---

## 📄 Exemplo do Relatório Gerado

```text
RELATÓRIO DE CONCLUSÃO DE ATIVIDADES
08:00 – 09:00 *ALINHAMENTO DIÁRIO:* - Daily meeting com o time;
09:00 – 12:00 *REFATORAÇÃO DE CÓDIGO:* - Migração para React e TypeScript;
13:30 – 15:00 *CODE REVIEW*;
```

---

## 🛠️ Tecnologias Utilizadas

- **[React 18](https://react.dev/)**
- **[TypeScript](https://www.typescriptlang.org/)**
- **[Vite](https://vitejs.dev/)**
- **[Lucide React](https://lucide.dev/)** (ícones)
- **Vanilla CSS Modular** (CSS custom properties, grid/flexbox)

---

## 📝 Licença

Distribuído sob licença livre para fins de estudo e uso pessoal.
