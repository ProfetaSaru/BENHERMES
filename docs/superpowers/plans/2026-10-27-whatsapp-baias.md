# WhatsApp das Baias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova ferramenta "WhatsApp das Baias" no BenHermes: mapa interativo das mesas/baias com a situação do WhatsApp de cada lugar, importação da planilha atual e geração da planilha de resumo no mesmo visual.

**Architecture:** Funções puras em `src/utils` (mapa genérico de mesas, regras de WhatsApp, leitura/escrita de planilha), um hook com `localStorage` e componentes React em `src/components/whatsapp`, no mesmo padrão da Escala de Bases e do Relatório URA.

**Tech Stack:** React 18 + TypeScript + Vite 6, vitest 3.2.7, SheetJS `xlsx` (leitura), exceljs 4.4.0 (escrita com cores, import dinâmico via `novaPlanilha()`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-27-whatsapp-baias-design.md`

## Global Constraints

- Tudo no navegador; nenhum servidor nem chamada externa. Chave do `localStorage`: `benhermes_whatsapp`.
- Nenhuma dependência nova (só `xlsx`, `exceljs`, `lucide-react`, `vitest` já presentes).
- Testes e código só com nomes fictícios (ANA, BRUNO, CARLA, DIEGO…). A planilha real não entra no repositório.
- Códigos no padrão do protótipo de chamados: `sigla-posição` com hífen (`OP1-E3`, `OP1-D2`, `OP1-SUP`, `OP1-SUB`); `SUB` aparece na tela como **Backup**.
- Situações: `OK`, `BANIDO`, `NAO_TEM`, `RESTRINGIDO` (rótulos: OK, BANIDO, NÃO TEM, RESTRINGIDO).
- Cores na tela: OK verde, BANIDO vermelho, RESTRINGIDO amarelo, NÃO TEM cinza, vaga vazia tracejada; usar os tokens de tema existentes (`--green`, `--red`, `--amber`, `--muted`, `--line`…).
- Cores na planilha: OK `#70AD47`, BANIDO `#FF0000`, RESTRINGIDO `#BF8F00`, NÃO TEM `#808080`, VAZIO `#FFD966`, fundo `#002060`, faixas `#FFFF00`, cabeçalho `#00B050`, operador `#0070C0`.
- Textos da interface em português, no tom das outras ferramentas.
- Comandos: `npx vitest run <arquivo>`, `npx tsc --noEmit -p .`, `npm run build`.

## Review Focus

1. **Planilha com variações de texto** (" HEITOR", "NAO TEM", "não tem", "Ok", "1° EQUIPE") — deve ser lida igual; teste na Task 3.
2. **Restrição com duração inválida** (0, negativa, vazia, não numérica) — deve ser recusada sem mudar a baia; teste na Task 2.
3. **`localStorage` corrompido ou de versão antiga** — a tela abre com o mapa inicial em vez de quebrar; teste na Task 2 (`carregarMapa`).
4. **Diminuir baias de uma mesa com operadores** — os lugares removidos são informados para confirmação e os que continuam ficam intactos; teste na Task 1.
5. **Sigla repetida ou vazia na configuração** — recusada; teste na Task 2 (`siglaValida`).

---

### Task 1: Tipos e mapa genérico de mesas

**Files:**
- Create: `src/types/whatsapp.ts`
- Create: `src/utils/mapaMesas.ts`
- Test: `src/utils/mapaMesas.test.ts`

**Interfaces:**
- Produces (`src/types/whatsapp.ts`): os tipos da seção 2 do spec — `Situacao`, `EstadoWhatsapp`, `Lugar`, `Centro`, `Mesa`, `Sala`, `CelularCorporativo`, `MapaWhatsapp` — exatamente com aqueles campos.
- Produces (`src/utils/mapaMesas.ts`, sem nada de WhatsApp; usa só um tipo estrutural `FormatoMesa = Pick<Mesa, 'sigla' | 'esq' | 'dir' | 'centro' | 'inicio' | 'desativadas'>`):
  - `codigoDoLugar(sigla: string, posicao: string): string` → `"OP1-E3"`.
  - `posicoesDaMesa(mesa: FormatoMesa): { centro: string[]; esquerda: string[]; direita: string[] }` — centro `['SUP']`, `['SUP','SUB']` ou `[]`; esquerda `E1..Eesq` e direita `D1..Ddir` **na ordem de exibição de cima para baixo** (início `'sup'`: 1 em cima; `'porta'`: 1 embaixo). Inclui as desativadas.
  - `posicoesAtivas(mesa: FormatoMesa): string[]` — todas (centro, esquerda, direita) menos as desativadas, em ordem `SUP, SUB, E1.., D1..`.
  - `ajustarLugares<T>(lugares: Record<string, T>, novo: FormatoMesa, criar: (posicao: string) => T): { lugares: Record<string, T>; removidos: string[] }` — mantém os lugares das posições que continuam, cria os novos com `criar`, devolve as posições que deixaram de existir.

- [ ] **Step 1: Escrever os testes que falham** (`mapaMesas.test.ts`)
  - `codigoDoLugar('OP1','E3')` → `'OP1-E3'`; `codigoDoLugar('DG','SUB')` → `'DG-SUB'`.
  - mesa 4+4 `SUPSUB` início `'sup'` → `{ centro: ['SUP','SUB'], esquerda: ['E1','E2','E3','E4'], direita: ['D1','D2','D3','D4'] }`.
  - mesma mesa com `inicio: 'porta'` → `esquerda: ['E4','E3','E2','E1']`.
  - `centro: 'NENHUM'` → `centro: []`; mesa 5+3 → 5 à esquerda, 3 à direita.
  - `posicoesAtivas` com `desativadas: ['E4']` não contém `'E4'` e começa por `['SUP','SUB','E1']`.
  - `ajustarLugares` de 4+4 `SUPSUB` para 3+4 `SUP`: `removidos` = `['SUB','E4']` (ordem de `posicoesAtivas` da mesa antiga), `lugares.E1` é o mesmo objeto de antes; de 4+4 para 5+4: `removidos` = `[]` e `lugares.E5` = `criar('E5')`.
- [ ] **Step 2:** `npx vitest run src/utils/mapaMesas.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** criar `src/types/whatsapp.ts` e implementar `src/utils/mapaMesas.ts` com as assinaturas acima.
- [ ] **Step 4:** `npx vitest run src/utils/mapaMesas.test.ts` → PASS; `npx tsc --noEmit -p .` sem erros.
- [ ] **Step 5:** `git add src/types/whatsapp.ts src/utils/mapaMesas.ts src/utils/mapaMesas.test.ts && git commit -m "feat(whatsapp): tipos e mapa genérico de mesas"`

### Task 2: Regras do WhatsApp das Baias

**Files:**
- Create: `src/utils/whatsappBaias.ts`
- Test: `src/utils/whatsappBaias.test.ts`

**Interfaces:**
- Consumes: tipos da Task 1; `posicoesAtivas`, `ajustarLugares`.
- Produces (todas puras; `agora: Date` sempre por parâmetro para os testes):
  - `ROTULOS: Record<Situacao, string>` = `{ OK: 'OK', BANIDO: 'BANIDO', NAO_TEM: 'NÃO TEM', RESTRINGIDO: 'RESTRINGIDO' }`.
  - `CORES_CELULARES: Record<string, string>` = VERDE `#00B050`, AZUL `#00B0F0`, VERMELHO `#FF0000`, CIANO `#2BF8FD`, PRETO `#000000`, ROXO `#7030A0`; `corDoCelular(nome: string): string` → cinza `#808080` se desconhecida.
  - `estado(situacao: Situacao, agora: Date, restritoAte?: Date): EstadoWhatsapp`.
  - `novaMesa(dados: Pick<Mesa,'nome'|'sigla'|'supervisor'|'esq'|'dir'|'centro'|'inicio'>, agora: Date): Mesa` — todos os lugares vazios e OK; `id` = `crypto.randomUUID()`.
  - `mapaInicial(agora: Date): MapaWhatsapp` — sala "Comercial 1", mesa "1º Equipe" `OP1` 4+4 `SUPSUB` início `'sup'`, 6 celulares das cores acima, tudo OK.
  - `mudarSituacao(atual: EstadoWhatsapp, nova: Situacao, agora: Date): EstadoWhatsapp` — se a situação não muda, devolve `atual` (mantém `mudouEm`); `RESTRINGIDO` aqui é proibido (use `restringir`).
  - `restringir(quantidade: number, unidade: 'horas' | 'dias', agora: Date): EstadoWhatsapp` — lança `Error('Informe um tempo maior que zero.')` se `quantidade` não for número finito > 0.
  - `restricaoVencida(e: EstadoWhatsapp, agora: Date): boolean`; `tempoRestante(e: EstadoWhatsapp, agora: Date): string` → `"1d 3h"`, `"5h 20min"`, `"45min"`, `""` se vencida/não restringido.
  - `ResumoWhatsapp = { ok: number; banido: number; restringido: number; vencidas: number; naoTem: number; vagasVazias: number }`; `resumoDaSala(sala: Sala, agora: Date): ResumoWhatsapp`; `resumoGeral(mapa: MapaWhatsapp, agora: Date): ResumoWhatsapp` — contam só `posicoesAtivas`; vagas vazias só em posições E/D com `operador === ''`.
  - `siglaValida(sigla: string, mapa: MapaWhatsapp, idDaMesa?: string): string | null` — `null` = ok; mensagem se vazia, com caracteres fora de `[A-Z0-9-]` (após maiúsculas) ou já usada por outra mesa.
  - `TIPO_ARQUIVO = 'benhermes-whatsapp-baias'`; `exportarMapa(mapa: MapaWhatsapp, agora: Date): string` (JSON com `tipo`, `exportadoEm`); `importarMapa(texto: string): MapaWhatsapp` — lança `Error` com mensagem clara se não for JSON, `tipo`/`versao` diferentes ou estrutura inválida (salas sem `mesas`, mesa sem `sigla`/`lugares`, situação desconhecida).
  - `carregarMapa(texto: string | null, agora: Date): MapaWhatsapp` — `importarMapa` sem o campo `tipo` obrigatório; qualquer erro → `mapaInicial(agora)`.

- [ ] **Step 1: Escrever os testes que falham**
  - `mapaInicial`: 1 sala, mesa `OP1` com 10 lugares (`SUP`, `SUB`, `E1..E4`, `D1..D4`), 6 celulares, `resumoGeral` = `{ ok: 10, banido: 0, restringido: 0, vencidas: 0, naoTem: 0, vagasVazias: 8 }`.
  - `mudarSituacao` OK→BANIDO grava `mudouEm` = agora; OK→OK devolve o mesmo objeto.
  - `restringir(24,'horas', 2026-10-27T10:00)` → `restritoAte` 2026-10-28T10:00; `restringir(3,'dias', …)` → +72 h; `restringir(0,…)`, `(-1,…)`, `(NaN,…)` lançam "Informe um tempo maior que zero.".
  - `tempoRestante` com 27h → `"1d 3h"`; 5h20 → `"5h 20min"`; 45 min → `"45min"`; `restricaoVencida` true depois do prazo e `tempoRestante` `""`.
  - resumo: uma baia BANIDO, uma RESTRINGIDO vencida, uma NAO_TEM, uma desativada com operador vazio → contagens certas e a desativada fora de tudo.
  - `siglaValida('', …)`, `('OP 1', …)`, `('OP1', mapaComOP1)` retornam mensagem; `('OP1', mapaComOP1, idDaPropriaOP1)` e `('dg', …)` retornam `null`.
  - `importarMapa(exportarMapa(m))` deep-equal a `m`; `importarMapa('{}')`, `importarMapa('x')`, tipo errado e situação `'TALVEZ'` lançam.
  - `carregarMapa(null)`, `carregarMapa('lixo')`, `carregarMapa('{"versao":0}')` → `mapaInicial`.
- [ ] **Step 2:** `npx vitest run src/utils/whatsappBaias.test.ts` → FAIL.
- [ ] **Step 3:** implementar `src/utils/whatsappBaias.ts`.
- [ ] **Step 4:** `npx vitest run src/utils/whatsappBaias.test.ts` → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): regras de situação, restrição, resumo e arquivo do mapa"`

### Task 3: Importar a planilha atual

**Files:**
- Create: `src/utils/whatsappPlanilha.ts`
- Test: `src/utils/whatsappPlanilha.test.ts`

**Interfaces:**
- Consumes: `estado`, `novaMesa`, `corDoCelular` (Task 2); `codigoDoLugar` não é necessário.
- Produces:
  - `gradeDaPlanilha(livro: XLSX.WorkBook): string[][]` — primeira aba, **coordenadas absolutas** (linha 0 = linha 1 do Excel, coluna 0 = A), valores como texto aparado, células vazias `''` (usar `sheet_to_json` com `header: 1`, `defval: ''`, `blankrows: true` e `range` começando em A1).
  - `ResultadoImportacao = { mapa: MapaWhatsapp; avisos: string[] }`; `importarPlanilhaWhatsapp(grade: string[][], agora: Date): ResultadoImportacao` — regras da seção 4 do spec; lança `Error('Não encontrei nenhuma equipe ("Nº EQUIPE - ...") na planilha.')` se não houver equipe.
  - `lerSituacao(texto: string): { situacao: Situacao; restritoAte?: Date } | null` — normaliza acento/maiúsculas/espaços; `"RESTRINGIDO ATÉ 29/10 14:00"` usa o ano de `agora` (parâmetro extra `agora: Date`).
  - Título da equipe: regex tolerante a `º`/`°`/`o` (`/^(\d+)\s*[º°o]?\s*EQUIPE\s*-\s*(.*)$/i`).

- [ ] **Step 1: Escrever os testes que falham** — o teste monta a grade (array de arrays) no layout da planilha original, com nomes fictícios:
  - Comercial 1 (título em E34): "1º EQUIPE - Joana Sousa" em E35 com operadores 4+4 (um " ANA ALVES" com espaço, um "VAZIO", um "NAO TEM", um "BANIDO") e linha SUPERVISOR/BACKUP; "2° EQUIPE - Fulano de Tal" em K35 **sem** BACKUP.
  - Comercial 2: "6º EQUIPE - Digital" e "7º EQUIPE - (SEGUNDA ESPINHA AO CHEGAR NO COMERCIAL)VAZIA"; uma situação "TALVEZ".
  - Bloco de celulares com VERDE, AZUL e "DOURADO".
  - Esperado: 2 salas ("Comercial 1", "Comercial 2"); mesa 1 `{ nome: '1º Equipe', sigla: 'OP1', supervisor: 'Joana Sousa', esq: 4, dir: 4, centro: 'SUPSUB' }`, `lugares.E1.operador === 'ANA ALVES'`, a vaga "VAZIO" com `operador: ''`, "NAO TEM" → `NAO_TEM`; mesa 2 `centro: 'SUP'`, `sigla: 'OP2'`; Digital `{ nome: 'Digital', sigla: 'DG', supervisor: '' }`; 7ª `{ nome: '7º Equipe (segunda espinha ao chegar no comercial)', sigla: 'OP7', supervisor: '' }`; "TALVEZ" → `NAO_TEM` e um aviso citando o texto; celular DOURADO com `hex` `#808080`.
  - Duas equipes "6º" na mesma planilha (sem Digital) → siglas `OP6` e `OP6B`.
  - Grade sem "EQUIPE" → lança a mensagem acima.
  - `gradeDaPlanilha` de um livro criado com `XLSX.utils.aoa_to_sheet` cujo `!ref` começa em `D14` devolve o texto de E34 em `grade[33][4]`.
- [ ] **Step 2:** `npx vitest run src/utils/whatsappPlanilha.test.ts` → FAIL.
- [ ] **Step 3:** implementar `gradeDaPlanilha`, `lerSituacao` e `importarPlanilhaWhatsapp` em `src/utils/whatsappPlanilha.ts`.
- [ ] **Step 4:** testes → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): importar a planilha de status dos WhatsApps"`

### Task 4: Planilha de resumo

**Files:**
- Modify: `src/utils/whatsappPlanilha.ts`
- Test: `src/utils/whatsappPlanilha.test.ts`

**Interfaces:**
- Consumes: `novaPlanilha`, `pintar` de `src/utils/planilhaColorida.ts`; `ROTULOS`, `posicoesDaMesa`, `restricaoVencida`.
- Produces: `gerarPlanilhaWhatsapp(mapa: MapaWhatsapp, agora: Date): Promise<Workbook>` (layout da seção 5 do spec: colunas E–H e K–N, larguras, duas mesas por linha, títulos com data "dd/mm/aaaa hh:mm"); `nomeDaPlanilhaWhatsapp(agora: Date): string` → `relatorio_whatsapp_2026-10-27.xlsx`.

- [ ] **Step 1: Escrever os testes que falham** — gerar a partir do mapa importado na Task 3 (com uma baia restringida até 29/10 14:00), `writeBuffer`, ler de volta com exceljs:
  - E de um título de sala = `"STATUS DOS WHATSAPP DO COMERCIAL 1 — 27/10/2026 10:00"`, fundo `FFFFFF00`, fonte 36 negrito;
  - cabeçalho da mesa 1 = `"1º EQUIPE - Joana Sousa"`; da Digital = `"DIGITAL"`;
  - célula de situação BANIDO com fonte `FFFF0000`, OK `FF70AD47`, NÃO TEM `FF808080`, restringida `"RESTRINGIDO ATÉ 29/10 14:00"` com `FFBF8F00`; vaga vazia `"VAZIO"` com `FFFFD966`;
  - largura da coluna E = 61;
  - **ida e volta:** ler o buffer com `XLSX.read` → `gradeDaPlanilha` → `importarPlanilhaWhatsapp` devolve as mesmas siglas, operadores e situações (e `restritoAte` igual) do mapa original.
- [ ] **Step 2:** testes → FAIL.
- [ ] **Step 3:** implementar `gerarPlanilhaWhatsapp` e `nomeDaPlanilhaWhatsapp`.
- [ ] **Step 4:** testes → PASS.
- [ ] **Step 5:** `git commit -m "feat(whatsapp): planilha de resumo no visual da planilha atual"`

### Task 5: Hook e tela principal com o mapa

**Files:**
- Create: `src/hooks/useWhatsappBaias.ts`
- Create: `src/components/whatsapp/WhatsappHub.tsx`, `MapaMesa.tsx`, `PainelLugar.tsx`, `CelularesCorporativos.tsx`
- Create: `src/styles/whatsapp.css` (importado no `WhatsappHub`)
- Modify: `src/utils/navigationItems.tsx` (item `whatsapp`, nome "WhatsApp das Baias", shortName "WhatsApp", descrição "Mapa das baias com a situação do WhatsApp de cada lugar.", categoria `automacoes`, selo Novo, ícone `MessageCircle`), `src/App.tsx` (rota `activeToolId === 'whatsapp'` → `<WhatsappHub onNotify={notify} />`)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `useWhatsappBaias()` → `{ mapa, substituir(m: MapaWhatsapp), alterarLugar(salaId, mesaId, posicao, mudanca: Partial<Lugar>), alterarMesa(salaId, mesaId, mudanca: Partial<Mesa>), alterarCelular(cor, campo: 'messenger' | 'business', e: EstadoWhatsapp) }`; carrega com `carregarMapa(localStorage.getItem('benhermes_whatsapp'), new Date())`, salva a cada mudança e atualiza `atualizadoEm`. `MapaMesa` props: `{ mesa: Mesa; filtro: 'todas' | 'problemas' | 'vazias'; agora: Date; selecionado: string | null; onSelecionar(posicao: string): void }`.

- [ ] **Step 1:** implementar o hook e os componentes conforme a seção 3 do spec (resumo, filtro, mapa por sala, painel do lugar com 4 botões, duração para RESTRINGIDO com mensagem de erro de `restringir`, aviso "Restrição terminou — confira" + **Voltar para OK**, celulares, botões Baixar planilha / Importar planilha com prévia e Substituir/Cancelar / Exportar mapa / Importar mapa com confirmação). Atualizar `agora` a cada minuto (`setInterval` de 60 s) para o tempo restante.
- [ ] **Step 2:** `npx tsc --noEmit -p .` e `npx vitest run` → tudo passa; `npm run build` ok.
- [ ] **Step 3: Verificar no navegador** (`npx vite preview --port 4173` + Playwright, temas claro e escuro): importar a planilha fictícia gerada pelo teste da Task 3 (salvar com exceljs num script), clicar numa baia, trocar operador, marcar BANIDO, restringir 24 h, filtrar "Só problemas", baixar a planilha. Sem erros no console. Prints em `…/scratchpad/prints_whatsapp/`.
- [ ] **Step 4:** `git commit -m "feat(whatsapp): tela do mapa das baias"`

### Task 6: Configurar salas e mesas

**Files:**
- Create: `src/components/whatsapp/ConfigurarMesas.tsx`
- Modify: `src/hooks/useWhatsappBaias.ts` (+ `adicionarSala(nome)`, `renomearSala(id, nome)`, `removerSala(id)`, `adicionarMesa(salaId, dados)`, `salvarFormatoMesa(salaId, mesaId, formato: FormatoMesa & { nome; supervisor })`, `removerMesa(salaId, mesaId)`), `WhatsappHub.tsx` (seção recolhível)

**Interfaces:**
- Consumes: `novaMesa`, `siglaValida`, `ajustarLugares`, `posicoesDaMesa`, `MapaMesa`.

- [ ] **Step 1:** implementar conforme a seção 3, item 7 do spec: formulário (nome, sigla, supervisor, steppers 1–8 por lado, centro Supervisor / Supervisor + backup / Ninguém, baia 1 pelo supervisor / pela porta), prévia com `MapaMesa` onde o clique desativa/reativa; `siglaValida` bloqueia salvar; `ajustarLugares` → se `removidos` tiver operador, `window.confirm` listando os códigos; remover sala/mesa com confirmação.
- [ ] **Step 2:** `npx tsc --noEmit -p .`, `npx vitest run`, `npm run build` ok.
- [ ] **Step 3:** navegador: criar mesa 5+5 sem centro, desativar uma baia, reduzir de 5 para 3 com operador (aparece a confirmação), sigla repetida bloqueada. Prints.
- [ ] **Step 4:** `git commit -m "feat(whatsapp): configurar salas e mesas"`

### Task 7: README e entrega

**Files:**
- Modify: `README.md` (tabela de ferramentas, sumário, seção "WhatsApp das Baias" com `<details>` para "Importar a planilha" e "Planilha de resumo", e linha na tabela "Onde ficam os dados": `benhermes_whatsapp`)

- [ ] **Step 1:** escrever a seção no estilo das demais.
- [ ] **Step 2:** validar as âncoras do sumário (mesma checagem usada no README atual) e `npm test` + `npm run build`.
- [ ] **Step 3:** `git commit -m "docs: WhatsApp das Baias no README"`, push e PR para `main` com prints.
