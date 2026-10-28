# WhatsApp das Baias v3 — registro de manutenção, histórico e estatísticas

**Data:** 28/10/2026
**Status:** aguardando revisão
**Base:** v1 (`2026-10-27-whatsapp-baias-design.md`) e v2 (`2026-10-27-whatsapp-celulares-planilha-design.md`), já no
`main`. Este documento descreve só o que muda.

## 1. Objetivo

1. **Modo manutenção:** guiar a rotina diária (manhã e almoço da operação), celular por celular, com os botões das
   ações que de fato acontecem: conferir, marcar banido/restringido, pedir análise, liberado/perdido, trocar o chip.
2. **Texto do grupo:** ao concluir, um único texto "REGISTRO DE MANUTENÇÃO — WHATSAPP" com todos os celulares da
   janela, pronto para copiar e mandar antes dos vídeos.
3. **Histórico automático** de toda mudança de situação e de operador, venha de onde vier.
4. **Estatísticas** para ver quais números caem mais, quanto tempo ficam OK, por operador, celular e equipe — numa
   tela do BenHermes e em duas abas novas da planilha.

O visual segue o resto da ferramenta (claro/escuro, cores das situações), "bonito e fácil de ler para todo mundo".
Tudo continua local no navegador; só o usuário registra.

**Fora do escopo:** pendências da v1/v2 (avisos invisíveis nas outras ferramentas e minors) — PR próprio depois
deste; gestão de chips; avisar supervisores.

## 2. Modelo de dados

```ts
type Janela = 'MANHA' | 'ALMOCO' | 'FORA';

/** Um "número" é uma vaga de celular; baia sem vaga ligada também é um número (o da própria baia) */
// chave: 'v:<celularId>:<vagaId>' ou 'l:<mesaId>:<posicao>'

type TipoEvento = 'SITUACAO' | 'OPERADOR' | 'ENTROU' | 'SAIU';

interface EventoWhatsapp {
  em: string;            // ISO
  chave: string;         // número
  tipo: TipoEvento;
  de: string;            // situação ou nome do operador antes ('' em ENTROU)
  para: string;          // depois ('' em SAIU)
  // retrato no momento (para exibir mesmo depois de apagado/mudado):
  codigo: string;        // 'OP1-E2' ou '' (backup)
  operador: string;      // '' quando backup ou vaga vazia
  equipe: string;        // sigla ou ''
  celular: string;       // 'Azul' / 'Preto · Ariel' ou ''
  vaga: string;          // 'Usuário 2 · Messenger 1' ou ''
  manutencaoId?: string; // aconteceu dentro de uma manutenção
}

type Acao = 'BANIDO' | 'RESTRINGIDO' | 'PEDIU_ANALISE' | 'LIBERADO' | 'PERDIDO' | 'TROCOU_CHIP' | 'VOLTOU';

interface AcaoFeita {
  em: string; acao: Acao; chave: string;
  codigo: string; operador: string; celular: string; vaga: string;
  numeroNovo?: string;   // só TROCOU_CHIP, opcional
}

interface Manutencao {
  id: string;
  inicio: string;        // ISO
  fim: string | null;    // null enquanto aberta
  janela: Janela;
  conferidos: string[];  // ids dos celulares conferidos ('sem-celular' para o grupo de baias sem celular)
  acoes: AcaoFeita[];
  observacao: string;
  texto: string;         // texto gerado ao concluir ('' enquanto aberta)
}

interface MapaWhatsapp {
  versao: 3;
  salas: Sala[];
  celulares: Celular[];
  historico: EventoWhatsapp[];      // mais antigo primeiro
  manutencoes: Manutencao[];        // concluídas, mais antiga primeiro
  manutencaoAtual: Manutencao | null;
  inicioDoHistorico: string;        // ISO: desde quando se conta
  atualizadoEm: string;
}
```

**Migração v2 → v3:** `historico: []`, `manutencoes: []`, `manutencaoAtual: null`, `inicioDoHistorico: agora`. A v1
continua passando pela migração v1 → v2 antes. Vale para localStorage, `.json` e aba `dados`.

## 3. Histórico automático

- `registrarMudancas(antes, depois, agora)` compara os números dos dois mapas e acrescenta eventos:
  - número que existe nos dois com situação diferente → `SITUACAO` (de/para = situação);
  - operador diferente (troca de nome na baia, ou a vaga mudou de baia/virou backup) → `OPERADOR`;
  - número só no depois → `ENTROU`; só no antes → `SAIU` (não contam como queda).
  - O retrato (código, operador, equipe, celular, vaga) é o do **depois** (do antes em `SAIU`).
  - Se `depois.manutencaoAtual` existe, o evento leva `manutencaoId`.
- Roda no hook em **toda** alteração do mapa (painel, manutenção, configurar mesas/celulares). **Não** roda ao
  importar (`.json` ou planilha): o mapa importado traz o próprio histórico.
- Trocar um celular de baia não gera `SITUACAO` (a situação acompanha o número — regra da v2), só `OPERADOR`.
- Supervisor sem WhatsApp (`NAO_TEM` em `whatsappSupervisor`) não é número.
- **Poda:** a cada gravação, eventos e manutenções com mais de 12 meses saem; `inicioDoHistorico` passa a ser o
  limite da poda quando ela corta algo.

## 4. Modo manutenção

- **Iniciar:** botão **🔧 Iniciar manutenção** no topo do WhatsApp das Baias. Janela pela hora de início:
  **MANHA** de 8:00 a 11:59, **ALMOCO** de 12:00 a 14:59, **FORA** no resto (faixas largas para atrasos; a pessoa
  pode trocar). Com uma aberta, o botão vira **Continuar manutenção** (fica salva no mapa).
- **Faixa no topo:** janela, início, barra "3 de 8 celulares", **Concluir**, **Cancelar**.
- **Celulares, um de cada vez** (cor da capinha; ordem: equipes do mapa, depois guardados), e por último o grupo
  **"Sem celular"** com as baias que não têm vaga ligada (só aparece se houver).
- Cada WhatsApp é uma linha (baia/rótulo, operador, situação) com só os botões que fazem sentido:

  | Situação | Botões | Resultado |
  |---|---|---|
  | OK | ⛔ Caiu (banido) · ⏳ Restringido | BANIDO · pede o tempo, RESTRINGIDO |
  | BANIDO | 📨 Pedi análise | ANALISE |
  | ANALISE | 🟢 Liberado · ✖️ Perdido | OK · PERMANENTE |
  | PERMANENTE | 🔁 Troquei o chip (número novo opcional) | OK; vaga recebe o número |
  | RESTRINGIDO vencido | 🟢 Voltou | OK |
  | RESTRINGIDO no prazo, NAO_TEM | — (só exibe) | — |

  Cada botão muda a situação pelas mesmas funções do painel e acrescenta uma `AcaoFeita`.
- **✅ Celular conferido** no pé do cartão marca o celular e abre o próximo; dá para voltar a qualquer um.
- **Concluir:** campo de observação opcional, gera o texto (§5), grava `fim` e `texto`, move para `manutencoes`.
  Mostra o texto com **📋 Copiar** (se a cópia falhar, o texto fica selecionado). Concluir sem conferir todos pede
  confirmação.
- **Cancelar** (com confirmação): descarta o registro; as mudanças de situação feitas continuam (são reais).

## 5. Texto do grupo

```
🔧 *REGISTRO DE MANUTENÇÃO — WHATSAPP*
📅 28/10/2026 · Manhã (09:12–09:48)
✅ 8 celulares conferidos · 96 WhatsApps OK

*O que foi feito*
⛔ Caiu: OP3-D2 (Carla Cruz) · Preto · Ariel
📨 Pedi análise: OP1-E2 (Carla Cruz) · Azul
🟢 Liberado: OP2-D1 (Nina Nunes) · Vermelho
✖️ Perdido: …
🔁 Chip trocado: Azul · Usuário 2 · Messenger 1
⏳ Restringido: … até 29/10 14:00

*Como ficou*
⛔ 1 banido · 🔎 2 em análise · ✖️ 0 perdido · ⏳ 1 restringido

📱 Azul (OP1) ✅ · Vermelho (OP2) ✅ · Preto · Ariel (OP3) ✅
📝 Obs: …
🎥 Vídeos a seguir
```

- Janela: "Manhã", "Almoço" ou "Fora do horário". Horário = início–fim.
- Ações na ordem em que foram feitas; uma linha por ação. Onde: `código (operador)` para vaga ligada/baia, ou o nome
  da vaga para backup; depois `· celular` quando houver.
- Sem ações: `*O que foi feito*` traz "Tudo conferido, nenhuma ação necessária."
- "Como ficou": só os itens com número > 0; se todos forem 0, "Tudo OK".
- Linha 📱: os celulares conferidos (✅) e, ao fim, os não conferidos com ⬜.
- Sem observação, a linha 📝 some.

## 6. Estatísticas

**Definições**
- **Linha do tempo de um número:** a situação atual e os eventos, reconstruídos de trás para frente (cada evento tem
  de/para); começa em `inicioDoHistorico` ou no `ENTROU`, termina em `SAIU` ou agora.
- **Queda:** evento `SITUACAO` de `OK` para `BANIDO`, `RESTRINGIDO` ou `PERMANENTE`.
- **Tempo OK:** tempo em OK ÷ tempo em qualquer situação menos `NAO_TEM`, no período.
- **Tempo até voltar:** de cada queda do período até o próximo `OK` daquele número (só as que voltaram).
- **Sequência atual em OK:** desde a última entrada em OK (ou desde o início do histórico, mostrado como "≥").
- **Operador:** cada trecho da linha do tempo pertence ao operador daquele momento (eventos `OPERADOR` dividem os
  trechos); backup não tem operador.
- **Manutenções feitas:** janelas MANHA e ALMOCO de cada dia útil do período (calendário do Hub, com feriados) já
  terminadas; feita = existe manutenção concluída com aquela janela naquele dia.

**Tela** (aba **📊 Estatísticas** ao lado de **🗺️ Mapa** no topo da ferramenta; período 7 / 30 / 90 dias / 12 meses):
1. Números grandes: % tempo OK, quedas, tempo médio até voltar, perdidos (entradas em PERMANENTE), manutenções
   "18 de 20".
2. Quedas por dia (colunas).
3. Os que mais caíram (ranking com barra, código · operador · celular).
4. Os mais estáveis (dias seguidos OK).
5. Por operador (quedas, % OK, sequência atual; ordenável).
6. Por celular (cor da capinha) e por equipe (barras de % OK e quedas).
7. Calendário das manutenções (duas bolinhas por dia útil).
8. Histórico (últimas mudanças, filtro por equipe e situação; clicar abre a baia no mapa).
9. Manutenções anteriores (clicar mostra o texto com 📋 Copiar).
- Gráficos em HTML/CSS/SVG, sem biblioteca nova, com rótulos legíveis e cores das situações.
- Histórico com menos de 14 dias: aviso "Contando desde dd/mm. Os números ficam mais confiáveis com o tempo."
- Sem eventos no período: estados vazios com texto, nunca gráfico quebrado.

## 7. Planilha

Depois de **Lista**, duas abas novas (mesmo estilo minimalista, sem linhas de grade):
- **Estatísticas** — últimos 30 dias: os números grandes, os que mais caíram, os mais estáveis, por operador, por
  equipe e o calendário das manutenções.
- **Histórico** — tabela do Excel com filtro: data/hora, tipo, código, operador, equipe, celular, vaga, de, para,
  manutenção (janela + data ou vazio), dos últimos 30 dias; abaixo, as manutenções do período (data, janela,
  início–fim, celulares conferidos, ações).
- A aba oculta `dados` leva o mapa v3 inteiro (histórico e manutenções incluídos); importar devolve igual.

## 8. Erros

- Gravar no localStorage falhou (cheio): aviso "Armazenamento cheio: exporte o mapa e baixe a planilha" (o mapa em
  memória continua); a poda de 12 meses evita chegar lá no uso normal.
- Relógio voltou (evento com data menor que o último): o evento é gravado com a data do último + 0 ms, para a linha
  do tempo continuar em ordem.
- Importar substitui histórico e manutenções pelos do arquivo (arquivo v1/v2: começam vazios).

## 9. Organização e testes

| Arquivo | Responsabilidade |
|---|---|
| `src/types/whatsapp.ts` | tipos v3 |
| `src/utils/whatsappHistorico.ts` | chaves e retrato dos números, `registrarMudancas`, poda |
| `src/utils/whatsappManutencao.ts` | janela pela hora, iniciar/ação/conferir/concluir/cancelar, texto do grupo |
| `src/utils/whatsappEstatisticas.ts` | linhas do tempo, quedas, tempo OK, até voltar, rankings, operador, celular, equipe, calendário |
| `src/utils/whatsappBaias.ts` | migração v2 → v3 |
| `src/utils/whatsappResumo.ts` | abas Estatísticas e Histórico |
| `src/hooks/useWhatsappBaias.ts` | registrar mudanças e podar em toda alteração; importar sem registrar; aviso de armazenamento |
| `src/components/whatsapp/Manutencao.tsx` | modo manutenção |
| `src/components/whatsapp/Estatisticas.tsx` | tela de estatísticas |

Testes (TDD, dados fictícios): cada caminho que gera evento (painel, ação de manutenção, renomear operador, ligar
baia, mudar equipe, remover celular) e o que não gera (trocar celular de baia → sem `SITUACAO`; importar); poda de
12 meses; janela em 7:59, 8:00, 11:59, 12:00, 14:59, 15:00; cada botão da tabela do §4; texto do grupo com e sem
ações, sem observação e com celular não conferido; estatísticas com linhas do tempo montadas à mão (queda, tempo OK,
até voltar, troca de operador no meio, número que entrou e saiu, período cortando um trecho); calendário com feriado;
abas novas e ida e volta da planilha com histórico; migração v2 → v3. No fim, navegador (claro/escuro, computador e
celular) e prints.
