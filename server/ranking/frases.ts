/**
 * Comentários da coluna FEEDBACK: o que vai para a IA (descrever), a conferência de cada frase e as
 * frases prontas (quando nenhuma IA responde, ou para trocar uma frase recusada).
 * Sem imports: usado pelo servidor (node --experimental-strip-types) e pelo navegador.
 */

/** O que a IA recebe de cada pessoa: nada de CPF, sobrenome ou R$ */
export interface Descricao {
  nome: string;
  posicao: string;
  projetando: number;
  situacao: string;
  esteira: string;
  vendeu_cartao_ou_margem: boolean;
}

export type TipoDeRanking = 'vendedor' | 'supervisor';

interface LinhaParaDescrever {
  nome: string;
  posicao: string;
  projetando: number;
  portabilidade: number;
  andamento: number;
  margemCartao: number;
}

const primeiroNome = (nome: string): string => {
  const palavra = nome.split('   ')[0].trim().split(/\s+/)[0] ?? '';
  const minusculo = palavra.toLocaleLowerCase('pt-BR');
  return minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1);
};

export const descrever = (linhas: LinhaParaDescrever[]): Descricao[] =>
  linhas.map((l) => ({
    nome: primeiroNome(l.nome),
    posicao: `${l.posicao} de ${linhas.length}`,
    projetando: Math.round(l.projetando * 100) / 100,
    situacao:
      l.projetando >= 1 ? 'batendo a meta' : l.projetando >= 0.7 ? 'perto da meta' : l.portabilidade === 0 ? 'sem nenhum contrato pago' : 'abaixo da meta',
    esteira: l.andamento >= 50000 ? 'esteira em andamento cheia' : l.andamento > 0 ? 'pouca coisa em andamento' : 'esteira vazia',
    vendeu_cartao_ou_margem: l.margemCartao > 0,
  }));

/** Sem números, posições, porcentagens ou valores; não vazia; até 18 palavras */
export const fraseValida = (f: string): boolean => {
  const t = (f ?? '').trim();
  return t !== '' && !/\d|º|ª|%|R\$/.test(t) && t.split(/\s+/).length <= 18;
};

// ---------------------------------------------------------------------------
// Frases prontas: Belfort para quem está no topo, Maquiavel cada vez mais duro para quem está atrás.
// Em cada faixa, das mais leves para as mais duras. "{n}" é o primeiro nome.
// ---------------------------------------------------------------------------

type Faixa = 'topo' | 'perto' | 'abaixo' | 'zerado';

const VENDEDOR: Record<Faixa, string[]> = {
  topo: [
    '{n}, você está no topo; agora é defender o posto, porque alguém já está mirando o seu lugar.',
    '{n}, ritmo de campeão: quem chegou aqui sabe que o topo cobra todo dia.',
    '{n}, excelente trabalho; não tire o pé, a liderança se perde num piscar de olhos.',
    '{n}, meta batida é o começo; os grandes vendedores transformam bom em lendário.',
    '{n}, você está escrevendo a história do mês; continue ligando como se nada estivesse garantido.',
    '{n}, o topo é seu hoje; amanhã ele pertence a quem quiser mais.',
    '{n}, energia de vencedor; mantenha a esteira girando e o ranking vai continuar com seu nome.',
    '{n}, você provou que dá; agora prove que consegue repetir.',
    '{n}, posição de destaque merece foco total; cada cliente atendido é mais um degrau.',
    '{n}, siga acelerando: quem está no alto não pode se dar ao luxo de relaxar.',
  ],
  perto: [
    '{n}, a meta está ao alcance da mão; falta só aquele gás final.',
    '{n}, bom caminho; mais algumas portabilidades e você entra de vez na zona de premiação.',
    '{n}, você está quase lá; não deixe a reta final escapar por descuido.',
    '{n}, ritmo bom, mas bom não paga bônus; acelere a esteira.',
    '{n}, a diferença entre quase e conseguiu está nas ligações de hoje.',
    '{n}, você já mostrou que sabe vender; agora mostre que sabe fechar.',
    '{n}, perto da meta não é na meta; vá buscar o que falta.',
    '{n}, o bônus está olhando para você; dê a ele um motivo para chegar.',
    '{n}, mantenha a pressão: quem para perto da linha de chegada assiste os outros cruzarem.',
    '{n}, falta pouco, e pouco é exatamente o que separa os lembrados dos esquecidos.',
  ],
  abaixo: [
    '{n}, o ranking não perdoa a calma; é hora de transformar intenção em contrato.',
    '{n}, quem espera a sorte chegar costuma receber só a conta do esquecimento.',
    '{n}, a fortuna favorece os ousados; até agora ela não tem motivos para olhar para você.',
    '{n}, os outros já entenderam o jogo; falta você decidir se vai jogar.',
    '{n}, desculpas não entram na esteira; contratos, sim.',
    '{n}, um príncipe prudente prepara a vitória; você ainda está preparando a desculpa?',
    '{n}, a meio da tabela ninguém lembra de ninguém; suba ou se acostume com o anonimato.',
    '{n}, o tempo corre contra quem hesita, e você tem hesitado demais.',
    '{n}, ser comum é confortável; pena que o conforto não paga bônus.',
    '{n}, o fim da tabela está mais perto do que o topo; escolha logo a direção.',
  ],
  zerado: [
    '{n}, a esteira está esperando por você; o primeiro contrato muda tudo.',
    '{n}, enquanto os outros fecham negócios, você fecha os olhos para o ranking.',
    '{n}, nem o mais paciente dos príncipes esperaria tanto por um resultado.',
    '{n}, o silêncio na sua coluna diz mais que qualquer discurso.',
    '{n}, quem não aparece no placar vira plateia do sucesso alheio.',
    '{n}, a ambição sem ação é só um sonho barato; acorde e vá vender.',
    '{n}, seu nome está no ranking, mas sua venda ainda não chegou nele.',
    '{n}, os homens esquecem rapidamente quem nada entrega; não seja esquecido.',
    '{n}, o fundo da tabela é um lugar frio; saia dele com contratos, não com promessas.',
    '{n}, cada dia sem venda é um presente para quem está na sua frente.',
  ],
};

const SUPERVISOR: Record<Faixa, string[]> = {
  topo: [
    '{n}, sua equipe está no topo; agora o desafio é manter todos famintos.',
    '{n}, time de campeões; defenda essa liderança como se fosse a última.',
    '{n}, a equipe respondeu ao seu comando; não deixe o ritmo cair.',
    '{n}, liderar é repetir o resultado; mantenha o time acelerado.',
    '{n}, sua equipe virou referência; referências são cobradas todos os dias.',
    '{n}, excelente gestão; o time que vence hoje precisa querer mais amanhã.',
    '{n}, o topo é do seu time; os outros já estão estudando como tirá-lo de lá.',
    '{n}, equipe afinada; transforme esse embalo em recorde.',
  ],
  perto: [
    '{n}, sua equipe está perto da meta; falta o empurrão do líder.',
    '{n}, time no caminho certo; cobre a reta final de cada um.',
    '{n}, a meta da equipe está ao alcance; não aceite o quase.',
    '{n}, bom trabalho do time, mas a premiação exige mais pressão.',
    '{n}, sua equipe precisa de um último sprint; puxe a fila.',
    '{n}, perto não é suficiente para um líder; leve o time até a linha.',
    '{n}, o time está aquecido; agora é converter a esteira em resultado.',
    '{n}, mais um passo e sua equipe entra na zona de bônus.',
  ],
  abaixo: [
    '{n}, sua equipe está devendo; o líder é medido pelo resultado do time.',
    '{n}, um líder que aceita a média ensina o time a ser comum.',
    '{n}, os outros times aceleram enquanto o seu observa; mude o jogo.',
    '{n}, é melhor ser temido pelo ranking do que ignorado por ele; mexa na equipe.',
    '{n}, sua equipe precisa de direção, não de desculpas.',
    '{n}, o time segue o exemplo do líder; que exemplo está sendo dado?',
    '{n}, resultados fracos não se explicam, se corrigem; comece hoje.',
    '{n}, a fortuna não sorri para equipes acomodadas.',
  ],
  zerado: [
    '{n}, sua equipe ainda não pontuou; o líder precisa acender o primeiro fósforo.',
    '{n}, um time parado é o retrato de uma liderança distraída.',
    '{n}, enquanto os outros times vendem, o seu espera um milagre.',
    '{n}, sem contrato pago, sua equipe é só plateia do ranking.',
    '{n}, governar um time vazio de resultados não é liderar, é assistir.',
    '{n}, a esteira da sua equipe está gelada; aqueça-a hoje.',
    '{n}, um príncipe sem conquistas logo perde o reino; mova seu time.',
    '{n}, seu time precisa ver ação do líder antes que o mês acabe.',
  ],
};

const RESERVA: Record<Faixa, Faixa[]> = {
  topo: ['topo', 'perto', 'abaixo', 'zerado'],
  perto: ['perto', 'topo', 'abaixo', 'zerado'],
  abaixo: ['abaixo', 'zerado', 'perto', 'topo'],
  zerado: ['zerado', 'abaixo', 'perto', 'topo'],
};

const faixaDe = (d: Descricao): Faixa =>
  d.situacao === 'batendo a meta' ? 'topo' : d.situacao === 'perto da meta' ? 'perto' : d.situacao === 'sem nenhum contrato pago' ? 'zerado' : 'abaixo';

/**
 * Frase pronta começando pelo primeiro nome. Dentro da faixa, quanto mais para baixo na tabela, mais
 * dura; não repete nenhuma frase já em `usadas` (o conjunto é atualizado).
 */
export const frasePronta = (d: Descricao, indice: number, total: number, usadas: Set<string>, tipo: TipoDeRanking = 'vendedor'): string => {
  const banco = tipo === 'supervisor' ? SUPERVISOR : VENDEDOR;
  const faixa = faixaDe(d);
  const relativo = total > 1 ? indice / (total - 1) : 0;
  for (const f of RESERVA[faixa]) {
    const lista = banco[f];
    const inicio = f === faixa ? Math.min(lista.length - 1, Math.floor(relativo * lista.length)) : 0;
    for (let k = 0; k < lista.length; k++) {
      const modelo = lista[(inicio + k) % lista.length];
      if (!usadas.has(modelo)) {
        usadas.add(modelo);
        return modelo.replace('{n}', d.nome);
      }
    }
  }
  // Todas já usadas (ranking muito grande): repete em rodízio, a partir da faixa da pessoa
  const todas = RESERVA[faixa].flatMap((f) => banco[f]);
  const modelo = todas[(usadas.size - todas.length) % todas.length];
  usadas.add(`${modelo}#${usadas.size}`);
  return modelo.replace('{n}', d.nome);
};

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

/** A frase é desta pessoa: começa pelo primeiro nome dela (sem diferenciar maiúsculas e acentos) */
const comecaPeloNome = (frase: string, nome: string): boolean => {
  const primeira = frase.trim().split(/[\s,;:.!?]+/)[0] ?? '';
  return semAcento(primeira) === semAcento(nome);
};

/**
 * Mantém as frases válidas, diferentes entre si e que começam pelo nome da pessoa certa; troca as outras
 * (e as que faltam) por prontas
 */
export const conferirFrases = (
  descricoes: Descricao[],
  frases: string[],
  tipo: TipoDeRanking = 'vendedor'
): { frases: string[]; trocadas: number } => {
  const vistas = new Set<string>();
  const usadas = new Set<string>();
  let trocadas = 0;
  const saida = descricoes.map((d, i) => {
    const f = (frases[i] ?? '').replace(/\s+/g, ' ').trim();
    const chave = f.toLocaleLowerCase('pt-BR');
    if (fraseValida(f) && !vistas.has(chave) && comecaPeloNome(f, d.nome)) {
      vistas.add(chave);
      return f;
    }
    trocadas++;
    const pronta = frasePronta(d, i, descricoes.length, usadas, tipo);
    vistas.add(pronta.toLocaleLowerCase('pt-BR'));
    return pronta;
  });
  return { frases: saida, trocadas };
};
