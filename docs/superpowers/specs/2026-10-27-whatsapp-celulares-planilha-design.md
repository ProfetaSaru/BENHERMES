# WhatsApp das Baias v2 — celulares, ciclo do banimento e planilha nova

**Data:** 27/10/2026
**Status:** aguardando revisão
**Base:** `2026-10-27-whatsapp-baias-design.md` (v1, já implementado na branch `feat/whatsapp-baias`). Este documento
descreve só o que muda; o resto da v1 continua valendo.

## 1. Objetivo

1. **Celulares corporativos de verdade:** cada equipe usa um ou mais celulares, cada celular tem vários WhatsApps
   (vagas) conforme a marca, e cada vaga é de um operador (ligada a uma baia) ou de backup.
2. **Ciclo do banimento:** banido → análise pedida → liberado ou permanente, com alertas para não perder o prazo de
   pedir análise.
3. **Planilha nova**, minimalista, com abas Painel (cabe no celular), Mapa, Celulares e Lista, e que volta inteira
   quando importada.
4. O **mapa das baias continua sendo a tela principal**.

**Fica para depois (fora deste escopo):** gestão de chips (cadastro dos números, saquinhos por equipe, trocas) —
próximo projeto, com desenho próprio; avisar supervisores (precisa de lugar compartilhado: site de chamados/BenHub).

## 2. Modelo de dados (muda em relação à v1)

```ts
type Situacao = 'OK' | 'BANIDO' | 'ANALISE' | 'PERMANENTE' | 'RESTRINGIDO' | 'NAO_TEM';

interface EstadoWhatsapp {
  situacao: Situacao;
  restritoAte?: string;       // ISO; só RESTRINGIDO
  analisePedidaEm?: string;   // ISO; só ANALISE
  mudouEm: string;            // ISO
}

type WhatsappDoSupervisor = 'NAO_TEM' | 'PC' | 'CELULAR';

interface Mesa {               // v1 + um campo
  /* ...campos da v1... */
  whatsappSupervisor: WhatsappDoSupervisor; // padrão 'PC'
}

type Marca = 'SAMSUNG' | 'MOTOROLA' | 'XIAOMI' | 'IPHONE' | 'OUTRO';

interface VagaWhatsapp {
  id: string;
  grupo: string;              // "Proprietário", "Usuário 2", "Padrão", "Pasta segura", "Clonado"
  app: 'MESSENGER' | 'BUSINESS';
  rotulo: string;             // "Messenger 1", "Messenger clonado 2", "Business", "Business clonado"
  baia: string | null;        // posição na mesa do celular (E1..D8); null = backup
  whatsapp: EstadoWhatsapp;   // usado só quando é backup
  numero: string;             // número do chip, texto livre ('' = não informado); base para a gestão de chips
}

interface Celular {
  id: string;
  cor: string;                // cor da capinha: "Azul", "Preto"
  hex: string;                // amostra da cor
  apelido: string;            // opcional: "Maísa" (para diferenciar dois pretos)
  marca: Marca;
  usuarios: number;           // Motorola e Xiaomi: 1 a 8 (padrão 4); outras marcas: 1
  mesaId: string | null;      // equipe; null = guardado
  compartilhado: boolean;     // true = todas as vagas são backup (Digital)
  nomeBackup: string;         // "Benconsig Comercial" | "Digital Benconsig" (editável)
  vagas: VagaWhatsapp[];
}

interface MapaWhatsapp {
  versao: 2;
  salas: Sala[];
  celulares: Celular[];       // substitui os CelularCorporativo da v1
  atualizadoEm: string;
}
```

- **Fonte única da situação:** a vaga de operador **não** tem situação própria; ela mostra e altera a situação da
  baia ligada (`lugar.whatsapp`). Vaga de backup usa `vaga.whatsapp`.
- **Uma baia, no máximo uma vaga:** ligar uma baia que já está em outra vaga desliga a outra (que vira backup) e
  avisa.
- **Backup do supervisor (posição `SUB`) deixa de ser usado:** a tela oferece centro "Supervisor" ou "Ninguém"; o tipo
  `Centro` continua aceitando `SUPSUB` (compatibilidade com o site de chamados).
- **Supervisor:** com `whatsappSupervisor = 'NAO_TEM'`, o lugar `SUP` aparece "Sem WhatsApp" e fica fora das
  contagens e dos alertas.
- **Versão 1 salva** (navegador ou `.json`) é migrada: mantém salas, mesas e lugares; remove `SUB` (centro vira `SUP`);
  `whatsappSupervisor` = `NAO_TEM` se o SUP estava NÃO TEM, senão `PC`; descarta os celulares antigos;
  `versao` = 2.

### Vagas por marca

| Marca | Grupos e vagas (nesta ordem) | Total |
|---|---|---|
| Samsung | Padrão: Business, Messenger 1, Messenger 2 · Pasta segura: Business, Messenger 1, Messenger 2 · Clonado: Messenger 1, Messenger 2 | 8 |
| Motorola | Proprietário: Business, Business clonado, Messenger 1, Messenger 2, Messenger clonado 1, Messenger clonado 2 · Usuário 2..N: Business, Messenger 1, Messenger 2 | 6 + 3·(N−1) → 15 com N = 4 |
| Xiaomi | Proprietário e Usuário 2..N: Business, Messenger 1, Messenger 2 | 3·N → 12 com N = 4 |
| iPhone | Padrão: Business, Messenger 1, Messenger 2 | 3 |
| Outro | começa vazio; vagas adicionadas à mão (grupo, app, rótulo) | — |

- Mudar o número de usuários recria as vagas pela tabela **mantendo** as que continuam (mesmo grupo + rótulo); as que
  somem pedem confirmação se estiverem ligadas a baia ou forem backup com situação diferente de OK.
- **Ligação automática** (ao criar o celular numa equipe ou ao mudar de equipe, se não for compartilhado): vagas de
  **Messenger**, na ordem da tabela, vão para o **lado esquerdo** (E1, E2…, até `esq`); vagas de **Business**, na
  ordem, para o **lado direito** (D1…, até `dir`); baias já ligadas a outro celular da mesma equipe são puladas; o
  resto vira backup. Tudo pode ser trocado depois, vaga por vaga.
- **Mudar de equipe** pede confirmação e refaz a ligação automática na equipe nova (as ligações antigas somem).
- **Compartilhado** (Digital): nenhuma vaga é ligada; todas são backup com `nomeBackup`. Celular criado numa mesa de
  nome "Digital" já nasce compartilhado, com `nomeBackup` "Digital Benconsig".
- **Nome exibido de cada vaga:** operador da baia ligada (ou "Vaga vazia") / `nomeBackup` quando backup.

## 3. Ciclo do banimento

| Situação | Rótulo | Quando | Alerta |
|---|---|---|---|
| `BANIDO` | **Banido — pedir análise** | o número caiu e ninguém pediu análise | **Pedir análise agora** (mostra há quanto tempo caiu) |
| `ANALISE` | **Em análise** | análise pedida em `analisePedidaEm` | depois de **24 h**: "Análise pedida há mais de 1 dia — conferir" |
| `PERMANENTE` | **Perdido (permanente)** | o número não volta | "Trocar o chip" |
| `RESTRINGIDO` | Restringido até … | (v1) | vencida: "Restrição terminou — conferir" (v1) |

- **No painel do lugar/vaga:** os 6 botões de situação continuam; além deles, ações do ciclo:
  - em BANIDO: botão principal **"Pedi a análise"** → ANALISE com `analisePedidaEm` = agora;
  - em ANALISE: **"Liberado"** → OK e **"Permanente"** → PERMANENTE;
  - mostra "Banido há 3 h", "Análise pedida há 26 h".
- **Lista de alertas** (`alertas(mapa, agora)`), em ordem de prioridade: pedir análise (mais antigo primeiro) →
  análise > 24 h → restrição vencida → permanente → restringido (até) → não tem. Cada alerta: onde (código da baia ou
  "Celular · grupo · rótulo"), quem (operador ou nome do backup), situação, desde/até.
- **Importação da planilha antiga:** "BANIDO" vira `BANIDO`.

## 4. Tela (o que muda)

1. **Resumo e alertas:** contagens por situação de **todos os WhatsApps** (baias ativas, supervisores com WhatsApp e
   vagas de backup), vagas vazias e celulares; abaixo, o bloco **Atenção** com a lista de alertas (clicável: abre o
   painel do item).
2. **Mapa:** igual à v1, mais:
   - cada baia ganha a linha "📱 Azul · Usuário 2 · Messenger 1" (ou "sem celular");
   - supervisor mostra "No PC" / "No celular" com a situação, ou "Sem WhatsApp" em cinza;
   - cores novas para ANALISE e PERMANENTE (seção 6).
3. **Painel do lugar:** mostra onde está o WhatsApp; no SUP, seletor Não tem / No PC / No celular; ações do ciclo.
4. **Celulares:** um cartão por celular (amostra da cor, cor + apelido, marca, equipe, contagem OK / problemas /
   backups); ao abrir, as vagas agrupadas, com dono e situação; clicar numa vaga abre o painel (vaga de operador →
   mesmo painel da baia).
5. **Configurar:** além de salas e mesas, **celulares**: adicionar (cor, hex, apelido, marca, usuários, equipe,
   compartilhado, nome do backup), editar, mudar de equipe, remover (confirmação), e em cada vaga: seletor
   **Baia (E1…D8 da equipe) / Backup**, campo **número do chip**; na marca Outro, adicionar/remover vaga.
6. **Importar planilha antiga:** igual à v1, mas ignora o BACKUP e o bloco de celulares (aviso na prévia: "Os
   celulares não são importados da planilha antiga; cadastre-os em Configurar").

## 5. Planilha (Baixar planilha) — substitui a seção 5 da v1

Estilo minimalista: fundo branco sem linhas de grade, títulos em azul `#0B3A82` com um traço amarelo `#F5B800`
curto, texto `#1B2230`, secundários `#6B7280`, linhas finas `#E5E9F0`; cor só na bolinha/texto da situação e numa
borda esquerda média de cada baia; fundo claro só em banido, em análise, permanente e restringido. Fonte Calibri.
Arquivo `whatsapp_baias_AAAA-MM-DD.xlsx`.

| Aba | Conteúdo | Layout |
|---|---|---|
| **Painel** (primeira) | Título, data/hora; 8 números (OK, Pedir análise, Em análise, Perdidos, Restringidos, Não tem, Vagas vazias, Celulares) em 2 colunas; **Atenção** (alertas: Onde, Quem, Situação, Desde/Até); **Equipes** (Equipe · supervisor, OK, Problemas, Saúde % com barra de dados) | estreita (≈ 4 colunas, cabe na tela do celular), retrato |
| **Mapa** | Uma seção por sala: título "Mapa · Comercial 1", resumo em uma linha, legenda; mesas 2 por linha; supervisor no topo; cada baia em 3 linhas (código + situação à direita / operador / 📱 local) com borda esquerda na cor da situação; corredor estreito cinza | paisagem, ajustada à largura |
| **Celulares** | Resumo (celulares, WhatsApps, de operadores, backups); um bloco por celular, 3 por linha: amostra da cor, nome, "marca · equipe · N"; vagas agrupadas: rótulo, dono, ● situação | paisagem |
| **Lista** | Tabela do Excel com filtro e linhas listradas: Tipo (Baia, Supervisor, Backup), Sala, Equipe, Onde, Nome, Celular · vaga, Situação, Desde/Até, Número do chip | — |
| **dados** (oculta) | JSON do mapa (`exportarMapa`) em pedaços de até 30 000 caracteres na coluna A | oculta |

- Cores das situações (texto; fundo claro entre parênteses): OK `#1F7A4D`; BANIDO `#B42318` (`#FEF3F2`);
  EM ANÁLISE `#C2410C` (`#FFF7ED`); PERDIDO `#111827` (`#F3F4F6`); RESTRINGIDO `#9A6700` (`#FFFBEB`);
  NÃO TEM `#6B7280`; vaga vazia: borda tracejada.
- **Importar planilha:** se o arquivo tiver a aba `dados`, o mapa vem dela (exato, via `importarMapa`); senão, a
  leitura da planilha antiga (v1, seção 4).

## 6. Cores na tela

Novos tokens no `whatsapp.css` (claro/escuro) para ANALISE (laranja) e PERMANENTE (escuro), seguindo as cores da
seção 5; legenda e resumo passam a ter as 6 situações.

## 7. Organização do código

| Arquivo | Muda |
|---|---|
| `src/types/whatsapp.ts` | tipos da seção 2 |
| `src/utils/celulares.ts` (novo) | vagas por marca, ligação automática, ligar/desligar baia, mudar equipe/usuários, nome exibido, contagens do celular |
| `src/utils/whatsappBaias.ts` | situações e ciclo (pedir análise, liberado, permanente), `alertas`, resumo de todos os WhatsApps, migração v1 → v2, validação v2 |
| `src/utils/whatsappPlanilha.ts` | importação: aba `dados`, ignora BACKUP/celulares |
| `src/utils/whatsappResumo.ts` (novo) | geração da planilha da seção 5 (substitui `gerarPlanilhaWhatsapp` da v1) |
| `src/components/whatsapp/` | `PainelLugar` (ciclo, supervisor, onde está), `MapaMesa` (linha do celular), `Celulares.tsx` (substitui `CelularesCorporativos`), `ConfigurarCelulares.tsx` (novo), `Alertas.tsx` (novo), `WhatsappHub` |

## 8. Testes (escritos antes do código; nomes fictícios)

- `celulares`: total de vagas por marca (8, 15, 12, 3) e com 2 e 6 usuários; ligação automática (Messenger →
  esquerda, Business → direita, resto backup; pula baias já ligadas); compartilhado; uma baia em uma vaga só; mudar
  usuários mantém vagas e informa as que somem; mudar de equipe.
- `whatsappBaias`: ciclo (pedir análise grava a hora; liberado → OK; permanente); alertas na ordem e o de 24 h;
  supervisor sem WhatsApp fora das contagens; resumo com backups; migração v1 → v2; `.json` v2 ida e volta.
- `whatsappPlanilha`: aba `dados` volta exata; planilha antiga ignora BACKUP e celulares.
- `whatsappResumo`: abas na ordem, aba `dados` oculta, números do Painel = resumo, alertas, cores de cada situação,
  tabela com filtro na Lista, ida e volta.
- Navegador (claro e escuro): cadastrar Motorola numa equipe e ver a ligação automática; Samsung compartilhado;
  banido → pedi a análise → liberado; alerta de 24 h; baixar a planilha; prints, inclusive da planilha renderizada
  (computador e largura de celular).

## 9. README

Atualizar a seção "WhatsApp das Baias": celulares e vagas por marca, ciclo do banimento e alertas, planilha nova.
