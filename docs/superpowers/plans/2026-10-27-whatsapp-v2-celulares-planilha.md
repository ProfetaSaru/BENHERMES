# WhatsApp das Baias v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Celulares corporativos com vagas por marca ligadas às baias, ciclo do banimento com alertas e a planilha nova (Painel, Mapa, Celulares, Lista + dados oculta), mantendo o mapa como tela principal.

**Architecture:** Mudança sobre a v1 da branch `feat/whatsapp-baias`. Regras continuam em funções puras com `agora` injetado: `whatsappBaias.ts` (situações, ciclo, mesas, arquivo), `celulares.ts` (vagas e ligações), `whatsappAlertas.ts` (resumo e alertas), `whatsappPlanilha.ts` (importação) e `whatsappResumo.ts` (planilha nova); a tela consome tudo pelo hook.

**Tech Stack:** React 18 + TypeScript + Vite 6, vitest 3.2.7, SheetJS `xlsx` (leitura), exceljs 4.4.0 (escrita, via `novaPlanilha()`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-27-whatsapp-celulares-planilha-design.md` (sobre `docs/superpowers/specs/2026-10-27-whatsapp-baias-design.md`)

## Global Constraints

- Tudo no navegador; chave `benhermes_whatsapp`; nenhuma dependência nova.
- Testes e código só com nomes fictícios (ANA, BRUNO…; celulares "Azul", "Preto" com apelidos fictícios).
- `MapaWhatsapp.versao` = 2; dados v1 (navegador e `.json`) são migrados, nunca recusados por serem v1.
- Situações: `OK`, `BANIDO`, `ANALISE`, `PERMANENTE`, `RESTRINGIDO`, `NAO_TEM`. Rótulos curtos (planilha, botões, chips): `OK`, `BANIDO`, `EM ANÁLISE`, `PERDIDO`, `RESTRINGIDO`, `NÃO TEM`. Rótulos longos (tela): `Banido — pedir análise`, `Em análise`, `Perdido (permanente)`.
- Alerta de análise atrasada: **24 h** depois de `analisePedidaEm`.
- Nomes de backup: "Benconsig Comercial"; Digital: "Digital Benconsig".
- Cores (texto; fundo claro): OK `#1F7A4D`; BANIDO `#B42318` (`#FEF3F2`); EM ANÁLISE `#C2410C` (`#FFF7ED`); PERDIDO `#111827` (`#F3F4F6`); RESTRINGIDO `#9A6700` (`#FFFBEB`); NÃO TEM `#6B7280`; azul `#0B3A82`, amarelo `#F5B800`, texto `#1B2230`, secundário `#6B7280`, linha `#E5E9F0`; fonte Calibri.
- Comandos: `npx vitest run <arquivo>`, `npx tsc --noEmit -p .`, `npm run build`.

## Review Focus

1. **Mudar a marca ou os usuários de um celular com vagas ligadas** — as vagas que continuam mantêm a baia e o número do chip; teste na Task 2.
2. **Remover uma mesa que tem celular** — o celular fica guardado (`mesaId` null) e as vagas viram backup, sem apontar para baias que não existem; teste na Task 2.
3. **Diminuir as baias de uma mesa com vaga ligada a uma baia removida** — a vaga vira backup; teste na Task 2.
4. **Celular guardado (sem equipe)** aparece na aba Celulares e na Lista, sem quebrar o Painel; teste na Task 5.
5. **`.json` exportado pela v1** importa migrado (SUB some, supervisor NÃO TEM vira "Sem WhatsApp"); teste na Task 1.

---

### Task 1: Tipos v2, ciclo do banimento e migração

**Files:**
- Modify: `src/types/whatsapp.ts`, `src/utils/whatsappBaias.ts`
- Test: `src/utils/whatsappBaias.test.ts` (atualizar expectativas da v1 que mudam)

**Interfaces:**
- Produces (`types`): tudo da seção 2 do spec (`Situacao` com 6 valores, `EstadoWhatsapp.analisePedidaEm`, `WhatsappDoSupervisor`, `Mesa.whatsappSupervisor`, `Marca`, `VagaWhatsapp`, `Celular`, `MapaWhatsapp` v2 com `celulares: Celular[]`). Remove `CelularCorporativo`.
- Produces (`whatsappBaias.ts`):
  - `ROTULOS: Record<Situacao, string>` (curtos) e `DESCRICOES: Record<Situacao, string>` (longos: OK `OK`, BANIDO `Banido — pedir análise`, ANALISE `Em análise`, PERMANENTE `Perdido (permanente)`, RESTRINGIDO `Restringido`, NAO_TEM `Não tem`).
  - `mudarSituacao(atual, nova, agora)`: proíbe `RESTRINGIDO` e `ANALISE` (lança, como hoje para RESTRINGIDO).
  - `pedirAnalise(agora: Date): EstadoWhatsapp` → `{ situacao: 'ANALISE', analisePedidaEm, mudouEm }`.
  - `analiseAtrasada(e: EstadoWhatsapp, agora: Date): boolean` (≥ 24 h).
  - `tempoDesde(iso: string, agora: Date): string` → `"45min"`, `"3h"`, `"26h"` (até 47 h), `"3d"`.
  - `novaMesa(dados, agora)`: `dados` aceita `whatsappSupervisor?` (padrão `'PC'`).
  - `mapaInicial(agora)`: mesa `OP1` 4+4 com `centro: 'SUP'`, `whatsappSupervisor: 'PC'`, `celulares: []`, `versao: 2`.
  - `migrarMapa(dados: any): MapaWhatsapp` — v1 → v2 (regras da seção 2 do spec); usado por `lerMapa` (privado), então `importarMapa`, `lerMapaSalvo` e `carregarMapa` aceitam v1 e v2.
  - Remove `alterarCelularNoMapa`, `CORES_CELULARES` e `corDoCelular` daqui (vão para a Task 2).
  - `resumoGeral` e `resumoDaSala` saem deste arquivo (vão para a Task 3).

- [ ] **Step 1: Testes que falham**
  - `pedirAnalise(AGORA)` = `{ situacao: 'ANALISE', analisePedidaEm: AGORA.toISOString(), mudouEm: AGORA.toISOString() }`; `mudarSituacao(ok, 'ANALISE', …)` lança.
  - `analiseAtrasada` falso com 23h59 e verdadeiro com 24h.
  - `tempoDesde`: 45 min → `'45min'`, 3 h → `'3h'`, 26 h → `'26h'`, 72 h → `'3d'`.
  - `mapaInicial`: `versao: 2`, `celulares: []`, mesa com `centro: 'SUP'`, `whatsappSupervisor: 'PC'`, lugares `['SUP','E1'..'E4','D1'..'D4']`.
  - Migração: um mapa v1 montado no teste (mesa `SUPSUB` com `SUB`, SUP `NAO_TEM`, dois `celulares` v1) → `versao: 2`, `celulares: []`, `centro: 'SUP'`, sem `SUB`, `whatsappSupervisor: 'NAO_TEM'`; `importarMapa` de um `.json` v1 (com `tipo`) devolve o mesmo resultado.
  - `.json` v2 ida e volta continua `toEqual`; `{"versao":3}` é ilegível.
- [ ] **Step 2:** `npx vitest run src/utils/whatsappBaias.test.ts` → FAIL nas novas.
- [ ] **Step 3:** implementar tipos e funções acima.
- [ ] **Step 4:** testes do arquivo → PASS (os outros arquivos podem quebrar na compilação até as Tasks 2–5; rodar só este).
- [ ] **Step 5:** `git commit -m "feat(whatsapp): tipos v2, ciclo do banimento e migração"`

### Task 2: Celulares e vagas

**Files:**
- Create: `src/utils/celulares.ts`
- Test: `src/utils/celulares.test.ts`

**Interfaces:**
- Consumes: tipos e `estado`, `removerMesaNoMapa`, `formatarMesa`, `alterarMesaNoMapa` (Task 1 / v1); `posicoesAtivas`.
- Produces:
  - `CORES_CAPINHA: Record<string, string>` (Azul `#00B0F0`, Verde `#00B050`, Vermelho `#FF0000`, Ciano `#2BF8FD`, Preto `#000000`, Roxo `#7030A0`, Branco `#FFFFFF`), `corDaCapinha(nome): string` (cinza `#808080` se desconhecida).
  - `vagasDaMarca(marca: Marca, usuarios: number): Pick<VagaWhatsapp, 'grupo' | 'app' | 'rotulo'>[]` — tabela da seção 2 do spec, na ordem dela.
  - `novoCelular(dados: Pick<Celular, 'cor' | 'hex' | 'apelido' | 'marca' | 'usuarios' | 'mesaId'>, mapa: MapaWhatsapp, agora: Date): Celular` — `compartilhado` e `nomeBackup` pela mesa (nome "Digital" → compartilhado, "Digital Benconsig"; senão "Benconsig Comercial"); aplica `ligarAutomaticamente`.
  - `ligarAutomaticamente(celular: Celular, mapa: MapaWhatsapp): Celular` — regra da seção 2 do spec.
  - `ligarBaia(mapa, celularId, vagaId, baia: string | null, agora): { mapa: MapaWhatsapp; desligada: string | null }` — `desligada` = texto do local da vaga que perdeu a baia.
  - `mudarEquipe(mapa, celularId, mesaId: string | null, agora): MapaWhatsapp`; `mudarMarcaOuUsuarios(celular, marca, usuarios, agora): { celular: Celular; removidas: VagaWhatsapp[] }`.
  - `adicionarVaga(celular, dados: Pick<VagaWhatsapp,'grupo'|'app'|'rotulo'>, agora)`, `removerVaga(celular, vagaId)`.
  - `adicionarCelularNoMapa`, `alterarCelularNoMapa(mapa, celularId, mudar: (c: Celular) => Celular, agora)`, `removerCelularNoMapa(mapa, celularId, agora)`.
  - `removerMesaComCelulares(mapa, salaId, mesaId, agora)` (celulares da mesa: `mesaId` null, vagas viram backup) e `limparLigacoes(mapa): MapaWhatsapp` (vaga ligada a baia inexistente ou desativada vira backup) — chamada após `formatarMesa` salvo.
  - `estadoDaVaga(mapa, celular, vaga): EstadoWhatsapp`; `alterarEstadoDaVaga(mapa, celularId, vagaId, e, agora)` (ligada → `lugar.whatsapp`; backup → `vaga.whatsapp`).
  - `nomeDaVaga(mapa, celular, vaga): string` (operador, "Vaga vazia" ou `nomeBackup`); `nomeDoCelular(c)` → `"Preto · Maísa"` ou `"Azul"`; `textoDoLocal(c, v)` → `"Azul · Usuário 2 · Messenger 1"`; `ondeEstaABaia(mapa, mesaId, posicao): { celular: Celular; vaga: VagaWhatsapp } | null`.

- [ ] **Step 1: Testes que falham** (`celulares.test.ts`, mapa com uma sala, OP1 4+4 e uma mesa "Digital"):
  - `vagasDaMarca`: SAMSUNG 8, MOTOROLA 4 → 15 (6 no Proprietário), MOTOROLA 2 → 9, XIAOMI 4 → 12, XIAOMI 6 → 18, IPHONE 3, OUTRO 0; primeira vaga do Motorola `{ grupo: 'Proprietário', app: 'BUSINESS', rotulo: 'Business' }`.
  - Motorola na OP1: E1..E4 ← os 4 primeiros Messenger na ordem (Proprietário Messenger 1, Messenger 2, Messenger clonado 1, Messenger clonado 2); D1..D4 ← Business, Business clonado, Usuário 2 Business, Usuário 3 Business; outras 7 vagas `baia: null`.
  - Samsung na OP1: D3 e D4 sem vaga (`ondeEstaABaia` null); segundo celular na OP1 liga D3 e D4 e pula as já ligadas.
  - Celular na mesa Digital: `compartilhado: true`, `nomeBackup: 'Digital Benconsig'`, nenhuma vaga ligada.
  - `ligarBaia` para uma baia já usada: a outra vaga vira backup e `desligada` traz o texto do local dela.
  - `mudarMarcaOuUsuarios` Motorola 4 → 3 usuários: `removidas` são as 3 vagas do "Usuário 4"; a vaga "Proprietário · Messenger 1" mantém `baia` e `numero`.
  - `mudarEquipe` para outra mesa refaz a ligação; para `null` deixa todas backup.
  - `removerMesaComCelulares`: celular fica com `mesaId: null` e nenhuma vaga ligada.
  - `limparLigacoes` depois de reduzir OP1 para 3 + 4: a vaga que estava em E4 vira backup.
  - `alterarEstadoDaVaga` em vaga ligada muda `lugar.whatsapp` da baia (e não `vaga.whatsapp`); em backup muda `vaga.whatsapp`.
  - `nomeDaVaga`, `nomeDoCelular({ cor: 'Preto', apelido: 'Maísa' })` = `'Preto · Maísa'`, `textoDoLocal` = `'Azul · Usuário 2 · Messenger 1'`.
- [ ] **Step 2:** `npx vitest run src/utils/celulares.test.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): celulares corporativos e vagas por marca"`

### Task 3: Resumo e alertas

**Files:**
- Create: `src/utils/whatsappAlertas.ts`
- Test: `src/utils/whatsappAlertas.test.ts` (move para cá os testes de resumo da v1, atualizados)

**Interfaces:**
- Consumes: Task 1 e Task 2 (`estadoDaVaga`, `nomeDaVaga`, `textoDoLocal`, `nomeDoCelular`).
- Produces:
  - `ResumoWhatsapp = { ok; banido; analise; analiseAtrasada; permanente; restringido; vencidas; naoTem; vagasVazias; celulares }` (números).
  - `resumoDaSala(sala: Sala, agora): ResumoWhatsapp` — baias ativas + SUP quando `whatsappSupervisor !== 'NAO_TEM'`; `celulares: 0`.
  - `resumoGeral(mapa, agora): ResumoWhatsapp` — salas + vagas de backup de todos os celulares; `celulares` = quantidade.
  - `resumoDoCelular(mapa, celular, agora): { total; operadores; backups; ok; problemas }`.
  - `type AlvoAlerta = { tipo: 'lugar'; salaId; mesaId; posicao } | { tipo: 'vaga'; celularId; vagaId }`; `type TipoAlerta = 'PEDIR_ANALISE' | 'ANALISE_ATRASADA' | 'RESTRICAO_VENCIDA' | 'PERMANENTE' | 'RESTRINGIDO' | 'NAO_TEM'`; `Alerta = { tipo; onde: string; quem: string; situacao: Situacao; desde: string; ate?: string; alvo: AlvoAlerta }`.
  - `alertas(mapa, agora): Alerta[]` — ordem da seção 3 do spec (PEDIR_ANALISE por `mudouEm` mais antigo; RESTRINGIDO por `restritoAte`); ANALISE com menos de 24 h não entra; `onde` = código da baia ou `textoDoLocal`; `quem` = operador ("Vaga vazia") / `nomeBackup` / supervisor.

- [ ] **Step 1: Testes que falham** — mapa com: E1 BANIDO há 5 h, E2 BANIDO há 1 h, D1 ANALISE há 26 h, D2 ANALISE há 2 h, E3 RESTRINGIDO vencido, D3 PERMANENTE, E4 RESTRINGIDO até amanhã, SUP NAO_TEM com `whatsappSupervisor: 'PC'`, outra mesa com supervisor `'NAO_TEM'` e SUP BANIDO, e um celular com uma vaga de backup BANIDA:
  - `alertas(...).map(a => a.tipo)` = `['PEDIR_ANALISE','PEDIR_ANALISE','PEDIR_ANALISE','ANALISE_ATRASADA','RESTRICAO_VENCIDA','PERMANENTE','RESTRINGIDO','NAO_TEM']`, com E1 antes de E2 e o backup na posição pela hora; o SUP sem WhatsApp não aparece.
  - alerta do backup: `onde` = `'Azul · Proprietário · Messenger clonado 1'`, `quem` = `'Benconsig Comercial'`, `alvo.tipo` = `'vaga'`.
  - `resumoGeral` conta o backup e não conta o SUP sem WhatsApp; `analiseAtrasada: 1`, `celulares: 1`.
- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): resumo de todos os WhatsApps e alertas do banimento"`

### Task 4: Importação (planilha antiga e aba dados)

**Files:**
- Modify: `src/utils/whatsappPlanilha.ts`, `src/utils/whatsappPlanilha.test.ts`

**Interfaces:**
- Consumes: `importarMapa` (Task 1).
- Produces: `importarPlanilhaWhatsapp(grade, agora)` devolvendo v2 (BACKUP ignorado → `centro: 'SUP'`, sem `SUB`; SUP "NÃO TEM" → `whatsappSupervisor: 'NAO_TEM'`, senão `'PC'`; `celulares: []`; se havia bloco de celulares, aviso `"Os celulares não são importados da planilha antiga; cadastre-os em Configurar."`); `lerArquivoDoMapa(livro: XLSX.WorkBook, agora: Date): ResultadoImportacao` (aba `dados` → junta a coluna A e usa `importarMapa`, `avisos: []`; senão `importarPlanilhaWhatsapp(gradeDaPlanilha(livro), agora)`). Remove `gerarPlanilhaWhatsapp` e `nomeDaPlanilhaWhatsapp` (e os testes deles; a Task 5 os substitui).

- [ ] **Step 1: Testes que falham** — atualizar as expectativas da v1 (`centro: 'SUP'`, sem `SUB`, `whatsappSupervisor`, celulares e aviso) e adicionar: livro com aba `dados` (JSON de `exportarMapa` dividido em 3 linhas) → `lerArquivoDoMapa` devolve o mapa `toEqual`.
- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): importação v2 (aba dados e planilha antiga sem backup/celulares)"`

### Task 5: Planilha nova

**Files:**
- Create: `src/utils/whatsappResumo.ts`, `src/utils/whatsappResumo.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 (`resumoGeral`, `resumoDaSala`, `alertas`, `resumoDoCelular`, `ondeEstaABaia`, `textoDoLocal`, `nomeDaVaga`, `estadoDaVaga`, `exportarMapa`, `ROTULOS`, `posicoesDaMesa`, `lerArquivoDoMapa`); `novaPlanilha` de `planilhaColorida.ts`.
- Produces: `gerarResumoWhatsapp(mapa: MapaWhatsapp, agora: Date): Promise<Workbook>`; `nomeDoResumoWhatsapp(agora)` → `'whatsapp_baias_2026-10-27.xlsx'`. Layout e cores: seção 5 do spec (Painel estreito com 8 números em 2 colunas, Atenção, Equipes com barra de dados; Mapa com mesas 2 por linha e baias de 3 linhas; Celulares 3 por linha; Lista como tabela do Excel com filtro; `dados` oculta com pedaços de 30 000 caracteres). Todas as abas sem linhas de grade.

- [ ] **Step 1: Testes que falham** (mapa do teste da Task 3 + um celular guardado), lendo o buffer de volta com exceljs:
  - `worksheets.map(w => w.name)` = `['Painel','Mapa','Celulares','Lista','dados']`; `dados.state` = `'hidden'`; Painel `views[0].showGridLines` = `false`.
  - Painel: os 8 números iguais a `resumoGeral` (procurar a célula do rótulo "Pedir análise" e ler o número dela); a primeira linha de Atenção é o alerta mais antigo de pedir análise.
  - Cores: célula "BANIDO" fonte `FFB42318`; "EM ANÁLISE" `FFC2410C`; "PERDIDO" `FF111827`; "OK" `FF1F7A4D`.
  - Mapa: existe "Mapa · Comercial 1"; uma baia ligada mostra "📱 Azul · Proprietário · Messenger 1".
  - Celulares: o celular guardado aparece com "sem equipe".
  - Lista: `getTables()` tem 1 tabela com `autoFilter` e as colunas `Tipo, Sala, Equipe, Onde, Nome, Celular · vaga, Situação, Desde/Até, Número do chip`.
  - Ida e volta: `lerArquivoDoMapa(XLSX.read(buffer))` → `mapa` `toEqual` o original.
- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** → PASS; renderizar com LibreOffice (largura normal e ~390 px para o Painel) e conferir o visual com as prévias aprovadas.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): planilha nova (painel, mapa, celulares e lista)"`

### Task 6: Tela — mapa, painel, alertas e supervisor

**Files:**
- Modify: `src/hooks/useWhatsappBaias.ts`, `src/components/whatsapp/{WhatsappHub,MapaMesa,PainelLugar}.tsx`, `src/styles/whatsapp.css`
- Create: `src/components/whatsapp/Alertas.tsx`
- Delete: `src/components/whatsapp/CelularesCorporativos.tsx`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: hook com `alterarEstadoDaVaga(celularId, vagaId, e)` e `alterarMapa(mudar: (m: MapaWhatsapp) => MapaWhatsapp)` (para as operações de celular da Task 7); `Alertas` props `{ itens: Alerta[]; agora: Date; onAbrir(alvo: AlvoAlerta): void }`; `PainelLugar` ganha props `local?: string` ("📱 …" ou "sem celular"), `supervisor?: { valor: WhatsappDoSupervisor; onChange(v): void }` e as ações do ciclo (seção 3 do spec).

- [ ] **Step 1:** tokens de cor ANALISE/PERMANENTE (claro e escuro), legenda e contagens com 6 situações; `MapaMesa` com a linha do celular e o supervisor "Sem WhatsApp"; `PainelLugar` com "Pedi a análise", "Liberado", "Permanente", "Banido há …", "Análise pedida há …" e o seletor do supervisor; bloco Atenção no resumo; Baixar planilha usa `gerarResumoWhatsapp`/`nomeDoResumoWhatsapp`; Importar planilha usa `lerArquivoDoMapa`.
- [ ] **Step 2:** `npx tsc --noEmit -p .`, `npx vitest run`, `npm run build` → sem erros.
- [ ] **Step 3:** navegador (claro/escuro): banido → pedi a análise → liberado; alerta de 24 h (mapa com `analisePedidaEm` antigo importado por `.json`); supervisor sem WhatsApp; baixar planilha. 0 erros no console.
- [ ] **Step 4:** `git commit -m "feat(whatsapp): ciclo do banimento, alertas e supervisor na tela"`

### Task 7: Tela — celulares e configuração

**Files:**
- Create: `src/components/whatsapp/Celulares.tsx`, `src/components/whatsapp/ConfigurarCelulares.tsx`
- Modify: `WhatsappHub.tsx`, `ConfigurarMesas.tsx` (remover mesa usa `removerMesaComCelulares`; salvar mesa chama `limparLigacoes`), `whatsapp.css`

**Interfaces:**
- Consumes: Task 2 e o hook da Task 6.

- [ ] **Step 1:** `Celulares`: cartões (amostra, `nomeDoCelular`, marca · equipe, `resumoDoCelular`), abrir/fechar, vagas agrupadas com dono e ● situação, clique abre o painel (vaga ligada → painel da baia). `ConfigurarCelulares`: adicionar/editar (cor com sugestões de `CORES_CAPINHA`, hex, apelido, marca, usuários 1–8 para Motorola/Xiaomi, equipe, compartilhado, nome do backup), mudar de equipe e remover com `window.confirm`, por vaga seletor Baia/Backup (`ligarBaia`, mostrando `desligada` numa notificação) e campo número do chip; OUTRO com adicionar/remover vaga.
- [ ] **Step 2:** tsc, vitest, build → ok.
- [ ] **Step 3:** navegador: cadastrar Motorola na OP1 (E1..D4 ligados, 7 backups), Samsung compartilhado na Digital, dois "Preto" com apelidos, mudar usuários 4 → 3 (confirmação), mudar de equipe, remover mesa com celular. Prints.
- [ ] **Step 4:** `git commit -m "feat(whatsapp): celulares na tela e na configuração"`

### Task 8: README, verificação final e entrega

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** atualizar a seção "WhatsApp das Baias" (celulares e vagas por marca, ciclo do banimento e alertas, planilha nova com as 4 abas e a oculta) e a tabela de testes (`celulares.test.ts`, `whatsappAlertas.test.ts`, `whatsappResumo.test.ts`).
- [ ] **Step 2:** âncoras do README, `npm test`, `npm run build`.
- [ ] **Step 3:** prints da tela e da planilha (computador e celular) com dados fictícios.
- [ ] **Step 4:** `git commit -m "docs: WhatsApp das Baias v2 no README"` e push.
