# Escala: reserva e lote acabou — plano

**Spec:** docs/superpowers/specs/2026-11-24-escala-reserva-design.md

### Task 1: rodízio com reserva e bases sem lote (`src/utils/escalaBases.ts`, `src/types/escala.ts`)
- `EscalaCadastro.semLote?: string[]`; constantes `RESERVA = 'RESERVA'`, `SEM_LOTE = 'SEM LOTE'`.
- `pontoDePartida`: mantém `RESERVA` como posição da roda; repetição só entre pessoas.
- `rodizio(bases, pessoas, historico, data, ausentes, semLote)`: roda completada com `RESERVA` até o nº de bases;
  pessoa em base sem lote vai para a primeira reserva livre (a base vira `SEM LOTE`); sem reserva: aviso.
- `realizarSorteio`: passa `cadastro.semLote`; aviso de reserva no lugar de "alguém fica com mais de uma base".
- `textoDaEscala` e planilha: lista sem reserva/sem lote + linhas "Reserva:" e "Sem lote:".
- Testes: 5 bases/4 equipes → 5 dias úteis sem repetir; reserva muda todo dia; lote acabou leva a equipe à
  reserva; sem reserva → aviso; dia com sem lote não é ponto de partida; texto.

### Task 2: tela e hook
- Hook: `marcarSemLote(base, sim)` grava `cadastro.semLote`; leitura tolerante (campo ausente = []).
- Tela: botões **Lote acabou** / **Lote novo** por base; refaz a escala do dia ao marcar; reserva destacada.
- Navegador com dados fictícios; prints.

### Task 3: README (seção Escala) e PR.
