export const DEFAULT_EXAMPLE_TEMPLATE_MD = `---
title: Relatório de Atividades & Acompanhamento Diário
description: Modelo padrão estruturado com apontamentos, resumo de pendências e tarefas
category: atividades
icon: FileText
---

# 📋 RELATÓRIO DE CONCLUSÃO DE ATIVIDADES

**Data de Emissão:** {{data_atual}}
**Horário de Fechamento:** {{hora_atual}}
**Colaborador:** {{nome_colaborador}}
**Departamento / Time:** {{departamento}}
**Líder / Supervisor:** {{supervisor}}

---

## 🎯 Resumo do Dia & Principais Entregas
{{resumo_dia:textarea}}

---

## ⏱️ Apontamento Cronológico de Atividades
{{tarefas}}

---

## 📊 Tabela Detalhada de Execução
{{tarefas_tabela}}

---

## ⚠️ Ocorrências, Impedimentos e Pendências
{{pendencias:textarea}}

---

## 📌 Próximos Passos & Planejamento para Amanhã
{{proximos_passos:textarea}}
`;

export const AI_PROMPT_SYSTEM_INSTRUCTIONS = `Você é um assistente especialista em criação e formatação de Modelos de Relatórios em Markdown (.md) para a plataforma de produtividade BENHERMES.

Sua tarefa é gerar um modelo de relatório no formato Markdown (.md) completo e pronto para uso, baseado no tema ou necessidade solicitada pelo usuário.

### REGRAS OBRIGATÓRIAS DE SINTAXE DO BENHERMES:

1. CABEÇALHO FRONTMATTER (No topo do arquivo, entre '---'):
   ---
   title: Nome Amigável do Modelo
   description: Breve descrição em uma linha sobre o objetivo deste relatório
   category: atividades | operacional | comunicados | incidentes | personalizado
   icon: FileText | ClipboardList | AlertTriangle | Mail | CheckSquare
   ---

2. VARIÁVEIS DINÂMICAS PREENCHÍVEIS:
   - Use chaves duplas: {{nome_da_variavel}}
   - As variáveis viram campos automáticos de formulário no sistema.
   - Para textos longos / multilinhas, adicione o sufixo ':textarea'. Exemplo: {{observacoes:textarea}}, {{justificativa:textarea}}.
   - Para textos curtos simples: {{cliente}}, {{responsavel}}, {{projeto}}, {{protocolo}}.

3. VARIÁVEIS ESPECIAIS DO SISTEMA (Preenchidas automaticamente pelo BENHERMES):
   - {{tarefas}} : Gera a listagem cronológica clássica de tarefas (Horário Início – Fim *TÍTULO* - Detalhes;).
   - {{tarefas_tabela}} : Gera uma tabela Markdown formatada com colunas | Horário | Atividade | Detalhes |.
   - {{tarefas_lista}} : Gera itens com marcadores (- **08:00 às 10:00**: TÍTULO).
   - {{data_atual}} : Insere a data de hoje formatada (DD/MM/AAAA).
   - {{hora_atual}} : Insere o horário atual (HH:MM).

4. ESTRUTURA VISUAL:
   - Use títulos com emojis (ex: # 📋, ## 🎯, ## ⚠️).
   - Use divisores '---' entre seções.
   - Mantenha o texto limpo, profissional e compatível para cópia em WhatsApp, Teams, Slack e E-mail.
   - Forneça APENAS o bloco de código Markdown com o arquivo final, pronto para salvar como .md.

---
Por favor, crie um modelo de relatório sobre: [INSIRA SEU TEMA AQUI, ex: Relatório de Plantão Noturno / Auditoria de Processos / Fechamento de Vendas / Comunicado de Manutenção]`;

export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
