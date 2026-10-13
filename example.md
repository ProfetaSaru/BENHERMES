---
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

---

<!--
================================================================================
GUIA DE USO & VARIÁVEIS SUPORTADAS PELO BENHERMES
================================================================================

1. VARIÁVEIS LIVRES (Geram campos no formulário do site):
   - {{nome_do_campo}}           -> Campo de texto simples (uma linha)
   - {{nome_do_campo:textarea}}  -> Campo de texto longo / multilinha

2. VARIÁVEIS ESPECIAIS (Preenchidas automaticamente pelo sistema):
   - {{tarefas}}         -> Lista clássica de tarefas com horários e títulos
   - {{tarefas_tabela}}  -> Tabela Markdown formatada (| Horário | Atividade | Detalhes |)
   - {{tarefas_lista}}   -> Lista com marcadores (- **08:00 às 10:00**: Título)
   - {{data_atual}}      -> Data de hoje no formato DD/MM/AAAA
   - {{hora_atual}}      -> Horário atual no formato HH:MM

3. COMO IMPORTAR ESTE MODELO NO BENHERMES:
   - Abra o site na aba "Modelos"
   - Clique em "Importar .md" e selecione este arquivo
   - O sistema detectará automaticamente todos os campos e gerará o formulário!

================================================================================
PROMPT PARA INTELIGÊNCIA ARTIFICIAL (ChatGPT, Claude, Gemini):
================================================================================

Copie e cole o texto abaixo na sua IA favorita para gerar novos modelos:

"Você é um assistente especialista em criação de Modelos de Relatórios em Markdown
para a plataforma BENHERMES.

Crie um modelo completo de relatório em Markdown sobre o tema [INSIRA SEU TEMA AQUI].

REGRAS:
1. Inicie com Frontmatter YAML entre '---' contendo:
   title: [Nome do Relatório]
   description: [Breve descrição em uma linha]
   category: atividades | operacional | comunicados | incidentes | personalizado
2. Para campos manuais preenchíveis, use {{nome_campo}} ou {{nome_campo:textarea}}.
3. Se o relatório envolver tarefas diárias, utilize {{tarefas}} ou {{tarefas_tabela}}.
4. Para datas e horários automáticos, use {{data_atual}} e {{hora_atual}}.
5. Use formatação limpa e profissional com emojis nos títulos e seções separadas por '---'."
================================================================================
-->
