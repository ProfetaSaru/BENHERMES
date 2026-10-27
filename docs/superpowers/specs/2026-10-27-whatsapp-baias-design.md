# WhatsApp das Baias — desenho

**Data:** 27/10/2026
**Status:** aguardando revisão
**Ferramenta:** nova, no BenHermes (`id: whatsapp`)

## 1. Objetivo

Substituir a planilha `RELATORIO-WHATSAPP-INTUITIVO.xlsx` por um **mapa interativo das baias** onde se vê e se
atualiza a situação do WhatsApp de cada lugar, com o nome do operador e do supervisor editáveis, e de onde sai a
planilha de resumo no mesmo visual da atual.

**Quem usa agora:** uma pessoa (o responsável pelo relatório) atualiza ao longo do dia e manda o resumo.
**Depois (fora deste escopo):** os supervisores atualizarão pelo futuro site de chamados. Por isso o mapa usa o
**mesmo modelo de mesas e códigos do protótipo do Sistema de Chamados v2** (`OP1-E3`, `OP1-SUP`, `DG-M1-SUB`…) e
pode ser exportado/importado em `.json`.

**Critérios de sucesso**
1. Importar a planilha atual e ver o mapa preenchido (salas, equipes, operadores, supervisores, situações e
   celulares corporativos) sem digitar nada.
2. Trocar operador, supervisor e situação de qualquer lugar em até 2 cliques.
3. Baixar a planilha de resumo no visual da atual, com a data.
4. Tudo continua no navegador (sem servidor), como o resto do BenHermes.

## 2. Modelo de dados

```ts
type Situacao = 'OK' | 'BANIDO' | 'NAO_TEM' | 'RESTRINGIDO';

interface EstadoWhatsapp {
  situacao: Situacao;
  restritoAte?: string; // ISO; só quando RESTRINGIDO
  mudouEm: string;      // ISO; última mudança de situação
}

interface Lugar {
  operador: string;     // '' = vaga vazia (no SUP o nome é o supervisor da mesa)
  whatsapp: EstadoWhatsapp;
}

type Centro = 'SUP' | 'SUPSUB' | 'NENHUM';   // mesmos valores do protótipo de chamados

interface Mesa {
  id: string;
  nome: string;          // "1º Equipe", "Digital"
  sigla: string;         // "OP1", "DG" — prefixo dos códigos
  supervisor: string;    // nome exibido no topo da mesa
  esq: number;           // baias do lado esquerdo (1 a 8)
  dir: number;           // baias do lado direito (1 a 8)
  centro: Centro;        // SUP = supervisor; SUPSUB = supervisor + backup
  inicio: 'sup' | 'porta'; // a baia 1 fica perto do supervisor ou da porta
  desativadas: string[]; // posições desativadas, ex.: ["E4"]
  lugares: Record<string, Lugar>; // chave = posição: "E1".."E8", "D1".."D8", "SUP", "SUB"
}

interface Sala { id: string; nome: string; mesas: Mesa[] }

interface CelularCorporativo {
  cor: string;           // "VERDE"
  hex: string;           // cor exibida, ex.: "#00B050"
  messenger: EstadoWhatsapp;
  business: EstadoWhatsapp;
}

interface MapaWhatsapp {
  versao: 1;
  salas: Sala[];
  celulares: CelularCorporativo[];
  atualizadoEm: string;  // ISO
}
```

- **Código de um lugar:** `sigla-posição` com hífen, como no protótipo: `OP1-E3`, `OP1-D2`, `OP1-SUP`, `OP1-SUB`.
  O backup usa a posição `SUB` do protótipo (sub-líder) e aparece na tela como **Backup**.
- **A situação é da baia** (do número de WhatsApp daquele lugar), não da pessoa: esvaziar a baia mantém a situação.
- **Guardado em** `localStorage` na chave `benhermes_whatsapp`.
- **Mapa inicial (sem nada salvo):** sala "Comercial 1" com uma mesa "1º Equipe" (`OP1`, 4 + 4, supervisor + backup,
  todos OK) e os 6 celulares (verde, azul, vermelho, ciano, preto, roxo) com OK. A tela sugere importar a planilha.

### Restrição

- Ao marcar **RESTRINGIDO**, informa-se a duração: número + unidade (**horas** ou **dias**). `restritoAte` =
  agora + duração.
- Na baia: "Restringido · até 29/10 14:00 · faltam 1d 3h".
- Depois de `restritoAte`, a baia **não muda sozinha**: mostra "Restrição terminou — confira" e o botão
  **Voltar para OK**. No resumo, conta como "restrição vencida".

## 3. Tela

1. **Cabeçalho** no padrão das outras ferramentas, com a data da última atualização.
2. **Resumo** por sala e geral: OK, BANIDO, RESTRINGIDO (quantas vencidas), NÃO TEM, vagas vazias.
3. **Filtro:** Todas · Só problemas (BANIDO + RESTRINGIDO + NÃO TEM) · Vagas vazias. O filtro apaga
   (opacidade) as baias fora dele, sem tirá-las do mapa.
4. **Mapa** por sala, mesas em grade (2 por linha em telas largas, 1 no celular). Cada mesa no visual do protótipo
   de chamados: supervisor (e backup) no topo, lado esquerdo e lado direito separados por um corredor,
   "início da mesa" embaixo, legenda com as cores:
   - OK verde · BANIDO vermelho · RESTRINGIDO amarelo · NÃO TEM cinza · vaga vazia tracejada.
   - Cada baia: código, operador (ou "Vaga vazia"), bolinha e texto da situação.
   - Baia desativada aparece como "Baia desativada", sem clique.
5. **Painel do lugar** (ao clicar numa baia, supervisor ou backup): código; nome do operador (no SUP, o nome do
   supervisor da mesa); botão **Esvaziar baia**; 4 botões de situação; se RESTRINGIDO, duração (número +
   horas/dias); data da última mudança. Salva na hora.
6. **Celulares corporativos:** um cartão por cor com Messenger e Business; clicar abre o mesmo seletor de
   situação.
7. **Configurar salas e mesas** (seção recolhível): adicionar/renomear/remover sala; adicionar/editar/remover mesa
   (nome, sigla, supervisor, baias de cada lado, centro, onde começa a baia 1); clicar numa baia da prévia
   desativa/reativa. Reduzir o número de baias pede confirmação quando a baia removida tem operador.
   Siglas repetidas não são aceitas.
8. **Botões:** Baixar planilha · Importar planilha · Exportar mapa (.json) · Importar mapa (.json).

## 4. Importar a planilha atual

Lê `.xlsx` no formato da `RELATORIO-WHATSAPP-INTUITIVO.xlsx`:

- **Sala:** cada célula "STATUS DOS WHATSAPP DO COMERCIAL N" abre a sala "Comercial N"; as equipes abaixo dela
  pertencem a essa sala.
- **Equipe:** célula "Nº EQUIPE - texto". A partir dela (linha `r`, coluna `c`):
  - linha `r+1`: cabeçalho (ignorado);
  - linhas seguintes até a linha que começa com "SUPERVISOR": colunas `c`/`c+1` = lado **esquerdo**
    (operador/situação), `c+2`/`c+3` = lado **direito**. A quantidade de linhas define `esq` e `dir`;
  - linha "SUPERVISOR": situação do SUP em `c+1`; se `c+2` for "BACKUP", `centro = SUPSUB` e situação do SUB em
    `c+3`; senão `centro = SUP`.
- **Nome, sigla e supervisor a partir do texto do título:**
  - texto entre parênteses vira parte do nome, em minúsculas ("7º Equipe (segunda espinha ao chegar no
    comercial)"); a palavra "VAZIA" no fim é descartada; o que sobra é o supervisor (vazio se não sobrar nada);
  - se o texto for "DIGITAL": nome "Digital", sigla `DG`, supervisor vazio;
  - senão: nome "Nº Equipe", sigla `OPN`;
  - sigla repetida ganha sufixo de letra (`OP6B`).
- **Operador:** "VAZIO" ou célula vazia = vaga vazia. Espaços nas pontas são removidos.
- **Situação:** OK; BANIDO; NÃO TEM / NAO TEM; RESTRINGIDO (com ou sem "ATÉ dd/mm hh:mm", formato da planilha que
  o próprio BenHermes gera). Texto diferente vira NÃO TEM e entra na lista de avisos da importação.
- **Celulares:** bloco "WHATSAPP DOS CELULARES CORPORATIVOS": cada linha até a primeira vazia = um celular
  (cor em `c`, Messenger em `c+1`, Business em `c+3`). Cores conhecidas: VERDE `#00B050`, AZUL `#00B0F0`,
  VERMELHO `#FF0000`, CIANO `#2BF8FD`, PRETO `#000000`, ROXO `#7030A0`; outra cor = cinza.
- **Prévia antes de substituir:** "Comercial 1: 6 equipes · Comercial 2: 2 equipes · 6 celulares · N avisos",
  com botões Substituir mapa / Cancelar.
- **Erro:** sem nenhuma "EQUIPE" encontrada → mensagem e nada é alterado.
- `mudouEm` dos lugares importados = momento da importação.

## 5. Planilha de resumo (Baixar planilha)

Gerada com exceljs (já usado no BenHermes), no visual da atual:

- Fundo azul-escuro `#002060` em volta; colunas E–H (equipe da esquerda) e K–N (equipe da direita), I–J de
  respiro; larguras como a original (E 61, F 22,6, G 58,3, H 18,7, K 56,3, L 18,7, M 51,3, N 31,7).
- Por sala: título mesclado E:N, fundo amarelo `#FFFF00`, Calibri 36 negrito:
  "STATUS DOS WHATSAPP DO COMERCIAL 1 — 27/10/2026 14:30".
- Por mesa (duas por linha, na ordem da sala): faixa mesclada de 4 colunas, amarela, Arial 20 negrito
  ("1º EQUIPE - Nome do supervisor"); cabeçalho OPERADOR / WHATSAPP / OPERADOR / WHATSAPP em verde `#00B050`
  Arial 16 negrito; uma linha por posição (`max(esq, dir)` linhas), operador em azul `#0070C0` Arial 12 negrito
  (vaga vazia: "VAZIO" em `#FFD966`; desativada: "DESATIVADA" em cinza); linha SUPERVISOR / BACKUP em verde
  Arial 14 quando houver.
- Situações (Calibri 14): OK `#70AD47`, BANIDO `#FF0000`, RESTRINGIDO `#BF8F00` com "RESTRINGIDO ATÉ dd/mm hh:mm",
  NÃO TEM `#808080`. *(Na original, NÃO TEM aparecia em verde, igual ao OK; aqui fica cinza para não confundir.)*
- Bordas grossas em volta de cada bloco, finas por dentro; texto centralizado.
- Bloco final "WHATSAPP DOS CELULARES CORPORATIVOS" (CELULAR / MESSENGER / CELULAR / BUSINESS), cada cor escrita
  na sua cor.
- Nome do arquivo: `relatorio_whatsapp_AAAA-MM-DD.xlsx`.

## 6. Exportar / importar mapa (.json)

- Exporta `MapaWhatsapp` + `{ tipo: "benhermes-whatsapp-baias", exportadoEm }`, arquivo
  `mapa_whatsapp_AAAA-MM-DD.json`.
- Importa só se `tipo` e `versao` baterem e a estrutura for válida; senão mensagem e nada muda. Confirmação antes
  de substituir.

## 7. Organização do código

| Arquivo | Responsabilidade |
|---|---|
| `src/types/whatsapp.ts` | Tipos da seção 2 |
| `src/utils/mapaMesas.ts` | Só o mapa (sem WhatsApp): posições de uma mesa na ordem de exibição, código de cada lugar, ajuste de `lugares` quando muda `esq`/`dir`/`centro`. Reaproveitável pelo site de chamados |
| `src/utils/whatsappBaias.ts` | Regras: mapa inicial, mudar situação (com `mudouEm`), restrição (`restritoAte`, vencida, tempo restante), resumo por sala, exportar/importar `.json` |
| `src/utils/whatsappPlanilha.ts` | Importar a planilha atual (seção 4) e gerar a planilha de resumo (seção 5) |
| `src/hooks/useWhatsappBaias.ts` | Estado + `localStorage` |
| `src/components/whatsapp/WhatsappHub.tsx` | Página: cabeçalho, resumo, filtro, salas, botões |
| `src/components/whatsapp/MapaMesa.tsx` | Desenho de uma mesa |
| `src/components/whatsapp/PainelLugar.tsx` | Edição de um lugar |
| `src/components/whatsapp/CelularesCorporativos.tsx` | Cartões dos celulares |
| `src/components/whatsapp/ConfigurarMesas.tsx` | Salas e mesas |
| `src/styles/whatsapp.css` | Estilos (tokens do tema claro/escuro já existentes) |
| `navigationItems.tsx`, `App.tsx` | Item "WhatsApp das Baias" (selo Novo) e rota |

## 8. Testes (vitest, escritos antes do código)

- `mapaMesas`: ordem e códigos (esquerda, direita, SUP, SUB; início pelo supervisor e pela porta); desativadas;
  aumentar/diminuir baias preserva os lugares que continuam.
- `whatsappBaias`: mudar situação grava `mudouEm`; restrição em horas e dias; vencida; tempo restante; resumo por
  sala (vagas vazias não contam desativadas); exportar → importar dá o mesmo mapa; `.json` inválido é recusado.
- `whatsappPlanilha`: planilha montada no teste no formato da atual, **com nomes fictícios** (2 salas, equipe com e
  sem BACKUP, "Digital", título com parênteses e "VAZIA", VAZIO, NÃO TEM, situação desconhecida, celulares);
  planilha gerada lida de volta: títulos, cores de cada situação, "RESTRINGIDO ATÉ", e reimportação dá o mesmo
  mapa.
- No navegador (Playwright, dados fictícios): importar, editar baia/supervisor, restringir, filtrar, baixar planilha;
  prints de cada tela em tema claro e escuro.

A planilha real **não entra no repositório** (o repositório não guarda dados da empresa).

## 9. Fora do escopo

Supervisores atualizando; login/perfis; servidor ou banco compartilhado; integração com o site de chamados;
histórico de banimentos além de `mudouEm`; notificações.

## 10. README

Nova seção "WhatsApp das Baias" (no estilo das demais, com `<details>` para regras de importação e da planilha) e
item no sumário e na tabela de ferramentas.
