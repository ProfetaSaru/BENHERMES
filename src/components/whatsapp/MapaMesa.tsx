import React from 'react';
import { Lugar, Mesa } from '../../types/whatsapp';
import { codigoDoLugar, posicoesDaMesa } from '../../utils/mapaMesas';
import { DESCRICOES, analiseAtrasada, restricaoVencida, tempoDesde, tempoRestante } from '../../utils/whatsappBaias';

export type FiltroMapa = 'todas' | 'problemas' | 'vazias';

interface MapaMesaProps {
  mesa: Mesa;
  filtro: FiltroMapa;
  agora: Date;
  selecionado: string | null;
  onSelecionar: (posicao: string) => void;
  /** Na configuração, todas as baias (inclusive desativadas) são clicáveis */
  modoConfiguracao?: boolean;
  /** Onde está o WhatsApp de cada posição ("📱 Azul · Usuário 2 · Messenger 1"); ausente = não mostra */
  localDe?: (posicao: string) => string;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
};

const PAPEIS: Record<string, string> = { SUP: 'Supervisor', SUB: 'Sub-líder' };

/** Texto curto da situação: prazo da restrição e tempo do banimento/análise */
export const detalheDaSituacao = (lugar: Lugar, agora: Date): string => {
  const { whatsapp } = lugar;
  switch (whatsapp.situacao) {
    case 'BANIDO':
      return `${DESCRICOES.BANIDO} · há ${tempoDesde(whatsapp.mudouEm, agora)}`;
    case 'ANALISE': {
      const desde = whatsapp.analisePedidaEm ?? whatsapp.mudouEm;
      return analiseAtrasada(whatsapp, agora)
        ? `Análise há ${tempoDesde(desde, agora)} — conferir`
        : `Em análise · há ${tempoDesde(desde, agora)}`;
    }
    case 'PERMANENTE':
      return 'Perdido — trocar o chip';
    case 'RESTRINGIDO':
      if (restricaoVencida(whatsapp, agora)) return 'Restrição terminou — confira';
      if (!whatsapp.restritoAte) return 'Restringido';
      return `Restringido · até ${dataCurta(whatsapp.restritoAte)} · faltam ${tempoRestante(whatsapp, agora)}`;
    default:
      return DESCRICOES[whatsapp.situacao];
  }
};

/**
 * Uma mesa no visual do mapa do Sistema de Chamados: supervisor (e backup) no topo,
 * lado esquerdo e lado direito separados pelo corredor, "início da mesa" embaixo.
 */
export const MapaMesa: React.FC<MapaMesaProps> = ({ mesa, filtro, agora, selecionado, onSelecionar, modoConfiguracao, localDe }) => {
  const { centro, esquerda, direita } = posicoesDaMesa(mesa);

  const cartao = (posicao: string) => {
    const codigo = codigoDoLugar(mesa.sigla, posicao);
    const desativada = mesa.desativadas.includes(posicao);
    const lugar = mesa.lugares[posicao];

    if (desativada || !lugar) {
      return (
        <button
          key={posicao}
          type="button"
          className="wpp-baia desativada"
          disabled={!modoConfiguracao}
          onClick={() => onSelecionar(posicao)}
          aria-label={`${codigo}: baia desativada${modoConfiguracao ? '. Clique para reativar' : ''}`}
        >
          <span className="wpp-baia-codigo">{codigo}</span>
          <span className="wpp-baia-nome">Baia desativada</span>
        </button>
      );
    }

    const papel = PAPEIS[posicao];
    const nome = posicao === 'SUP' ? mesa.supervisor : lugar.operador;
    const vazia = !papel && !lugar.operador.trim();
    const situacao = lugar.whatsapp.situacao;
    // Supervisor sem WhatsApp: cinza, sem situação, fora dos problemas
    const semWhatsapp = posicao === 'SUP' && mesa.whatsappSupervisor === 'NAO_TEM';
    const alerta = restricaoVencida(lugar.whatsapp, agora) || analiseAtrasada(lugar.whatsapp, agora);
    const destaque =
      filtro === 'todas' || (filtro === 'problemas' ? !semWhatsapp && situacao !== 'OK' : vazia);
    const classes = [
      'wpp-baia',
      semWhatsapp ? 'semwpp' : `wpp-${situacao.toLowerCase()}`,
      alerta ? 'vencida' : '',
      vazia ? 'vazia' : '',
      papel ? 'centro' : '',
      destaque ? '' : 'apagada',
      selecionado === posicao ? 'selecionada' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const detalhe = semWhatsapp
      ? 'Sem WhatsApp'
      : posicao === 'SUP'
        ? `${mesa.whatsappSupervisor === 'CELULAR' ? 'No celular' : 'No PC'} · ${detalheDaSituacao(lugar, agora)}`
        : detalheDaSituacao(lugar, agora);
    const local = localDe && posicao !== 'SUP' ? localDe(posicao) : '';

    return (
      <button
        key={posicao}
        type="button"
        className={classes}
        onClick={() => onSelecionar(posicao)}
        aria-pressed={selecionado === posicao}
        aria-label={`${codigo}, ${papel ?? 'baia'}: ${nome || (vazia ? 'vaga vazia' : 'sem nome')}. WhatsApp: ${detalhe}${local ? `. ${local}` : ''}`}
      >
        <span className="wpp-baia-topo">
          <span className="wpp-baia-codigo">{codigo}</span>
          <span className="wpp-bolinha" aria-hidden="true" />
        </span>
        <span className="wpp-baia-nome">
          {papel ? <em>{papel}</em> : null}
          {nome || (vazia ? 'Vaga vazia' : '—')}
        </span>
        <span className="wpp-baia-situacao">{detalhe}</span>
        {local && <span className="wpp-baia-local">{local}</span>}
      </button>
    );
  };

  return (
    <div className="wpp-mesa">
      {centro.length > 0 && <div className="wpp-mesa-centro">{centro.map(cartao)}</div>}
      <div className="wpp-mesa-lados">
        <div className="wpp-mesa-lado">{esquerda.map(cartao)}</div>
        <div className="wpp-mesa-corredor" aria-hidden="true" />
        <div className="wpp-mesa-lado">{direita.map(cartao)}</div>
      </div>
      <div className="wpp-mesa-rodape">
        <span>Lado esquerdo</span>
        <span>Lado direito</span>
      </div>
      <div className="wpp-mesa-inicio">início da mesa</div>
    </div>
  );
};
