# Ranking de Contratos Pagos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ferramenta "Ranking de Contratos" (só admin): esteiras → ranking idêntico à macro, FEEDBACK por IA (ChatGPT → Claude → frases prontas), `.xlsx` no visual da aba RELATORIO, legenda do dia, configuração e histórico no servidor.

**Architecture:** Cálculo, planilha e legenda são funções puras em `src/utils/ranking/` rodando no navegador (as esteiras com CPF não saem do computador). O servidor ganha `server/ranking/` (cadeia de IAs, frases prontas, validação da configuração) e as rotas `/api/ranking/*`; o que é usado pelos dois lados fica em `server/ranking/` **sem nenhum import** (o servidor roda `node --experimental-strip-types`, que exige `.ts` nos imports; o navegador importa sem extensão).

**Tech Stack:** React 18, TypeScript, Vite 6, vitest 3, exceljs 4.4, Node 22 (servidor), SDKs oficiais `openai` e `@anthropic-ai/sdk`.

**Spec:** `docs/superpowers/specs/2026-11-11-ranking-contratos-design.md`. Referência das regras: `ranking_benhermes.zip` (fora do repositório; o executor tem uma cópia em `/tmp/claude-0/-home-user/9369f94f-11f0-5994-a159-1769d85c6519/scratchpad/ranking_zip/ranking_benhermes/`).

## Global Constraints

- Nenhum dado real no Git: nomes do `config.json`, o template original, o esperado de 11/11 e as esteiras ficam fora. Testes com nomes fictícios (ANA, BRUNO…).
- Regras de cálculo idênticas ao `engine.py` (nada de "melhorar" contas).
- Só admin: todas as rotas `/api/ranking/*` → 403 para os outros perfis; menu já esconde ferramentas novas dos outros perfis (`canSeeTool`).
- Chaves só no ambiente do servidor: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`; modelos `RANKING_MODELO_OPENAI` (padrão `gpt-4o-mini`) e `RANKING_MODELO_CLAUDE` (padrão `claude-haiku-5-5`). Sem `temperature` na chamada do Claude. Corpo dos pedidos de IA nunca em log.
- Frases do FEEDBACK nunca com dígito, "º", "ª", "%" ou "R$".
- Arquivos em `server/ranking/` usados pelo navegador não têm imports.
- Textos da interface em português; mesmos componentes visuais das outras ferramentas (`formatter-card`, `btn`, `escala-aviso`).

## Review Focus

1. **Relatório no 1º dia útil do mês** — a macro conta o mês anterior inteiro (`dias_uteis(2026-12-01) = (19, 19)`), sem divisão por zero; teste na Task 1.
2. **Nomes da configuração com acento ou minúsculas** ("stéphanny marlene firmo dos santos") batem com a esteira normalizada (vendedor CLT, ativo, renomear); teste na Task 1.
3. **Cabeçalho da esteira com BOM e espaços** ("﻿Proposta", "Etapa " com espaço, "Pago " com espaço) é lido normalmente; teste na Task 1.
4. **IA repete frase para empatados ou devolve frase de outra pessoa** — frases duplicadas no mesmo ranking são trocadas por prontas; teste na Task 3.
5. **Histórico reaberto depois de mudar as metas** — a planilha baixada de novo usa os valores guardados, sem recalcular; teste na Task 2.

---

### Task 1: Leitura das esteiras e cálculo

**Files:**
- Create: `src/types/ranking.ts`, `src/utils/ranking/calculo.ts`, `src/utils/ranking/calculo.test.ts`, `src/utils/ranking/golden.test.ts`

**Interfaces:**
- Produces (`src/types/ranking.ts`):
  - `ConfigRanking` = formato do `config.json` (`metas: { clt: MetasGrupo; estagio: MetasGrupo; meta_geral: number }`, `MetasGrupo = { meta_vendedor; meta_bonus_vendedor; meta_supervisor; meta_bonus_supervisor; meta_cartao }`, `emoji_destaque: string`, `feriados: string[]` (ISO), `vendedores_clt`, `supervisores_clt`, `funcionarios_ativos: string[]`, `renomear_supervisores: Record<string,string>`, `ia: { usar_chatgpt: boolean; usar_claude: boolean }`).
  - `LinhaRanking { posicao: string; nome: string; portabilidade: number; projetando: number; potencial: number; margemCartao: number; andamento: number; projecao: number; elegivel: boolean; feedback: string }`
  - `TotalRanking { portabilidade; projetando; potencial; margemCartao; andamento; projecao; elegiveis }` (números)
  - `RelatorioRanking { dia: string; vendedores: LinhaRanking[]; supervisores: LinhaRanking[]; total: TotalRanking; metaCartao: number; tituloVendedor: string; tituloSupervisor: string; cabecalhoProjecao: string }`
- Produces (`calculo.ts`): `normalizar(t: unknown): string`, `numeroBr(v: unknown): number`, `lerEsteira(texto: string): { linhas: Record<string,string>[]; faltando: string[] }`, `qualEsteira(linhas): 'pagamento' | 'andamento' | null`, `diasUteis(dia: string, feriados: string[]): [number, number]`, `gerarRelatorio(andamento, pagamento, config: ConfigRanking, dia: string): RelatorioRanking`.

- [ ] **Step 1: Failing tests** (`calculo.test.ts`, config fictícia com metas do `config.json` do pacote e nomes ANA, BRUNO, CARLA, DIEGO, EVA; equipes "EQUIPE A"/"EQUIPE B"):
  - `diasUteis('2026-11-11', ['2026-11-02','2026-11-20'])` → `[6, 19]`; `diasUteis('2026-12-01', idem)` → `[19, 19]` (Review Focus 1).
  - `numeroBr('11.233,99')` → 11233.99; `''` → 0; `normalizar(' Stéphanny  ')` → `'STEPHANNY'`.
  - `lerEsteira` com BOM e cabeçalho `"Etapa "` lê a coluna `Etapa`; sem `Valor Contrato` → `faltando: ['Valor Contrato']` (Review Focus 3).
  - `qualEsteira`: linhas com Etapa "Pago" → `'pagamento'`; só "Andamento" → `'andamento'`.
  - Proposta repetida nas duas esteiras conta uma vez (a de pagamento); "Reprovado" ignorado; `MARGEM LIVRE`/`CARTAO` pagos vão para `margemCartao` (quantidade) e não para portabilidade; quem só tem cartão não aparece.
  - Só ativos; vendedor CLT por nome com acento/minúsculas (Review Focus 2); empate: dois com portabilidade 0 → mesma posição (`"3º"`, `"3º"`), e entre empatados vem antes quem apareceu por último na esteira.
  - Projetando, potencial (faixa estágio < 1: taxa 0,001; ≥ 500/350: extra 1000), projeção = port + and/2, elegível pela meta de bônus — valores calculados à mão no teste.
  - Emoji `"ANA   🏆"` quando projetando ≥ 1,33; renomear `" robson - ura "` → nome configurado.
  - Total: portabilidade = soma dos supervisores; elegíveis = vendedores + supervisores elegíveis.
  - Títulos e `cabecalhoProjecao` de 11/11/2026: `"RANKING GERAL DE CONTRATOS PAGOS - VENDEDOR - DE 01/11/2026 A 11/11/2026"`, `"PORT. PROJEÇÃO - 18/11/2026"`.
- [ ] **Step 2:** `npx vitest run src/utils/ranking/calculo.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** implementar porte linha a linha do `engine.py` (ordenação: sort estável por `(-atingimento, -índice)`, posição muda quando o atingimento arredondado a 12 casas muda).
- [ ] **Step 4:** `golden.test.ts`: `describe.skipIf(!process.env.RANKING_GOLDEN_DIR)` lendo `andamento.csv`, `pagamento.csv`, `config.json`, `esperado.json` dessa pasta; compara posições, nomes, `margemCartao`, `elegivel` exatos e números com `toBeCloseTo(…, 2)`, mais o total. Rodar sem a variável → "skipped".
- [ ] **Step 5:** `npx vitest run` → PASS; `npx tsc --noEmit -p .` limpo.
- [ ] **Step 6:** `git commit -m "feat(ranking): leitura das esteiras e cálculo (porte da macro)"`

### Task 2: Template limpo e planilha

**Files:**
- Create: `public/ranking/template_relatorio.xlsx` (limpo), `src/utils/ranking/planilha.ts`, `src/utils/ranking/planilha.test.ts`

**Interfaces:**
- Consumes: `RelatorioRanking` (Task 1).
- Produces: `gerarPlanilhaRanking(rel: RelatorioRanking, template: ArrayBuffer): Promise<Workbook>`; `nomeDaPlanilhaRanking(dia: string): string` → `ranking_AAAA-MM-DD.xlsx`; `carregarTemplateRanking(): Promise<ArrayBuffer>` (fetch `/ranking/template_relatorio.xlsx`).

- [ ] **Step 1:** limpar o template com um script no workspace (fora do repositório; openpyxl): na aba RELATORIO apagar os valores das colunas B–K das linhas 4–30 e 34–39 e o título das linhas 2 e 32, sem tocar em estilos, larguras, alturas, mesclagens, formatos nem zoom. Conferir que nenhum nome do `config.json` aparece no arquivo (`unzip -p … xl/sharedStrings.xml | grep -c NOME` = 0).
- [ ] **Step 2: Failing tests** (`planilha.test.ts`, template lido do disco com `fs`):
  - o template do repositório não tem valores nas linhas 4–30 / 34–39 (B–K).
  - planilha de um relatório fictício (3 vendedores, 2 supervisores): B2 = título vendedor; I3 = cabeçalho de projeção; linhas 4–6 com os vendedores; separador; título e cabeçalho de supervisores; supervisores; "Total Geral" na linha do total; J "SIM"/"NÃO".
  - cores: projetando 1,05 → fonte azul; 0,8 → verde; 0,3 → preta; J com fundo de SIM/NÃO (ARGB do índice da paleta: se `xl/styles.xml` do template tiver `<indexedColors>`, usar os de lá; senão a paleta padrão: 12 → `FF0000FF`, 11 → `FF00FF00`, 8 → `FF000000`, 17 → `FF008000`, 10 → `FFFF0000`).
  - legenda de cartão: F = `metaCartao`, H = `metaCartao * 2`.
  - Review Focus 5: a planilha usa só os campos do `RelatorioRanking` recebido (relatório com valores "impossíveis" de recalcular aparece igual).
- [ ] **Step 3:** `npx vitest run src/utils/ranking/planilha.test.ts` → FAIL.
- [ ] **Step 4:** implementar o porte do `excel.py` (copiar estilo das linhas-modelo com cópia profunda de `cell.style`, altura da linha; desfazer mesclagens antigas e recriar as do `excel.py`).
- [ ] **Step 5:** `npx vitest run` → PASS; `git commit -m "feat(ranking): planilha no visual da aba RELATORIO"`

### Task 3: Frases prontas, conferência e validação da configuração (compartilhados)

**Files:**
- Create: `server/ranking/frases.ts`, `server/ranking/config.ts`, `server/ranking/frases.test.ts`, `server/ranking/config.test.ts`

**Interfaces:**
- Produces (`frases.ts`, sem imports):
  - `interface Descricao { nome: string; posicao: string; projetando: number; situacao: string; esteira: string; vendeu_cartao_ou_margem: boolean }` (igual ao `_descrever` do pacote).
  - `descrever(linhas: { nome; posicao; projetando; portabilidade; andamento; margemCartao }[]): Descricao[]` (primeiro nome em Title Case, sem o emoji; `"3º de 27"`; situação e esteira pelos limites do pacote: ≥ 1 "batendo a meta", ≥ 0,7 "perto da meta", port 0 "sem nenhum contrato pago", senão "abaixo da meta"; andamento ≥ 50000 "esteira em andamento cheia", > 0 "pouca coisa em andamento", senão "esteira vazia").
  - `fraseValida(f: string): boolean` (sem `/\d|º|ª|%|R\$/`, não vazia, ≤ 18 palavras).
  - `frasePronta(d: Descricao, indice: number, total: number, usadas: Set<string>): string` (faixa por projetando e terço da posição; começa por `d.nome`; não repete frase já em `usadas`).
  - `conferirFrases(descricoes: Descricao[], frases: string[]): { frases: string[]; trocadas: number }` (troca inválidas e repetidas por prontas).
- Produces (`config.ts`, sem imports): `validarConfig(bruto: unknown): { config: ConfigRankingServidor } | { erro: string }` (tipos de todos os campos do `config.json`; `ia` ausente → os dois ligados; ignora `_comentario`).

- [ ] **Step 1: Failing tests:** `descrever` (nome "AMANDA ALVES   🏆" → "Amanda"); `fraseValida` recusa "Ana, 3º lugar", "Ana bateu 120%", "R$ 10 mil"; `conferirFrases` com duas frases iguais troca a segunda (Review Focus 4) e troca a com número; `frasePronta` começa pelo nome e não repete em 30 pessoas; `validarConfig` aceita o formato do pacote com nomes fictícios, recusa `metas.clt.meta_vendedor: "450000"` e preenche `ia`.
- [ ] **Step 2:** `npx vitest run server/ranking` → FAIL. **Step 3:** implementar (banco com ≥ 6 frases por faixa × tom). **Step 4:** PASS; `git commit -m "feat(ranking): frases prontas, conferência e validação da configuração"`

### Task 4: Servidor — cadeia de IAs e rotas

**Files:**
- Create: `server/ranking/ia.ts`, `server/ranking/ia.test.ts`, `server/ranking.test.ts`
- Modify: `server/apiRouter.ts` (rotas + opção `rankingIa`), `package.json` (`openai`, `@anthropic-ai/sdk`), `.env.example`, `docker-compose.yml`

**Interfaces:**
- Consumes: `Descricao`, `conferirFrases` (Task 3); `validarConfig` (Task 3).
- Produces:
  - `type Provedor = { nome: 'chatgpt' | 'claude'; gerar(entrada: { vendedores: Descricao[]; supervisores: Descricao[] }, instrucao: string): Promise<{ vendedores: string[]; supervisores: string[] }> }`
  - `gerarComentarios(entrada, provedores: Provedor[]): Promise<{ vendedores: string[]; supervisores: string[]; provedor: 'chatgpt'|'claude'|'frases'; avisos: string[] }>` (timeout 30 s por provedor; quantidade diferente = falha; resultado passa por `conferirFrases`).
  - `provedoresDoAmbiente(ia: { usar_chatgpt; usar_claude }, env = process.env): Provedor[]` (só os ligados e com chave).
  - `INSTRUCAO` = texto do `comentarios.py` do pacote.
  - Rotas (admin; outros → 403): `GET /api/ranking/ia` → `{ chatgpt: { chave: boolean }, claude: { chave: boolean } }`; `POST /api/ranking/comentarios`; `GET/PUT /api/ranking/config` (`app_state` `ranking_config`, 400 com a mensagem de `validarConfig`); `GET/PUT /api/ranking/historico` (`app_state` `ranking_historico`, corta em 120 pela data de geração).
  - `createApiHandler` aceita `options.rankingIa?: { provedores?: (ia) => Provedor[] }` para os testes.

- [ ] **Step 1:** antes de escrever as chamadas, ler o README TypeScript da skill claude-api (`typescript/claude-api/README.md`) para a forma exata de `messages.create` com saída estruturada no `@anthropic-ai/sdk`; ChatGPT com `chat.completions.create` e `response_format: { type: 'json_object' }`.
- [ ] **Step 2: Failing tests** (`ia.test.ts`, provedores falsos): chatgpt ok → `provedor 'chatgpt'`; chatgpt lança "429 insufficient_quota" → claude, aviso "ChatGPT sem limite; comentários feitos pelo Claude"; ambos falham → `'frases'`; chatgpt devolve 2 frases para 3 pessoas → claude; frase com "3º" trocada; `provedoresDoAmbiente({usar_chatgpt:true, usar_claude:false}, {OPENAI_API_KEY:'x', ANTHROPIC_API_KEY:'y'})` só tem chatgpt; sem chaves → `[]`. (`ranking.test.ts`, no estilo de `apiRouter.test.ts`): operador/gerente/supervisor → 403 em todas as rotas; admin `PUT config` inválida → 400; `PUT historico` com 121 → guarda 120; `POST comentarios` com provedor falso devolve as frases; corpo do pedido sem "R$", CPF (11 dígitos) ou sobrenome.
- [ ] **Step 3:** `npx vitest run server` → FAIL. **Step 4:** `npm install openai @anthropic-ai/sdk`; implementar; `.env.example` com `OPENAI_API_KEY=` e `ANTHROPIC_API_KEY=` vazios e os dois modelos; `docker-compose.yml` repassa as quatro variáveis.
- [ ] **Step 5:** `npx vitest run` → PASS; `npm run build` ok; `node --experimental-strip-types -e "import('./server/ranking/ia.ts')"` sem erro; `git commit -m "feat(ranking): comentários por IA (ChatGPT → Claude → frases) e rotas do servidor"`

### Task 5: Legenda do dia

**Files:**
- Create: `src/utils/ranking/legenda.ts`, `src/utils/ranking/legenda.test.ts`

**Interfaces:**
- Produces: `tipoDoDia(dia: string, feriados: string[]): 'segunda'|'terca'|'quarta'|'quinta'|'sexta'|'fechamento'|'balanco'`; `legendaDoDia(dia: string, feriados: string[], variacao = 0): string` (variação inicial = soma dos dígitos da data; `variacao` soma).

- [ ] **Step 1: Failing tests:** 09/11/2026 (seg) → contém "segunda-feira" e "uma excelente semana"; 13/11 (sex) → "excelente final de semana"; 30/11 (seg, último dia útil) → "fechamento" e "novembro"; 27/11/2026 com feriado local 30/11 → 27/11 é `'fechamento'`; 01/12/2026 (1º dia útil) → `'balanco'`, texto no passado com "Novembro passou"; toda legenda começa com "Bom dia, campeões da BenConsig! 🚀", termina com "🏆💼", tem 4 parágrafos e nenhum dígito; mesma data → mesmo texto; `variacao 1` → texto diferente.
- [ ] **Step 2:** FAIL. **Step 3:** implementar com o texto do PDF (frases da quarta, quinta, sexta, segunda, terça, fechamento e balanço), 2–3 variações por parágrafo. **Step 4:** PASS; `git commit -m "feat(ranking): legenda do dia"`

### Task 6: Tela, configuração e histórico

**Files:**
- Create: `src/hooks/useRanking.ts`, `src/components/ranking/RankingHub.tsx`, `src/components/ranking/RankingConfiguracao.tsx`, `src/components/ranking/RankingTabela.tsx`, `src/styles/ranking.css`
- Modify: `src/utils/navigationItems.tsx` (item `ranking`, nome "Ranking de Contratos", ícone `Trophy`), `src/App.tsx` (rota só admin), `src/main.tsx` (CSS)

**Interfaces:**
- Consumes: Tasks 1–5; `apiRequest` (`src/utils/apiClient.ts`); `baixarPlanilha` (`src/utils/planilhaColorida.ts`).
- Produces: `useRanking()` → `{ config, salvarConfig, historico, salvarNoHistorico, removerDoHistorico, statusIa, carregando }`.

- [ ] **Step 1:** hook + componentes conforme spec §1/§9: área de arquivos (as duas esteiras numa área; `qualEsteira` decide; aviso de coluna faltando), data (hoje), **Gerar ranking** (cálculo → `POST comentarios` → se falhar, `conferirFrases` com frases prontas e aviso), prévia (`RankingTabela` com as cores), etiqueta do provedor, **Baixar planilha**, **Refazer comentários**, quadro da legenda (editável, **Outra versão**, **📋 Copiar**), histórico (reabrir, baixar, copiar legenda; mesma data pede confirmação), configuração (campos, listas uma por linha com contagem, renomear, emoji, botões IA com "chave instalada"/"sem chave", **Importar/Exportar config.json**), avisos dentro da ferramenta. Sem configuração → card pedindo importação.
- [ ] **Step 2:** `npx tsc --noEmit -p .`, `npx vitest run`, `npm run build` limpos.
- [ ] **Step 3:** navegador (servidor de desenvolvimento com o plugin da API, login admin): esteiras **fictícias** geradas por script no workspace; importar um `config.json` fictício; gerar → prévia, frases prontas (sem chaves) com etiqueta "frases prontas"; baixar e abrir a planilha (render); legenda copiar/outra versão; histórico reabre; perfil supervisor não vê o item; claro/escuro e 390 px; 0 erros; prints.
- [ ] **Step 4:** `git commit -m "feat(ranking): tela, configuração e histórico"`

### Task 7: README e entrega

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** seção "🏆 Ranking de Contratos": como gerar, configurar (importar o `config.json` do pacote), colocar as chaves no `.env` do servidor, a ordem das IAs e como tirar o Claude; legenda; teste golden com `RANKING_GOLDEN_DIR`; linhas novas na tabela de testes; item no sumário.
- [ ] **Step 2:** `npm test`, `npm run build`; âncoras do README conferidas.
- [ ] **Step 3:** `git commit -m "docs: Ranking de Contratos no README"` e push.
