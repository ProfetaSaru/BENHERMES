/**
 * Legenda do dia para mandar junto com o ranking (modelo que a equipe usava no BenHub), sem IA.
 * Quatro parágrafos: abertura, ranking/elegibilidade/projeções, chamada e fechamento. Cada parágrafo tem
 * variações; a variação inicial vem da data (mesma data → mesmo texto) e "Outra versão" avança.
 * Sem nomes e sem números.
 */

export type TipoDoDia = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'fechamento' | 'balanco';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const data = (dia: string) => new Date(`${dia}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const diaUtil = (d: Date, feriados: Set<string>) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5 && !feriados.has(iso(d));

/** Algum dia útil no mesmo mês, andando a partir de `dia` (exclusive) no sentido `passo` */
const temDiaUtil = (dia: string, passo: 1 | -1, feriados: Set<string>): boolean => {
  const d = data(dia);
  const mes = d.getUTCMonth();
  for (d.setUTCDate(d.getUTCDate() + passo); d.getUTCMonth() === mes; d.setUTCDate(d.getUTCDate() + passo)) {
    if (diaUtil(d, feriados)) return true;
  }
  return false;
};

export const tipoDoDia = (dia: string, feriados: string[]): TipoDoDia => {
  const f = new Set(feriados);
  if (!temDiaUtil(dia, -1, f)) return 'balanco';
  if (!temDiaUtil(dia, 1, f)) return 'fechamento';
  // Fim de semana (ranking gerado fora do expediente): sábado conta como sexta, domingo como segunda
  const semana = data(dia).getUTCDay();
  return (['segunda', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sexta'] as const)[semana];
};

// ---------------------------------------------------------------------------
// Textos (do modelo do BenHub)
// ---------------------------------------------------------------------------

interface DiaDaSemana {
  nome: string;
  aberturas: string[];
  gas: string;
  disputa: string;
  destino: string;
  despedida: string;
}

const SEMANA: Record<Exclude<TipoDoDia, 'fechamento' | 'balanco'>, DiaDaSemana> = {
  segunda: {
    nome: 'segunda-feira',
    aberturas: [
      'Hoje iniciamos mais uma semana estratégica e decisiva para mostrarmos do que o nosso time comercial é feito. A segunda-feira traz a oportunidade perfeita para zerar o contador, renovar o foco e ir pra cima com determinação total logo no primeiro dia. O mercado é de quem se posiciona com energia, garra e consistência em cada abordagem, transformando o início da semana no ritmo que vai ditar o nosso sucesso.',
      'Começou a semana e com ela uma nova chance de mostrar a força do nosso time comercial! A segunda-feira é o dia de alinhar o foco, organizar a esteira e sair na frente com determinação total. Quem começa a semana com energia e consistência dita o ritmo de todos os outros dias.',
      'Segunda-feira chegou e a semana começa agora, com tudo em aberto e muito a conquistar! É o momento de renovar a energia, revisar as oportunidades e partir pra cima com garra desde a primeira ligação. O ritmo que a gente imprime hoje é o ritmo que vai carregar a semana inteira.',
    ],
    gas: 'gás inicial',
    disputa: 'a disputa está aberta, mas a corrida pelos bônus exige a nossa força máxima desde já',
    destino: 'começar a semana no topo',
    despedida: ', uma excelente semana',
  },
  terca: {
    nome: 'terça-feira',
    aberturas: [
      'Chegamos na terça-feira, o dia perfeito para acelerar ainda mais o ritmo da semana e mostrar do que o nosso time comercial é feito! A terça-feira é a oportunidade ideal para consolidar as conversas iniciadas, otimizar as negociações e ir pra cima com determinação total para garantir os melhores resultados.',
      'Terça-feira é dia de pisar no acelerador! As conversas de ontem já estão na mesa e agora é hora de transformá-las em negociação de verdade. Foco, organização e determinação total para fazer a semana render desde já.',
      'Chegamos na terça-feira com a semana em pleno movimento! É o dia de dar sequência ao que começamos, retomar cada contato em aberto e ir pra cima com energia para garantir os melhores resultados.',
    ],
    gas: 'gás constante',
    disputa: 'a disputa está aberta, mas a corrida pelos bônus exige a nossa força máxima agora',
    destino: 'manter o ritmo no topo',
    despedida: '',
  },
  quarta: {
    nome: 'quarta-feira',
    aberturas: [
      'Chegamos na quarta-feira, o meio da semana e o momento exato de consolidar a nossa pegada para transformar este período em um verdadeiro case de sucesso! A quarta-feira é o divisor de águas: o dia perfeito para acelerar as negociações em andamento, ajustar as estratégias e ir pra cima com determinação total.',
      'Quarta-feira, meio da semana: o momento de olhar para o que já foi feito e decidir como vamos terminar! É o dia de acelerar as negociações em andamento, corrigir a rota onde for preciso e ir pra cima com determinação total.',
      'Chegamos ao meio da semana e a quarta-feira é o nosso divisor de águas! O que construímos até aqui precisa virar resultado, e o dia de hoje é perfeito para apertar o passo, ajustar as estratégias e partir pra cima com garra.',
    ],
    gas: 'gás de meio de semana',
    disputa: 'a disputa está aberta e a corrida pelos bônus exige a nossa força máxima agora',
    destino: 'manter o ritmo no topo',
    despedida: '',
  },
  quinta: {
    nome: 'quinta-feira',
    aberturas: [
      'Chegamos na quinta-feira, o momento exato de dar aquele sprint decisivo antes da sexta-feira e consolidar o resultado da semana! A quinta-feira é o dia perfeito para fechar propostas em andamento, ajustar os detalhes das negociações e ir pra cima com determinação total.',
      'Quinta-feira é dia de sprint! A semana está chegando na reta final e cada proposta em andamento precisa virar contrato antes da sexta. Foco nos detalhes, agilidade nas respostas e determinação total.',
      'Chegamos na quinta-feira e a linha de chegada da semana já está à vista! É hora de apertar o passo, fechar as negociações que estão na mesa e ir pra cima com tudo para consolidar o nosso resultado.',
    ],
    gas: 'gás forte',
    disputa: 'a disputa está acirrada e a corrida pelos bônus exige a nossa força máxima agora',
    destino: 'colocar a equipe no topo',
    despedida: '',
  },
  sexta: {
    nome: 'sexta-feira',
    aberturas: [
      'Chegamos na sexta-feira, o dia oficial de fechar a semana com chave de ouro e mostrar do que o nosso time comercial é feito! É o momento decisivo para acelerar, dar o gás final e ir pra cima com determinação total. Quem se posiciona com energia, garra e consistência no último dia da semana é quem garante os melhores resultados e transforma o esforço em conquista!',
      'Sexta-feira chegou e é dia de fechar a semana com chave de ouro! Tudo o que foi plantado nos últimos dias pode virar contrato hoje, então é hora de acelerar, dar o gás final e ir pra cima com determinação total.',
      'Chegamos ao último dia útil da semana e a sexta-feira é a nossa chance de terminar com tudo! Quem mantém a energia e a consistência até o fim do expediente é quem transforma o esforço da semana em conquista.',
    ],
    gas: 'gás final',
    disputa: 'a disputa está aberta, mas a corrida pelos bônus exige a nossa força máxima agora',
    destino: 'fechar a semana no topo',
    despedida: ', um excelente final de semana',
  },
};

const RANKING = [
  'Olhando fixamente para o nosso Ranking de Vendas, o cenário é claro: {disputa}. A coluna de elegibilidade mostra exatamente onde precisamos apertar o passo para colocar todo mundo na zona de premiação. As projeções e os contratos que já estão rodando no sistema provam que temos volume de sobra para virar o jogo — só precisamos dar aquele {gas} hoje para converter cada oportunidade da esteira em contrato fechado.',
  'No nosso Ranking de Vendas, o recado é direto: {disputa}. A coluna de elegibilidade aponta quem já está na zona de premiação e quem ainda precisa apertar o passo. As projeções mostram que temos volume de sobra para fazer um resultado histórico — falta aquele {gas} hoje para transformar a esteira em contrato fechado.',
  'O Ranking de Vendas de hoje deixa tudo à vista: {disputa}. A elegibilidade mostra onde cada um precisa avançar para entrar na zona de premiação, e as projeções provam que há oportunidade de sobra na esteira — é só dar aquele {gas} para convertê-la em contrato fechado.',
];

const CHAMADA = [
  'Não deixem nenhuma esteira parada e nenhum cliente sem resposta nesta {dia}. Este é o momento exato de acelerar a digitação, otimizar as portabilidades, ajustar o tom das abordagens e perseguir meta por meta até a última hora do expediente. O ranking não é apenas um quadro de números, é o reflexo direto da dedicação e do suor de cada um de vocês. A distância entre a posição atual e o topo é medida pela intensidade com que vamos trabalhar no dia de hoje.',
  'Nesta {dia}, nenhuma esteira parada e nenhum cliente sem resposta. Acelerem a digitação, revisem as portabilidades em aberto e persigam cada meta até o fim do expediente. O ranking é o retrato da dedicação de cada um de vocês, e a distância até o topo se mede pela intensidade do trabalho de hoje.',
  'Que esta {dia} não tenha esteira parada nem cliente esperando resposta. É hora de digitar rápido, otimizar cada portabilidade, ajustar a abordagem e buscar a meta até a última hora. O ranking reflete o suor de cada um de vocês, e quem trabalha com mais intensidade hoje é quem sobe amanhã.',
];

const FECHAMENTO_SEMANA = [
  'Vamos transformar esta {dia} no nosso maior case de superação e {destino}! Acreditem no potencial individual de vocês e na força dessa equipe gigante. Liguem os motores, mantenham a cabeça erguida e busquem o resultado com a atitude de quem nasceu para vencer. Bom trabalho, ótimas vendas{despedida} e vamos juntos rumo ao topo do ranking! 🏆💼',
  'Que esta {dia} seja lembrada como o dia em que fomos além, para {destino}! Confiem no talento de cada um e na força do nosso time. Motores ligados, cabeça erguida e atitude de campeão. Bom trabalho, ótimas vendas{despedida} e vamos juntos rumo ao topo do ranking! 🏆💼',
];

const FECHAMENTO_MES = {
  aberturas: [
    'Chegamos ao último dia útil de {mes}! É o momento oficial de fechamento do mês, de dar o nosso último gás, converter cada contrato pendente na esteira e transformar todo o esforço acumulado em metas batidas e bônus garantidos!',
    'Hoje é dia de fechamento: o último dia útil de {mes} chegou! Tudo o que construímos ao longo do mês se decide agora, contrato por contrato, até o sistema fechar.',
  ],
  ranking: [
    'Olhando fixamente para o nosso Ranking de Vendas, o cenário é de decisão total: a linha de chegada está logo ali e cada contrato fechado hoje define quem leva a coroa e garante o topo. A coluna de elegibilidade mostra exatamente onde precisamos apertar o passo agora para colocar todo mundo na zona de premiação antes de fechar o sistema. As projeções provam que temos volume de sobra para fechar {mes} com chave de ouro — só precisamos acelerar a digitação, otimizar as portabilidades e ir pra cima com determinação máxima!',
    'O Ranking de Vendas está em contagem regressiva: cada contrato pago hoje pode mudar quem fica com o topo do mês. A elegibilidade mostra quem ainda precisa de um empurrão para entrar na zona de premiação, e as projeções provam que dá para fechar {mes} com chave de ouro — é acelerar a digitação e ir pra cima!',
  ],
  chamada: [
    'Não deixem nenhuma esteira parada e nenhum cliente sem resposta nesta reta final. Este é o momento de dar o seu melhor, superar limites e fazer deste fechamento o nosso maior case de sucesso do mês. O ranking reflete a dedicação e o suor de cada um de vocês até aqui.',
    'Nesta reta final, nenhuma esteira parada e nenhum cliente sem resposta. Cada ligação conta, cada proposta conta, e este fechamento pode ser o melhor do ano se cada um entregar o máximo até o último minuto.',
  ],
  final: [
    'Vamos fechar {mes} no topo, garantir nossas conquistas e coroar todo o nosso trabalho com um resultado histórico! Liguem os motores, mantenham o foco total e vamos pra cima buscar a vitória! Bom trabalho, ótimas vendas e um fechamento espetacular a todos! 🏆💼',
    'Vamos encerrar {mes} com a cabeça erguida e o ranking lá em cima! Foco total até o sistema fechar e atitude de campeão. Bom trabalho, ótimas vendas e um fechamento espetacular a todos! 🏆💼',
  ],
};

const BALANCO = {
  aberturas: [
    '{Mes} passou e nós fechamos o mês com chave de ouro! Mostramos do que o nosso time comercial é capaz, entregando um resultado espetacular, batendo metas e coroando todo o esforço acumulado com muito sucesso e bônus garantidos!',
    '{Mes} passou e deixou a marca do nosso time! Foi um mês de muita dedicação, de esteira girando e de esforço que virou resultado e conquista.',
  ],
  ranking: [
    'Olhando para o nosso Ranking de Vendas final de {mes}, o cenário refletiu a nossa dedicação total: cruzamos a linha de chegada superando desafios, acelerando a digitação na esteira e convertendo cada oportunidade até o último minuto. A coluna de elegibilidade mostrou a força de quem se dedicou e buscou a premiação com garra. As projeções viraram realidade e fizemos de {mes} um verdadeiro marco na nossa história!',
    'O Ranking de Vendas final de {mes} mostrou o tamanho da nossa garra: cada portabilidade digitada e cada contrato pago contaram até o último minuto. A elegibilidade premiou quem se dedicou de verdade, e as projeções do mês se confirmaram no resultado.',
  ],
  chamada: [
    'Cada contrato fechado, cada portabilidade otimizada e cada cliente atendido com excelência provaram o valor e a força do nosso time. O ranking final coroou o suor, a energia e a consistência de cada um de vocês ao longo de todo o mês.',
    'O resultado do mês foi construído contrato a contrato, cliente a cliente. O ranking final é o reconhecimento do esforço e da consistência de cada um de vocês.',
  ],
  final: [
    'Vamos carregar essa mesma energia e ritmo vencedor para o novo mês que se inicia, prontos para dominar o topo mais uma vez! Parabéns a todos pelo excelente trabalho e por fazerem de {mes} um mês histórico! 🏆💼',
    'Agora é levar esse ritmo vencedor para o mês que começa hoje e buscar o topo de novo! Parabéns a todos pelo trabalho que fez de {mes} um mês para lembrar! 🏆💼',
  ],
};

const ABERTURA = 'Bom dia, campeões da BenConsig! 🚀 ';

const escolher = (lista: string[], semente: number, paragrafo: number) => lista[(semente + paragrafo) % lista.length];

const preencher = (texto: string, valores: Record<string, string>) => texto.replace(/\{(\w+)\}/g, (_, k: string) => valores[k] ?? '');

export const legendaDoDia = (dia: string, feriados: string[], variacao = 0): string => {
  const tipo = tipoDoDia(dia, feriados);
  const semente = [...dia].reduce((s, c) => s + (/\d/.test(c) ? Number(c) : 0), 0) + variacao;
  let partes: string[];
  let valores: Record<string, string>;

  if (tipo === 'fechamento' || tipo === 'balanco') {
    const d = data(dia);
    const mes = MESES[tipo === 'balanco' ? (d.getUTCMonth() + 11) % 12 : d.getUTCMonth()];
    valores = { mes, Mes: mes.charAt(0).toUpperCase() + mes.slice(1) };
    const t = tipo === 'balanco' ? BALANCO : FECHAMENTO_MES;
    partes = [t.aberturas, t.ranking, t.chamada, t.final].map((l, i) => escolher(l, semente, i));
  } else {
    const s = SEMANA[tipo];
    valores = { dia: s.nome, gas: s.gas, disputa: s.disputa, destino: s.destino, despedida: s.despedida };
    partes = [s.aberturas, RANKING, CHAMADA, FECHAMENTO_SEMANA].map((l, i) => escolher(l, semente, i));
  }
  partes[0] = ABERTURA + partes[0];
  return partes.map((p) => preencher(p, valores)).join('\n\n');
};
