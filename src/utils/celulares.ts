import { Celular, EstadoWhatsapp, Marca, MapaWhatsapp, Mesa, Sala, VagaWhatsapp } from '../types/whatsapp';
import { normalizarNome } from './calendario';
import { posicoesAtivas } from './mapaMesas';
import { alterarLugarNoMapa, estado, removerMesaNoMapa } from './whatsappBaias';

/**
 * Celulares corporativos: cada celular (identificado pela cor da capinha) tem vagas de WhatsApp
 * conforme a marca. Vaga de operador é ligada a uma baia da equipe do celular e usa a situação
 * da baia; vaga de backup tem a própria situação. Tudo puro; "agora" vem por parâmetro.
 */

export const CORES_CAPINHA: Record<string, string> = {
  Azul: '#00B0F0',
  Verde: '#00B050',
  Vermelho: '#FF0000',
  Ciano: '#2BF8FD',
  Preto: '#000000',
  Roxo: '#7030A0',
  Branco: '#FFFFFF',
};

export const corDaCapinha = (nome: string): string => {
  const achada = Object.keys(CORES_CAPINHA).find((c) => normalizarNome(c) === normalizarNome(nome));
  return achada ? CORES_CAPINHA[achada] : '#808080';
};

type ModeloDeVaga = Pick<VagaWhatsapp, 'grupo' | 'app' | 'rotulo'>;

const basicas = (grupo: string): ModeloDeVaga[] => [
  { grupo, app: 'BUSINESS', rotulo: 'Business' },
  { grupo, app: 'MESSENGER', rotulo: 'Messenger 1' },
  { grupo, app: 'MESSENGER', rotulo: 'Messenger 2' },
];

const usuarios = (n: number): string[] =>
  Array.from({ length: Math.max(1, n) }, (_, i) => (i === 0 ? 'Proprietário' : `Usuário ${i + 1}`));

/** Vagas criadas por marca (Messenger tem 2 contas; Business, 1) */
export const vagasDaMarca = (marca: Marca, quantidadeDeUsuarios: number): ModeloDeVaga[] => {
  switch (marca) {
    case 'SAMSUNG':
      return [
        ...basicas('Padrão'),
        ...basicas('Pasta segura'),
        { grupo: 'Clonado', app: 'MESSENGER', rotulo: 'Messenger 1' },
        { grupo: 'Clonado', app: 'MESSENGER', rotulo: 'Messenger 2' },
      ];
    case 'MOTOROLA':
      return usuarios(quantidadeDeUsuarios).flatMap((grupo, i) =>
        i === 0
          ? [
              { grupo, app: 'BUSINESS', rotulo: 'Business' },
              { grupo, app: 'BUSINESS', rotulo: 'Business clonado' },
              { grupo, app: 'MESSENGER', rotulo: 'Messenger 1' },
              { grupo, app: 'MESSENGER', rotulo: 'Messenger 2' },
              { grupo, app: 'MESSENGER', rotulo: 'Messenger clonado 1' },
              { grupo, app: 'MESSENGER', rotulo: 'Messenger clonado 2' },
            ]
          : basicas(grupo)
      ) as ModeloDeVaga[];
    case 'XIAOMI':
      return usuarios(quantidadeDeUsuarios).flatMap(basicas);
    case 'IPHONE':
      return basicas('Padrão');
    default:
      return [];
  }
};

const temUsuarios = (marca: Marca) => marca === 'MOTOROLA' || marca === 'XIAOMI';

const novaVaga = (modelo: ModeloDeVaga, agora: Date): VagaWhatsapp => ({
  id: crypto.randomUUID(),
  ...modelo,
  baia: null,
  whatsapp: estado('OK', agora),
  numero: '',
});

const acharMesa = (mapa: MapaWhatsapp, mesaId: string | null): { sala: Sala; mesa: Mesa } | null => {
  for (const sala of mapa.salas) {
    const mesa = sala.mesas.find((m) => m.id === mesaId);
    if (mesa) return { sala, mesa };
  }
  return null;
};

const ehDigital = (mesa: Mesa | undefined) => !!mesa && normalizarNome(mesa.nome) === 'DIGITAL';

/** Compartilhado e nome do backup pela mesa (Digital → "Digital Benconsig") */
const perfilDaMesa = (mesa: Mesa | undefined) =>
  ehDigital(mesa)
    ? { compartilhado: true, nomeBackup: 'Digital Benconsig' }
    : { compartilhado: false, nomeBackup: 'Benconsig Comercial' };

/**
 * Messenger, na ordem, para o lado esquerdo; Business, na ordem, para o direito; baias já
 * ligadas a outro celular da equipe são puladas; o resto fica backup.
 */
export const ligarAutomaticamente = (celular: Celular, mapa: MapaWhatsapp): Celular => {
  const achada = acharMesa(mapa, celular.mesaId);
  const vagas = celular.vagas.map((v) => ({ ...v, baia: null as string | null }));
  if (!achada || celular.compartilhado) return { ...celular, vagas };
  const { mesa } = achada;
  const ocupadas = new Set(
    mapa.celulares
      .filter((c) => c.id !== celular.id && c.mesaId === mesa.id)
      .flatMap((c) => c.vagas.map((v) => v.baia))
      .filter(Boolean)
  );
  const ativas = posicoesAtivas(mesa);
  const livres = (lado: 'E' | 'D') => ativas.filter((p) => p.startsWith(lado) && !ocupadas.has(p));
  const fila = { MESSENGER: livres('E'), BUSINESS: livres('D') };
  return { ...celular, vagas: vagas.map((v) => ({ ...v, baia: fila[v.app].shift() ?? null })) };
};

export const novoCelular = (
  dados: Pick<Celular, 'cor' | 'hex' | 'apelido' | 'marca' | 'usuarios' | 'mesaId'>,
  mapa: MapaWhatsapp,
  agora: Date
): Celular => {
  const quantos = temUsuarios(dados.marca) ? dados.usuarios : 1;
  const celular: Celular = {
    id: crypto.randomUUID(),
    ...dados,
    usuarios: quantos,
    ...perfilDaMesa(acharMesa(mapa, dados.mesaId)?.mesa),
    vagas: vagasDaMarca(dados.marca, quantos).map((m) => novaVaga(m, agora)),
  };
  return ligarAutomaticamente(celular, mapa);
};

// ---------------------------------------------------------------------------
// Alterações no mapa
// ---------------------------------------------------------------------------

const comCelulares = (mapa: MapaWhatsapp, celulares: Celular[], agora: Date): MapaWhatsapp => ({
  ...mapa,
  celulares,
  atualizadoEm: agora.toISOString(),
});

export const adicionarCelularNoMapa = (mapa: MapaWhatsapp, celular: Celular, agora: Date): MapaWhatsapp =>
  comCelulares(mapa, [...mapa.celulares, celular], agora);

export const alterarCelularNoMapa = (
  mapa: MapaWhatsapp,
  celularId: string,
  mudar: (c: Celular) => Celular,
  agora: Date
): MapaWhatsapp => comCelulares(mapa, mapa.celulares.map((c) => (c.id === celularId ? mudar(c) : c)), agora);

export const removerCelularNoMapa = (mapa: MapaWhatsapp, celularId: string, agora: Date): MapaWhatsapp =>
  comCelulares(mapa, mapa.celulares.filter((c) => c.id !== celularId), agora);

/** "Preto · Joana" ou "Azul" */
export const nomeDoCelular = (c: Pick<Celular, 'cor' | 'apelido'>): string =>
  c.apelido.trim() ? `${c.cor} · ${c.apelido.trim()}` : c.cor;

/** "Azul · Usuário 2 · Messenger 1" */
export const textoDoLocal = (c: Pick<Celular, 'cor' | 'apelido'>, v: Pick<VagaWhatsapp, 'grupo' | 'rotulo'>): string =>
  `${nomeDoCelular(c)} · ${v.grupo} · ${v.rotulo}`;

/**
 * Liga a vaga a uma baia (ou faz dela backup com `baia` null). Se a baia já estava em outra vaga
 * da equipe, aquela vira backup e `desligada` diz onde ela estava.
 */
export const ligarBaia = (
  mapa: MapaWhatsapp,
  celularId: string,
  vagaId: string,
  baia: string | null,
  agora: Date
): { mapa: MapaWhatsapp; desligada: string | null } => {
  const celular = mapa.celulares.find((c) => c.id === celularId);
  if (!celular) return { mapa, desligada: null };
  let desligada: string | null = null;
  const celulares = mapa.celulares.map((c) => {
    const mesmaEquipe = c.mesaId === celular.mesaId;
    return {
      ...c,
      vagas: c.vagas.map((v) => {
        if (c.id === celularId && v.id === vagaId) return { ...v, baia };
        if (baia && mesmaEquipe && v.baia === baia) {
          desligada = textoDoLocal(c, v);
          return { ...v, baia: null };
        }
        return v;
      }),
    };
  });
  return { mapa: comCelulares(mapa, celulares, agora), desligada };
};

/** Nova equipe (ou guardado, com null): refaz a ligação automática na equipe nova */
export const mudarEquipe = (mapa: MapaWhatsapp, celularId: string, mesaId: string | null, agora: Date): MapaWhatsapp =>
  alterarCelularNoMapa(
    mapa,
    celularId,
    (c) => ligarAutomaticamente({ ...c, mesaId, ...perfilDaMesa(acharMesa(mapa, mesaId)?.mesa) }, mapa),
    agora
  );

/**
 * Nova marca ou quantidade de usuários: recria as vagas pela tabela, mantendo as que continuam
 * (mesmo grupo e rótulo) e devolvendo as que somem.
 */
export const mudarMarcaOuUsuarios = (
  celular: Celular,
  marca: Marca,
  quantidade: number,
  agora: Date
): { celular: Celular; removidas: VagaWhatsapp[] } => {
  if (marca === 'OUTRO' && celular.marca === 'OUTRO') return { celular, removidas: [] };
  const quantos = temUsuarios(marca) ? quantidade : 1;
  const chave = (v: ModeloDeVaga) => `${v.grupo}|${v.rotulo}`;
  const atuais = new Map(celular.vagas.map((v) => [chave(v), v]));
  const modelos = vagasDaMarca(marca, quantos);
  const vagas = modelos.map((m) => atuais.get(chave(m)) ?? novaVaga(m, agora));
  const mantidas = new Set(modelos.map(chave));
  return {
    celular: { ...celular, marca, usuarios: quantos, vagas },
    removidas: celular.vagas.filter((v) => !mantidas.has(chave(v))),
  };
};

export const adicionarVaga = (celular: Celular, dados: ModeloDeVaga, agora: Date): Celular => ({
  ...celular,
  vagas: [...celular.vagas, novaVaga(dados, agora)],
});

export const removerVaga = (celular: Celular, vagaId: string): Celular => ({
  ...celular,
  vagas: celular.vagas.filter((v) => v.id !== vagaId),
});

/** Vaga ligada a baia que não existe (ou está desativada) vira backup; celular de mesa removida fica guardado */
export const limparLigacoes = (mapa: MapaWhatsapp): MapaWhatsapp => ({
  ...mapa,
  celulares: mapa.celulares.map((c) => {
    const achada = acharMesa(mapa, c.mesaId);
    if (!achada) return { ...c, mesaId: null, vagas: c.vagas.map((v) => ({ ...v, baia: null })) };
    const ativas = new Set(posicoesAtivas(achada.mesa));
    return { ...c, vagas: c.vagas.map((v) => (v.baia && !ativas.has(v.baia) ? { ...v, baia: null } : v)) };
  }),
});

export const removerMesaComCelulares = (mapa: MapaWhatsapp, salaId: string, mesaId: string, agora: Date): MapaWhatsapp =>
  limparLigacoes(removerMesaNoMapa(mapa, salaId, mesaId, agora));

// ---------------------------------------------------------------------------
// Situação e nomes
// ---------------------------------------------------------------------------

const lugarDaVaga = (mapa: MapaWhatsapp, celular: Celular, vaga: VagaWhatsapp) => {
  if (!vaga.baia) return null;
  const achada = acharMesa(mapa, celular.mesaId);
  const lugar = achada?.mesa.lugares[vaga.baia];
  return achada && lugar ? { ...achada, lugar } : null;
};

export const estadoDaVaga = (mapa: MapaWhatsapp, celular: Celular, vaga: VagaWhatsapp): EstadoWhatsapp =>
  lugarDaVaga(mapa, celular, vaga)?.lugar.whatsapp ?? vaga.whatsapp;

/** Vaga ligada muda a situação da baia; backup muda a própria */
export const alterarEstadoDaVaga = (
  mapa: MapaWhatsapp,
  celularId: string,
  vagaId: string,
  novo: EstadoWhatsapp,
  agora: Date
): MapaWhatsapp => {
  const celular = mapa.celulares.find((c) => c.id === celularId);
  const vaga = celular?.vagas.find((v) => v.id === vagaId);
  if (!celular || !vaga) return mapa;
  const ligada = lugarDaVaga(mapa, celular, vaga);
  if (ligada) return alterarLugarNoMapa(mapa, ligada.sala.id, ligada.mesa.id, vaga.baia!, { whatsapp: novo }, agora);
  return alterarCelularNoMapa(
    mapa,
    celularId,
    (c) => ({ ...c, vagas: c.vagas.map((v) => (v.id === vagaId ? { ...v, whatsapp: novo } : v)) }),
    agora
  );
};

/** Operador da baia ligada ("Vaga vazia" se não houver) ou o nome do backup */
export const nomeDaVaga = (mapa: MapaWhatsapp, celular: Celular, vaga: VagaWhatsapp): string => {
  const ligada = lugarDaVaga(mapa, celular, vaga);
  if (ligada) return ligada.lugar.operador.trim() || 'Vaga vazia';
  return celular.nomeBackup;
};

export const ondeEstaABaia = (
  mapa: MapaWhatsapp,
  mesaId: string,
  posicao: string
): { celular: Celular; vaga: VagaWhatsapp } | null => {
  for (const celular of mapa.celulares) {
    if (celular.mesaId !== mesaId) continue;
    const vaga = celular.vagas.find((v) => v.baia === posicao);
    if (vaga) return { celular, vaga };
  }
  return null;
};
