# Escala de Bases: quinta base, reserva do dia e "lote acabou" — desenho (curto)

**Por quê:** com 4 bases e 4 equipes a roda fecha em 4 dias e a equipe repete a base na mesma semana. Uma 5ª
base faz cada equipe passar por 5 bases diferentes em 5 dias úteis seguidos; a base que sobra no dia vira a
**reserva**, para onde vai a equipe cujo lote acabou.

**Objetivos**
- Mais bases que equipes: a(s) base(s) que sobram ficam como **RESERVA** (antes: viravam base a mais de alguém).
  A roda tem tantas posições quanto bases; a reserva muda todo dia.
- Botão **Lote acabou** em cada base da escala do dia: a base fica marcada "sem lote" no cadastro e a equipe
  dela vai para a reserva do dia (escala refeita na hora). **Lote novo** desmarca.
- Base sem lote nos dias seguintes: quem cair nela vai para a reserva; sem reserva livre, aviso "sem reserva,
  peça lote novo" e a equipe fica sem base.
- Texto do chat e planilha: linhas "Reserva: BASE X" e "Sem lote: BASE Y".

**Não objetivos:** ler números de lote (importação/API) — marcação é manual (escolha do usuário, opção A).

**Abordagens:** A) marcação manual (escolhida); B) importar "Exportar Campanhas"; C) API do discador.

**Decisões (minhas, aprovadas):** base sem lote persiste até "Lote novo"; ausências continuam cobertas como hoje
(a reserva não cobre ausência); histórico guarda `RESERVA` e `SEM LOTE` como responsável dessas bases
(compatível com o CSV do BENZAITEN); dia com base sem lote não serve de ponto de partida do rodízio (como os dias
com ausência), então a roda continua contando os dias corretamente.
