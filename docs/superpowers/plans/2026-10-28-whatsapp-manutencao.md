# WhatsApp das Baias v3 — Registro de manutenção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modo manutenção guiado com texto do grupo, histórico automático de mudanças e estatísticas (tela + 2 abas da planilha) no WhatsApp das Baias.

**Architecture:** Três utils puros e testados (`whatsappHistorico`, `whatsappManutencao`, `whatsappEstatisticas`) sobre o mapa v3; o hook grava o histórico comparando antes/depois em toda alteração (menos importar); duas telas novas (`Manutencao`, `Estatisticas`) e duas abas novas na planilha.

**Tech Stack:** React 18, TypeScript, Vite 6, vitest 3, exceljs 4.4 (escrita), SheetJS (leitura), lucide-react, localStorage.

**Spec:** `docs/superpowers/specs/2026-10-28-whatsapp-manutencao-design.md` (base: specs v1 e v2 de 2026-10-27).

## Global Constraints

- Sem dependência nova (gráficos em HTML/CSS/SVG).
- Só dados fictícios no repositório (nomes ANA, BRUNO…; números `(11) 90000-0000`).
- Tudo local; nada sai do navegador.
- Textos da interface em português; mesmas cores/tokens das situações (`.wpp-ok`, `.wpp-banido`, `.wpp-analise`, `.wpp-permanente`, `.wpp-restringido`, `.wpp-nao_tem`), claro e escuro.
- Funções puras recebem `agora: Date`; nada de `new Date()` dentro de utils.
- Histórico e manutenções: 12 meses. Janelas: MANHA 8:00–11:59, ALMOCO 12:00–14:59, FORA o resto.
- Queda = `SITUACAO` de `OK` para `BANIDO` | `RESTRINGIDO` | `PERMANENTE`.

## Review Focus

1. **Manutenção aberta sobrevive a recarregar a página e a exportar/importar** — `manutencaoAtual` volta igual; teste na Task 1.
2. **Celular apagado ou renomeado durante a manutenção aberta** — o texto não quebra e usa o retrato gravado nas ações; ids de conferidos que não existem mais são ignorados na linha 📱; teste na Task 3.
3. **Textos de manutenção com emoji na aba `dados`** — o corte em pedaços de 30 000 caracteres não pode partir um emoji (agora quase certo, pois os textos têm 🔧📅✅); teste na Task 5.
4. **Relógio do computador voltou** — evento com data anterior ao último é gravado com a data do último; teste na Task 2.
5. **Período sem tempo observado** (tudo NÃO TEM, ou histórico começou depois do fim do período) — `tempoOk` é `null` e a tela/planilha mostram "—", nunca `NaN`; teste na Task 4.

---

### Task 1: Tipos v3 e migração

**Files:**
- Modify: `src/types/whatsapp.ts`, `src/utils/whatsappBaias.ts` (`mapaInicial`, `lerMapa`, `importarMapa`, `lerMapaSalvo`), `src/utils/whatsappPlanilha.ts:191` (importação antiga gera v3), `src/utils/whatsappPlanilha.ts:204-208` (passa `agora`)
- Test: `src/utils/whatsappBaias.test.ts`

**Interfaces:**
- Produces: tipos do spec §2 exportados de `src/types/whatsapp.ts` (`Janela`, `TipoEvento`, `EventoWhatsapp`, `Acao`, `AcaoFeita`, `Manutencao`, `MapaWhatsapp` com `versao: 3`, `historico`, `manutencoes`, `manutencaoAtual`, `inicioDoHistorico`).
- Produces: `importarMapa(texto: string, agora: Date): MapaWhatsapp` (o `agora` vira `inicioDoHistorico` de arquivo v1/v2); `mapaInicial(agora)` já v3 com `inicioDoHistorico = agora`.

- [ ] **Step 1: Failing tests** em `describe('versão 3')`:
  - `mapaInicial(AGORA)` → `{ versao: 3, historico: [], manutencoes: [], manutencaoAtual: null, inicioDoHistorico: AGORA.toISOString() }`.
  - `.json` v2 (o `exportarMapa` de um mapa v2 montado à mão) → `importarMapa(texto, AGORA)` dá v3 com histórico vazio e `inicioDoHistorico` = `AGORA`.
  - `.json` v1 → v3 (passa pela migração v1→v2).
  - v3 com 1 evento, 1 manutenção concluída e `manutencaoAtual` aberta → `importarMapa(exportarMapa(m, AGORA), AGORA)` `toEqual(m)` (Review Focus 1).
  - evento com `tipo: 'XYZ'` ou manutenção sem `acoes` → lança "não é um mapa do WhatsApp das Baias válido".
- [ ] **Step 2:** `npx vitest run src/utils/whatsappBaias.test.ts` → FAIL.
- [ ] **Step 3:** implementar. `lerMapa(bruto, agora)`: v1 → v2 → v3; v2 → v3 acrescenta os 4 campos; valida eventos (strings nos campos de texto, `tipo` ∈ 4 tipos, `manutencaoId` opcional string) e manutenções (`janela` ∈ 3, `fim` string|null, `conferidos` string[], `acoes` com `acao` ∈ 7). `lerMapaSalvo` passa `agora`. Atualizar chamadas (`WhatsappHub`, `lerArquivoDoMapa`) e testes que montam mapas v2 à mão.
- [ ] **Step 4:** `npx vitest run` → PASS (suite toda; `npx tsc --noEmit -p .` limpo).
- [ ] **Step 5:** `git commit -m "feat(whatsapp): mapa v3 com histórico e manutenções"`

### Task 2: Histórico automático

**Files:**
- Create: `src/utils/whatsappHistorico.ts`, `src/utils/whatsappHistorico.test.ts`

**Interfaces:**
- Consumes: tipos da Task 1; `estadoDaVaga`, `nomeDoCelular` (celulares.ts); `codigoDoLugar`, `posicoesAtivas` (mapaMesas.ts).
- Produces:
  - `interface RetratoNumero { situacao: Situacao; operador: string; codigo: string; equipe: string; celular: string; vaga: string }`
  - `numerosDoMapa(mapa: MapaWhatsapp): Map<string, RetratoNumero>` — chaves `v:<celularId>:<vagaId>` (todas as vagas) e `l:<mesaId>:<posicao>` (posições ativas sem vaga ligada; SUP só se `whatsappSupervisor !== 'NAO_TEM'`). Vaga ligada: operador/código da baia; backup: operador `''`, código `''`.
  - `registrarMudancas(antes: MapaWhatsapp, depois: MapaWhatsapp, agora: Date): MapaWhatsapp`
  - `podarHistorico(mapa: MapaWhatsapp, agora: Date): MapaWhatsapp`
  - `gravarAlteracao(antes: MapaWhatsapp, depois: MapaWhatsapp, agora: Date): MapaWhatsapp` = `podarHistorico(registrarMudancas(...))` (o que o hook usa).

- [ ] **Step 1: Failing tests** (mapa fictício: OP1 4+4 com operadores, um Motorola na OP1):
  - painel: baia sem celular OK→BANIDO → 1 evento `{ tipo: 'SITUACAO', de: 'OK', para: 'BANIDO', codigo: 'OP1-E1', operador: 'ANA', equipe: 'OP1', celular: '' }`.
  - vaga ligada banida via `alterarEstadoDaVaga` → evento com chave `v:…`, `celular: 'Azul'`, `vaga: 'Proprietário · Messenger 1'`.
  - trocar operador da baia (ANA→BIA) → 1 `OPERADOR` `de: 'ANA', para: 'BIA'`.
  - `ligarBaia` de backup para E1 banida → nenhum `SITUACAO`; 2 `OPERADOR` (a que saiu fica `''`, a que entrou recebe o operador).
  - `removerCelularNoMapa` → `SAIU` para cada vaga e `ENTROU` das baias que ficaram sem vaga (com NÃO TEM); nenhum `SITUACAO`.
  - `depois.manutencaoAtual` aberta → eventos levam `manutencaoId`.
  - nada mudou → `historico` igual (mesma referência ou `toEqual`).
  - relógio voltou: último evento em 10:00, `agora` 09:00 → novo evento com `em` = 10:00 (Review Focus 4).
  - poda: evento de 13 meses atrás sai, de 11 meses fica; `inicioDoHistorico` passa para `agora − 12 meses` só se algo foi cortado; manutenção de 13 meses sai.
- [ ] **Step 2:** `npx vitest run src/utils/whatsappHistorico.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** implementar. Ordem dos eventos gerados: pela ordem das chaves de `numerosDoMapa(depois)` e depois as que só existem no antes. Retrato de `SAIU` vem do antes.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): histórico automático das mudanças"`

### Task 3: Manutenção e texto do grupo

**Files:**
- Create: `src/utils/whatsappManutencao.ts`, `src/utils/whatsappManutencao.test.ts`

**Interfaces:**
- Consumes: Task 1 tipos; `AlvoAlerta` (whatsappAlertas.ts); `estado`, `mudarSituacao`, `pedirAnalise`, `restringir`, `restricaoVencida`, `alterarLugarNoMapa` (whatsappBaias.ts); `alterarEstadoDaVaga`, `alterarCelularNoMapa`, `estadoDaVaga`, `nomeDoCelular` (celulares.ts); `resumoGeral` (whatsappAlertas.ts); `numerosDoMapa` (Task 2).
- Produces:
  - `janelaDaHora(d: Date): Janela`; `ROTULO_JANELA: Record<Janela, string>` = Manhã / Almoço / Fora do horário.
  - `iniciarManutencao(mapa, agora): MapaWhatsapp` (id novo, `fim: null`, `texto: ''`; se já há uma aberta, devolve o mapa igual).
  - `trocarJanela(mapa, janela: Janela): MapaWhatsapp`.
  - `acoesPossiveis(e: EstadoWhatsapp, agora: Date): Acao[]` — tabela do spec §4 (OK → `['BANIDO','RESTRINGIDO']`; BANIDO → `['PEDIU_ANALISE']`; ANALISE → `['LIBERADO','PERDIDO']`; PERMANENTE → `['TROCOU_CHIP']`; RESTRINGIDO vencido → `['VOLTOU']`; resto `[]`).
  - `aplicarAcao(mapa, alvo: AlvoAlerta, acao: Acao, agora: Date, extra?: { restricao?: { quantidade: number; unidade: 'horas' | 'dias' }; numeroNovo?: string }): MapaWhatsapp` — muda a situação (RESTRINGIDO via `restringir`, lança o erro dele se o tempo for inválido) e acrescenta `AcaoFeita` com o retrato (de `numerosDoMapa`, antes da mudança) na manutenção aberta; sem manutenção aberta, só muda a situação. `TROCOU_CHIP` com `numeroNovo` em vaga grava `vaga.numero`.
  - `GRUPO_SEM_CELULAR = 'sem-celular'`; `alternarConferido(mapa, id: string): MapaWhatsapp`.
  - `etapasDaManutencao(mapa): { id: string; titulo: string; hex: string | null }[]` — celulares (ordem das mesas no mapa, depois guardados) e, se houver baia ativa sem vaga ligada, `{ id: 'sem-celular', titulo: 'Sem celular', hex: null }`.
  - `textoDaManutencao(m: Manutencao, mapa: MapaWhatsapp, agora: Date): string` — formato exato do spec §5.
  - `concluirManutencao(mapa, observacao: string, agora): { mapa: MapaWhatsapp; texto: string }`; `cancelarManutencao(mapa): MapaWhatsapp`.

- [ ] **Step 1: Failing tests:**
  - janela: 7:59 FORA, 8:00 MANHA, 11:59 MANHA, 12:00 ALMOCO, 14:59 ALMOCO, 15:00 FORA.
  - cada linha da tabela de `acoesPossiveis`, incluindo RESTRINGIDO no prazo → `[]` e vencido → `['VOLTOU']`.
  - `aplicarAcao` em sequência numa baia: BANIDO → PEDIU_ANALISE → PERDIDO → TROCOU_CHIP (numeroNovo `(11) 90000-0001` numa vaga) → situação final OK, `vaga.numero` gravado, 4 `acoes` com códigos e operadores.
  - texto exato (comparar string inteira) para: manhã 09:12–09:48, 2 celulares conferidos, ações PEDIU_ANALISE e LIBERADO, observação "Chip do Azul na gaveta" — e para: sem ações ("Tudo conferido, nenhuma ação necessária."), sem observação (sem linha 📝), "Como ficou" tudo zero → "Tudo OK", um celular não conferido com ⬜.
  - Review Focus 2: celular removido depois de uma ação → texto ainda sai, linha da ação usa o retrato gravado, id do removido não aparece na linha 📱.
  - concluir: `manutencaoAtual` null, última de `manutencoes` com `fim` e `texto` iguais ao devolvido; cancelar: `manutencaoAtual` null e `manutencoes` intacto.
- [ ] **Step 2:** `npx vitest run src/utils/whatsappManutencao.test.ts` → FAIL.
- [ ] **Step 3:** implementar. Linha de ação: `<emoji> <rótulo>: <onde> · <celular>`; onde = `código (operador)` se há código (operador vazio → `código (vaga vazia)`), senão o nome da vaga; `· celular` só se há celular; RESTRINGIDO acrescenta ` até dd/mm hh:mm`. Emojis/rótulos: BANIDO ⛔ Caiu, RESTRINGIDO ⏳ Restringido, PEDIU_ANALISE 📨 Pedi análise, LIBERADO 🟢 Liberado, PERDIDO ✖️ Perdido, TROCOU_CHIP 🔁 Chip trocado, VOLTOU 🟢 Voltou. "Como ficou" = `resumoGeral(mapa, agora)`: ⛔ banido, 🔎 em análise, ✖️ perdido, ⏳ restringido (só > 0, separados por " · "). Linha ✅: `N celulares conferidos · M WhatsApps OK` (M = `resumoGeral.ok`; singular "1 celular conferido").
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): manutenção guiada e texto do grupo"`

### Task 4: Estatísticas

**Files:**
- Create: `src/utils/whatsappEstatisticas.ts`, `src/utils/whatsappEstatisticas.test.ts`

**Interfaces:**
- Consumes: Task 1/2 (`numerosDoMapa`, `RetratoNumero`), `FeriadoLocal`, `feriado`, `ehFimDeSemana`, `montarIso` (calendario.ts).
- Produces:
  - `interface Trecho { chave: string; inicio: number; fim: number; situacao: Situacao; operador: string; codigo: string; equipe: string; celular: string; celularId: string | null }` (ms)
  - `trechos(mapa: MapaWhatsapp, de: Date, ate: Date): Trecho[]` — reconstrói de trás para frente a partir de `numerosDoMapa(mapa)` + eventos; começa em `max(de, inicioDoHistorico, ENTROU)`, termina em `min(ate, SAIU)`; `OPERADOR` divide trechos.
  - `type Periodo = 7 | 30 | 90 | 365`
  - `interface Estatisticas { de: Date; ate: Date; poucoHistorico: boolean; tempoOk: number | null; quedas: number; ateVoltarMs: number | null; perdidos: number; manutencoes: { feitas: number; total: number }; quedasPorDia: { dia: string; quedas: number }[]; maisCairam: Linha[]; maisEstaveis: { chave: string; codigo: string; operador: string; celular: string; dias: number; desdeOInicio: boolean }[]; porOperador: Grupo[]; porCelular: (Grupo & { hex: string })[]; porEquipe: Grupo[]; calendario: { dia: string; manha: boolean | null; almoco: boolean | null }[] }`
    - `Linha = { chave: string; codigo: string; operador: string; celular: string; quedas: number }` (top 10, quedas > 0)
    - `Grupo = { nome: string; quedas: number; tempoOk: number | null; sequenciaDias: number | null }`
    - `calendario`: dias úteis (seg–sex sem feriado nacional/local) do período; `null` = janela ainda não terminou.
  - `calcularEstatisticas(mapa: MapaWhatsapp, periodo: Periodo, agora: Date, feriados: FeriadoLocal[]): Estatisticas`
  - `formatarDuracao(ms: number): string` → "45min" / "3h 20min" / "2d 4h".

- [ ] **Step 1: Failing tests** com mapas e históricos montados à mão (início do histórico 01/10/2026, agora 28/10/2026 12:00):
  - número OK o mês todo menos BANIDO de 10/10 08:00 a 11/10 08:00 → 1 queda, `ateVoltarMs` 24 h, `tempoOk` ≈ 1 − 24h/tempo observado no período de 30 dias.
  - ANALISE → PERMANENTE conta 1 perdido e não conta queda nova.
  - troca de operador (ANA → BIA) no meio: queda antes da troca vai para ANA, `porOperador` tem as duas.
  - número que ENTROU em 20/10 e SAIU em 25/10: trechos só nesse intervalo.
  - período de 7 dias corta um trecho que começou antes: só a parte dentro conta.
  - Review Focus 5: tudo NÃO TEM → `tempoOk: null`; `inicioDoHistorico` depois do período → `null`.
  - mais estáveis: sem eventos → `dias` desde o início, `desdeOInicio: true`.
  - calendário com feriado local em 15/10 (fica fora) e manutenção MANHA concluída em 27/10 → `{ dia: '2026-10-27', manha: true, almoco: false }`; hoje 28/10 12:00 → `manha: false` (terminou), `almoco: null`.
  - `poucoHistorico` true quando o histórico tem menos de 14 dias.
  - `formatarDuracao` nos três formatos.
- [ ] **Step 2:** `npx vitest run src/utils/whatsappEstatisticas.test.ts` → FAIL.
- [ ] **Step 3:** implementar. Janela "terminou" = MANHA às 12:00, ALMOCO às 15:00 do dia. `manutencoes.total` conta só janelas terminadas.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): estatísticas do histórico"`

### Task 5: Planilha — abas Estatísticas e Histórico

**Files:**
- Modify: `src/utils/whatsappResumo.ts`, `src/utils/whatsappResumo.test.ts`

**Interfaces:**
- Consumes: `calcularEstatisticas(mapa, 30, agora, feriados)`, `formatarDuracao` (Task 4), `ROTULO_JANELA` (Task 3).
- Produces: `gerarResumoWhatsapp(mapa: MapaWhatsapp, agora: Date, feriados: FeriadoLocal[] = []): Promise<Workbook>` — abas na ordem Painel, Mapa, Celulares, Lista, Estatísticas, Histórico, dados.

- [ ] **Step 1: Failing tests:**
  - ordem das abas acima; `dados` oculta; Estatísticas/Histórico sem linhas de grade.
  - Estatísticas: os números grandes batem com `calcularEstatisticas` (tempo OK em %, "—" quando `null`).
  - Histórico: tabela do Excel com filtro e colunas `['Data e hora', 'Tipo', 'Código', 'Operador', 'Equipe', 'Celular', 'Vaga', 'De', 'Para', 'Manutenção']`, só eventos dos últimos 30 dias, mais recente primeiro; manutenções do período listadas abaixo.
  - Review Focus 3: mapa com manutenção cujo texto tem emoji e JSON maior que 30 000 caracteres, montado para um emoji cair na divisa → ida e volta `lerArquivoDoMapa` devolve `toEqual`.
  - ida e volta com histórico e manutenção aberta.
- [ ] **Step 2:** `npx vitest run src/utils/whatsappResumo.test.ts` → FAIL.
- [ ] **Step 3:** implementar no estilo das abas existentes (`novaAba`, `cabecalho`, `secao`, `escrever`); tipo do evento em português (Situação / Operador / Entrou / Saiu); situações com `ROTULOS`. Corte da aba `dados`: se o último caractere do pedaço for um high surrogate (0xD800–0xDBFF), o pedaço termina um antes.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): abas Estatísticas e Histórico na planilha"`

### Task 6: Hook e modo manutenção na tela

**Files:**
- Modify: `src/hooks/useWhatsappBaias.ts`, `src/components/whatsapp/WhatsappHub.tsx`, `src/styles/whatsapp.css`
- Create: `src/components/whatsapp/Manutencao.tsx`

**Interfaces:**
- Consumes: `gravarAlteracao` (Task 2); Task 3 inteira.
- Produces (hook): toda função que altera o mapa passa por `setMapa((antes) => gravarAlteracao(antes, mudar(antes), new Date()))`; `substituir(novo)` também (é a das configurações); `importar(novo)` substitui sem gravar; `erroAoSalvar: boolean` (true quando `localStorage.setItem` lança; volta a false ao salvar). Hub: importações usam `wpp.importar`; `erroAoSalvar` mostra aviso fixo "Armazenamento cheio: exporte o mapa e baixe a planilha"; `gerarResumoWhatsapp(mapa, agora, feriados)` com `useFeriados`.
- Produces (tela): `<Manutencao mapa agora onMapa={wpp.alterarMapa} onNotify />` acima do mapa quando `mapa.manutencaoAtual` existe; botão **🔧 Iniciar manutenção** / **Continuar manutenção** no topo do Hub.

- [ ] **Step 1:** hook e Hub (sem teste de componente no projeto; a lógica já está testada nas Tasks 2–3). `npx tsc --noEmit -p .` limpo; `npx vitest run` → PASS.
- [ ] **Step 2:** `Manutencao.tsx` conforme spec §4: faixa (janela com seletor, início, barra de progresso `conferidos/etapas`, Concluir, Cancelar com `window.confirm`), um cartão por etapa (um aberto por vez; chips de navegação no topo com ✅ nos conferidos), linhas com situação e botões de `acoesPossiveis` (RESTRINGIDO abre o mesmo formulário de tempo do painel; TROCOU_CHIP em vaga pede número opcional), **✅ Celular conferido** abre a próxima não conferida; Concluir com faltando pede confirmação, campo de observação, depois mostra o texto num `<pre>` com **📋 Copiar** (`navigator.clipboard.writeText`; em erro, seleciona o texto e avisa). CSS: botões de ação grandes (mín. 44 px de altura), cores das situações, faixa fixa no topo da ferramenta em telas largas, tudo em coluna no celular.
- [ ] **Step 3:** `npm run build` ok; navegador (preview na 4173, planilha fictícia): iniciar às 09:15 → "Manhã"; numa vaga banida "Pedi análise"; noutra em análise "Liberado"; conferir 2 celulares; recarregar a página → "Continuar manutenção" volta onde estava; concluir → texto com as 2 ações; Copiar; claro/escuro e 390 px; 0 erros no console; prints.
- [ ] **Step 4:** `git commit -m "feat(whatsapp): modo manutenção na tela"`

### Task 7: Tela de estatísticas

**Files:**
- Create: `src/components/whatsapp/Estatisticas.tsx`
- Modify: `src/components/whatsapp/WhatsappHub.tsx`, `src/styles/whatsapp.css`

**Interfaces:**
- Consumes: `calcularEstatisticas`, `formatarDuracao` (Task 4); `useFeriados`.
- Produces: abas **🗺️ Mapa** / **📊 Estatísticas** no topo do Hub (a manutenção aberta continua visível só em Mapa); `<Estatisticas mapa agora feriados onAbrir={(alvo) => …} />`.

- [ ] **Step 1:** carregar a skill `dataviz` antes do primeiro gráfico; seguir as 9 seções do spec §6 com seletor de período (7/30/90/365, padrão 30). Números grandes em cartões; colunas de quedas por dia (SVG, rótulos de eixo, valor no hover via `<title>`); rankings com barra proporcional; tabela por operador ordenável por coluna; barras por celular (amostra da capinha) e por equipe; calendário (duas bolinhas por dia, verde feita / contorno não feita / cinza-claro futura); histórico com filtros equipe/situação (clicar abre a baia no mapa e troca para a aba Mapa); manutenções anteriores (clicar mostra o texto com Copiar). Aviso de pouco histórico; estados vazios em texto.
- [ ] **Step 2:** `npx tsc --noEmit -p .`, `npx vitest run`, `npm run build` limpos.
- [ ] **Step 3:** navegador com histórico fictício de ~3 semanas (gerado por script no workspace com as funções puras): cada seção aparece com números plausíveis; trocar período muda os números; clicar no histórico abre a baia; claro/escuro e 390 px; 0 erros; prints.
- [ ] **Step 4:** `git commit -m "feat(whatsapp): tela de estatísticas"`

### Task 8: README, verificação final e entrega

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** seção "WhatsApp das Baias": subseção **🔧 Manutenção** (janelas, botões, texto do grupo com exemplo fictício), **📊 Estatísticas** (definições de queda, tempo OK, até voltar), abas novas na tabela da planilha, linhas novas na tabela de testes (`whatsappHistorico`, `whatsappManutencao`, `whatsappEstatisticas`), linha da tabela de chaves do localStorage atualizada.
- [ ] **Step 2:** `npm test` e `npm run build` limpos.
- [ ] **Step 3:** prints finais (computador e celular) da manutenção, do texto e das estatísticas, e render da planilha (abas novas).
- [ ] **Step 4:** `git commit -m "docs: registro de manutenção e estatísticas no README"` e push.
