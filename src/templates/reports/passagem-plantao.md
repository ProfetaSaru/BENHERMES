---
title: Passagem de Plantão & Troca de Turno
description: Alinhamento de turno com tarefas concluídas, pendências operacionais e contatos de plantão
category: operacional
icon: Clock
expandable: true
---

# 🔄 PASSAGEM DE PLANTÃO / TURNO

**Data do Turno:** {{data_atual}} às {{hora_atual}}
**Turno Saindo:** {{turno_saindo}} (Responsável: {{responsavel_saindo}})
**Turno Entrando:** {{turno_entrando}} (Responsável: {{responsavel_entrando}})

---

## ✅ Atividades Realizadas no Turno
{{tarefas_lista}}

---

## ⚠️ Pendências Críticas & Ações em Aberto
{{pendencias_criticas:textarea}}

---

## 🔔 Alertas & Procedimentos para o Próximo Turno
{{alertas_proximo_turno:textarea}}
