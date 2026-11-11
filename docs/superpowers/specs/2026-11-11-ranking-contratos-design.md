# Ranking de Contratos Pagos — design

**Data:** 11/11/2026
**Status:** aguardando revisão
**Origem:** `ranking_benhermes.zip` (módulo Python de referência, validado contra o ranking oficial de 11/11/2026)
e a planilha `Ranking_relatorio_com_comentarios_OFICIAL.xlsm` (macro VBA), que esta ferramenta substitui.

## 1. Objetivo

Uma ferramenta nova no BenHermes, **"Ranking de Contratos"**, só para o perfil **admin**:

1. Subir as duas esteiras (Data de Andamento e Data de Pagamento), escolher a data e gerar o ranking de vendedores
   e de supervisores com o Total Geral — **as mesmas contas da macro**, centavo por centavo.
2. Coluna **FEEDBACK** escrita por IA, na ordem **ChatGPT → Claude → frases prontas**, sem nunca citar posições
   nem valores.
3. Baixar o `.xlsx` no visual da aba RELATORIO.
4. **Legenda do dia** (modelo do BenHub) pronta para copiar.
5. Configuração (metas, feriados, listas, IA) e histórico dos rankings gerados, no servidor.

**Fora do escopo:** mudar regras de cálculo; outros perfis (gerente/supervisor/operador não veem a ferramenta);
guardar as esteiras.

## 2. Decisões tomadas com o usuário

| Tema | Decisão |
|---|---|
| Linguagem | Portar para **TypeScript**; o cálculo roda **no navegador** (os CSVs com CPF não saem do computador). |
| Acesso | **Só admin** gera, configura e vê o histórico. |
| Dados para a IA | Os do pacote: primeiro nome, "Nº de T", projetando (2 casas), situação, esteira, vendeu cartão/margem. Nada de CPF, sobrenome ou R$. |
| Frases | Nunca citam posição nem valor (instrução + conferência no código). |
| Provedores | **ChatGPT** primeiro (chave mantida pelo usuário, `gpt-4o-mini` como a macro); se falhar, **Claude** (`claude-haiku-5-5`); se falhar, **frases prontas**. |
| Tirar o Claude | Botão "Usar o Claude" na configuração, ou apagar a chave no servidor. |
| Legenda | **Modelo pronto, sem IA**, com variações; editável antes de copiar. |

## 3. Dados reais fora do repositório

O pacote traz dados reais em três arquivos; nenhum vai para o Git:

- `config.json` (66 nomes): cadastrado pela tela (**Importar config.json**) e guardado só no servidor.
- `template_relatorio.xlsx`: entra **limpo** — valores das células de dados apagados, estilos/larguras/alturas/
  formatos/zoom mantidos. Fica em `public/ranking/template_relatorio.xlsx`.
- `esperado_2026-11-11.json` e as esteiras: lidos de uma pasta fora do repositório pelo teste golden
  (`RANKING_GOLDEN_DIR`), pulado quando ela não existe (CI).

## 4. Cálculo (porte do `engine.py`, regras idênticas)

Arquivo `src/utils/ranking/calculo.ts`, puro.

- `normalizar(texto)`: maiúsculas, sem acento, espaços colapsados.
- `numeroBr("11.233,99") → 11233.99`; vazio → 0.
- `lerEsteira(texto)`: CSV `;`, BOM removido; aviso se faltar `Proposta`, `Etapa`, `Produto`, `Agente`, `Equipe`,
  `Valor Contrato`. `qualEsteira(linhas)`: "pagamento" se houver Etapa "Pago", "andamento" se houver "Andamento"
  (o usuário arrasta as duas numa área só).
- `diasUteis(dia, feriados) → [passados, total]` (mesma lógica do CALC_ESPERADO; 11/11/2026 → 6 de 19).
- Contratos: da esteira de pagamento só "Pago", da de andamento só "Andamento"; proposta repetida conta uma vez
  (pagamento primeiro); agente = parte antes de " - ", normalizado; produtos `MARGEM LIVRE`, `CARTAO BENEFICIO`,
  `CARTAO` fora de portabilidade/andamento e contados em MARGEM/CARTÃO (só pagos); quem só tem margem/cartão não é
  listado.
- Vendedores: só funcionários ativos (se a lista não estiver vazia); meta CLT ou estágio; ordenação por
  portabilidade/meta desc com o desempate da macro (em empate, quem apareceu por último vem antes) e posição
  compartilhada no empate.
- PROJETANDO = portabilidade ÷ (meta × passados/total). POTENCIAL = (meta × projetando × taxa + 1% do valor de
  margem/cartão pago + extra) × 1,2 com as faixas do README do pacote (vendedor CLT, vendedor estágio, supervisor,
  supervisor CLT). PROJEÇÃO = portabilidade + andamento/2. ELEGÍVEL = portabilidade ≥ meta de bônus.
- Supervisores pela coluna Equipe (todos os agentes), ordenados por portabilidade ÷ meta de supervisor de estágio;
  `renomear_supervisores` sem diferenciar maiúsculas/acentos/espaços.
- Destaque `"<nome>   <emoji>"` quando projetando ≥ 1,33.
- Total Geral: soma dos supervisores (portabilidade, margem/cartão, andamento, projeção); projetando pela meta
  geral; potencial e elegíveis somam vendedores + supervisores.
- Títulos: "RANKING GERAL DE CONTRATOS PAGOS - VENDEDOR|SUPERVISOR - DE 01/MM/AAAA A DD/MM/AAAA";
  cabeçalho "PORT. PROJEÇÃO - <dia + 7>".

## 5. Planilha (porte do `excel.py`)

`src/utils/ranking/planilha.ts` com exceljs: carrega o template limpo, copia o estilo de cada linha-modelo
(topo 1, título 2, cabeçalho 3, vendedor 4, separador 31, título sup. 32, cabeçalho sup. 33, supervisor 34, total 39,
azul 40/41, legenda 42–46, azul 47/48, rodapé 49, vazia 60) para as linhas novas, como a macro; fonte azul ≥ 100%,
verde ≥ 70%, preto abaixo (paleta indexada 12/11/8); coluna J "SIM/NÃO" com fundo 17/10; mesclagens e a legenda de
cartão (meta e o dobro). Nome do arquivo `ranking_AAAA-MM-DD.xlsx`.

## 6. Comentários do FEEDBACK

- Navegador monta a lista (`descrever`, como `_descrever` do pacote) e chama `POST /api/ranking/comentarios`
  (admin). Corpo e resposta:
  `{ vendedores: Descricao[], supervisores: Descricao[] } → { vendedores: string[], supervisores: string[], provedor: 'chatgpt'|'claude'|'frases', avisos: string[] }`.
- Servidor (`server/rankingIa.ts`) tenta, nesta ordem, cada provedor **ligado** na configuração e **com chave**:
  1. ChatGPT — SDK oficial `openai`, modelo `RANKING_MODELO_OPENAI` (padrão `gpt-4o-mini`), resposta JSON.
  2. Claude — SDK oficial `@anthropic-ai/sdk`, modelo `RANKING_MODELO_CLAUDE` (padrão `claude-haiku-5-5`), saída
     estruturada (`output_config.format`), sem `temperature`.
  3. Frases prontas (`src/utils/ranking/frases.ts`, também usado pelo navegador se o servidor não responder).
  Um provedor falha com: erro HTTP (limite/crédito/429/5xx), mais de 30 s, JSON inválido ou quantidade de frases
  diferente da de pessoas → passa para o próximo e entra um aviso ("ChatGPT sem limite; comentários feitos pelo
  Claude").
- Instruções: as do `comentarios.py` (Belfort/Maquiavel, 18 palavras, começar pelo primeiro nome, sem números,
  posições, porcentagens ou valores, sem rótulos de personalidade, sem frases repetidas, sem ofensas).
- Conferência de cada frase (qualquer provedor): contém dígito, "º", "ª", "%" ou "R$" → trocada por frase pronta
  da mesma faixa.
- Frases prontas: faixas por projetando (≥ 1 topo/Belfort; ≥ 0,7 perto; > 0 abaixo; sem contrato) e pela posição
  relativa (terço de cima/meio/baixo) — Maquiavel mais duro mais abaixo; sempre começam pelo primeiro nome; sem
  repetição dentro do mesmo ranking.
- Chaves `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` só no ambiente do servidor (`.env`, `docker-compose.yml` repassa);
  `GET /api/ranking/ia` diz só se cada chave existe. O corpo do pedido não vai para logs.
- **Refazer comentários**: nova chamada sem recalcular.

## 7. Legenda do dia (modelo do PDF, sem IA)

`src/utils/ranking/legenda.ts`, puro: `legendaDoDia(dia, feriados, variacao) → string`.

- Tipo pela data: **primeiro dia útil do mês** → balanço do mês anterior no passado (com o nome do mês);
  **último dia útil do mês** → fechamento do mês; senão o dia da semana (segunda: início da semana; terça: acelerar;
  quarta: meio da semana; quinta: sprint antes da sexta; sexta: fechar a semana + "excelente final de semana").
- Quatro parágrafos (abertura com "Bom dia, campeões da BenConsig! 🚀", ranking/elegibilidade/projeções, chamada,
  fechamento "… rumo ao topo do ranking! 🏆💼"), cada um com 2–3 variações; a variação inicial vem da data (mesma
  data → mesmo texto); **Outra versão** avança. Sem nomes nem números.
- Quadro editável; **📋 Copiar** copia o que estiver nele; a versão final vai para o histórico.

## 8. Configuração e histórico (servidor, só admin)

- `GET/PUT /api/ranking/config` em `app_state` (`ranking_config`): mesmo formato do `config.json`
  (`metas.clt|estagio`, `meta_geral`, `emoji_destaque`, `feriados`, `vendedores_clt`, `supervisores_clt`,
  `renomear_supervisores`, `funcionarios_ativos`) + `ia: { usar_chatgpt, usar_claude }` (padrão: os dois ligados).
  Validação de tipos no servidor e na tela. **Importar config.json** / **Exportar**. Sem configuração, a tela pede a
  importação antes de gerar.
- `GET/PUT /api/ranking/historico` em `app_state` (`ranking_historico`): até 120 entradas
  `{ id, dia, geradoEm, geradoPor, provedor, relatorio, legenda }` (relatório = linhas com nomes, valores e frases;
  sem esteiras). Mesma data substitui com confirmação. Reabrir mostra a prévia, baixa o `.xlsx` e copia a legenda.
- Todas as rotas `/api/ranking/*` respondem 403 para quem não é admin.

## 9. Tela

`src/components/ranking/` — item de menu "Ranking de Contratos" (`canSeeTool`: só admin, como hoje para ferramentas
não listadas). Área de arquivos (as duas esteiras), data (padrão hoje), **Gerar ranking**, prévia das duas tabelas e
do Total Geral com as cores da planilha e a etiqueta do provedor, **Baixar planilha**, **Refazer comentários**,
quadro da legenda, histórico e configuração. Avisos visíveis na própria ferramenta.

## 10. Erros

Esteira faltando ou com coluna faltando → aviso e nada é gerado. Configuração vazia → pede importação. Servidor
fora do ar → ranking sai com frases prontas e aviso; histórico não salvo, com aviso. Falha ao salvar a
configuração → aviso, valor não perdido na tela.

## 11. Testes

- Cálculo (fictício): dias úteis de 11/2026 = (6, 19); margem/cartão fora da portabilidade; proposta repetida;
  empate e posição compartilhada; só ativos; renomear supervisor (`ROBSON - URA`); emoji ≥ 133%; faixas do
  potencial; total geral.
- **Golden** (`RANKING_GOLDEN_DIR` com as duas esteiras e o esperado): posições, nomes e valores (±0,01) iguais ao
  oficial de 11/11/2026; pulado sem a pasta.
- Leitura: BOM, `numeroBr`, coluna faltando, qual é cada esteira.
- Planilha: título, cabeçalho de projeção, cores, SIM/NÃO, legenda de cartão.
- Comentários (IAs simuladas): ChatGPT ok; ChatGPT falha → Claude; ambos falham → frases; Claude desligado; chave
  ausente; frase com número trocada; o corpo enviado não tem CPF, sobrenome nem "R$".
- Legenda: cada dia da semana; último dia útil com feriado no fim do mês; primeiro dia útil (passado, nome do mês);
  "Outra versão".
- Rotas: 403 para não-admin; validação e importação do `config.json`.

## 12. Dependências novas

`openai` e `@anthropic-ai/sdk` (oficiais, só no servidor). Nada novo no navegador (exceljs já existe).
