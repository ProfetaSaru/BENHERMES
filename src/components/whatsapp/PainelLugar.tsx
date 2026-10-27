import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Send, Smartphone, UserX, X, XCircle } from 'lucide-react';
import { EstadoWhatsapp, Situacao, WhatsappDoSupervisor } from '../../types/whatsapp';
import {
  ROTULOS,
  analiseAtrasada,
  estado as novoEstado,
  mudarSituacao,
  pedirAnalise,
  restricaoVencida,
  restringir,
  tempoDesde,
  tempoRestante,
} from '../../utils/whatsappBaias';

interface PainelLugarProps {
  titulo: string;
  subtitulo: string;
  /** Campo de nome (operador ou supervisor); ausente nas vagas de backup */
  nome?: { rotulo: string; valor: string; onChange: (valor: string) => void; podeEsvaziar: boolean };
  /** Onde está o WhatsApp ("📱 Azul · Usuário 2 · Messenger 1" ou "sem celular") */
  local?: string;
  /** Só no supervisor: onde ele usa o WhatsApp */
  supervisor?: { valor: WhatsappDoSupervisor; onChange: (v: WhatsappDoSupervisor) => void };
  estado: EstadoWhatsapp;
  onEstado: (novo: EstadoWhatsapp) => void;
  agora: Date;
  onFechar: () => void;
}

const SITUACOES: Situacao[] = ['OK', 'BANIDO', 'ANALISE', 'PERMANENTE', 'RESTRINGIDO', 'NAO_TEM'];

const OPCOES_SUPERVISOR: [WhatsappDoSupervisor, string][] = [
  ['PC', 'No PC'],
  ['CELULAR', 'No celular'],
  ['NAO_TEM', 'Não tem WhatsApp'],
];

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} às ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
};

/**
 * Painel lateral para editar um lugar ou uma vaga de backup: nome, situação do WhatsApp e as
 * ações do ciclo do banimento (pedir análise → liberado ou perdido).
 */
export const PainelLugar: React.FC<PainelLugarProps> = ({
  titulo,
  subtitulo,
  nome,
  local,
  supervisor,
  estado,
  onEstado,
  agora,
  onFechar,
}) => {
  const [restringindo, setRestringindo] = useState(false);
  const [quantidade, setQuantidade] = useState('24');
  const [unidade, setUnidade] = useState<'horas' | 'dias'>('horas');
  const [erro, setErro] = useState('');

  // Trocou de lugar: fecha o formulário de restrição
  useEffect(() => {
    setRestringindo(false);
    setErro('');
  }, [titulo, subtitulo]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const escolher = (situacao: Situacao) => {
    setErro('');
    if (situacao === 'RESTRINGIDO') {
      setRestringindo(true);
      return;
    }
    setRestringindo(false);
    if (situacao === estado.situacao) return;
    onEstado(situacao === 'ANALISE' ? pedirAnalise(new Date()) : mudarSituacao(estado, situacao, new Date()));
  };

  const confirmarRestricao = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onEstado(restringir(Number(quantidade.replace(',', '.')), unidade, new Date()));
      setRestringindo(false);
      setErro('');
    } catch (err: any) {
      setErro(err.message);
    }
  };

  const semWhatsapp = supervisor?.valor === 'NAO_TEM';
  const vencida = restricaoVencida(estado, agora);
  const atrasada = analiseAtrasada(estado, agora);

  return (
    <aside className="wpp-painel" aria-label={`Editar ${titulo}`}>
      <div className="wpp-painel-topo">
        <div>
          <h2>{titulo}</h2>
          <p>{subtitulo}</p>
          {local && (
            <p className="wpp-painel-local">
              <Smartphone size={14} /> {local}
            </p>
          )}
        </div>
        <button type="button" className="ura-arquivo-remover" onClick={onFechar} aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      {nome && (
        <div className="wpp-painel-campo">
          <label htmlFor="wpp-nome" className="formatter-field-label">
            {nome.rotulo}
          </label>
          <input
            id="wpp-nome"
            className="formatter-select"
            value={nome.valor}
            onChange={(e) => nome.onChange(e.target.value)}
            onBlur={(e) => {
              const limpo = e.target.value.replace(/\s+/g, ' ').trim();
              if (limpo !== nome.valor) nome.onChange(limpo);
            }}
            placeholder={nome.podeEsvaziar ? 'Vaga vazia' : 'Nome'}
          />
          {nome.podeEsvaziar && nome.valor.trim() && (
            <button type="button" className="btn btn-secondary wpp-botao-pequeno" onClick={() => nome.onChange('')}>
              <UserX size={16} />
              Esvaziar baia
            </button>
          )}
        </div>
      )}

      {supervisor && (
        <div className="wpp-painel-campo">
          <div className="formatter-field-label">WhatsApp do supervisor</div>
          <div className="wpp-opcoes" role="group" aria-label="Onde o supervisor usa o WhatsApp">
            {OPCOES_SUPERVISOR.map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                className={`wpp-filtro ${supervisor.valor === id ? 'ativo' : ''}`}
                aria-pressed={supervisor.valor === id}
                onClick={() => supervisor.onChange(id)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {semWhatsapp ? (
        <p className="ura-ajuda">Supervisor sem WhatsApp: fica fora das contagens e dos alertas.</p>
      ) : (
        <>
          {estado.situacao === 'BANIDO' && (
            <div className="wpp-ciclo wpp-banido">
              <p>
                <AlertTriangle size={16} /> Banido há {tempoDesde(estado.mudouEm, agora)}. Peça a análise o quanto antes:
                pedida logo, ele costuma voltar no dia seguinte.
              </p>
              <button type="button" className="btn btn-primary wpp-botao-pequeno" onClick={() => onEstado(pedirAnalise(new Date()))}>
                <Send size={16} />
                Pedi a análise
              </button>
            </div>
          )}
          {estado.situacao === 'ANALISE' && (
            <div className={`wpp-ciclo wpp-analise ${atrasada ? 'vencida' : ''}`}>
              <p>
                <Clock size={16} /> Análise pedida há {tempoDesde(estado.analisePedidaEm ?? estado.mudouEm, agora)}
                {atrasada ? ' — mais de 1 dia: confira se voltou.' : '.'}
              </p>
              <div className="wpp-opcoes">
                <button type="button" className="btn btn-primary wpp-botao-pequeno" onClick={() => onEstado(novoEstado('OK', new Date()))}>
                  <CheckCircle2 size={16} />
                  Liberado
                </button>
                <button
                  type="button"
                  className="btn btn-secondary wpp-botao-pequeno wpp-perigo"
                  onClick={() => onEstado(mudarSituacao(estado, 'PERMANENTE', new Date()))}
                >
                  <XCircle size={16} />
                  Permanente
                </button>
              </div>
            </div>
          )}
          {estado.situacao === 'PERMANENTE' && (
            <div className="wpp-ciclo wpp-permanente">
              <p>
                <XCircle size={16} /> Número perdido desde {dataHora(estado.mudouEm)}: troque o chip desta vaga.
              </p>
            </div>
          )}

          <div className="wpp-painel-campo">
            <div className="formatter-field-label">Situação do WhatsApp</div>
            <div className="wpp-situacoes" role="group" aria-label="Situação do WhatsApp">
              {SITUACOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`wpp-situacao wpp-${s.toLowerCase()} ${estado.situacao === s ? 'ativa' : ''}`}
                  aria-pressed={estado.situacao === s}
                  onClick={() => escolher(s)}
                >
                  <span className="wpp-bolinha" aria-hidden="true" />
                  {ROTULOS[s]}
                </button>
              ))}
            </div>
          </div>

          {restringindo && (
            <form className="wpp-painel-campo wpp-restricao" onSubmit={confirmarRestricao}>
              <label htmlFor="wpp-tempo" className="formatter-field-label">
                Restringido por quanto tempo?
              </label>
              <div className="wpp-restricao-linha">
                <input
                  id="wpp-tempo"
                  className="formatter-select"
                  inputMode="decimal"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  aria-invalid={!!erro}
                />
                <select
                  className="formatter-select"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as 'horas' | 'dias')}
                  aria-label="Unidade"
                >
                  <option value="horas">horas</option>
                  <option value="dias">dias</option>
                </select>
                <button type="submit" className="btn btn-primary wpp-botao-pequeno">
                  <Clock size={16} />
                  Restringir
                </button>
              </div>
              {erro && <p className="wpp-erro">{erro}</p>}
            </form>
          )}

          {estado.situacao === 'RESTRINGIDO' && !restringindo && (
            <div className={`wpp-painel-campo wpp-prazo ${vencida ? 'vencida' : ''}`}>
              {vencida ? (
                <>
                  <p>
                    <AlertTriangle size={16} /> A restrição terminou em {dataHora(estado.restritoAte!)}. Confira se o
                    WhatsApp voltou.
                  </p>
                  <button type="button" className="btn btn-primary wpp-botao-pequeno" onClick={() => escolher('OK')}>
                    Voltar para OK
                  </button>
                </>
              ) : estado.restritoAte ? (
                <p>
                  <Clock size={16} /> Restringido até {dataHora(estado.restritoAte)} · faltam {tempoRestante(estado, agora)}
                </p>
              ) : (
                <p>Restringido sem prazo informado. Clique em RESTRINGIDO para definir o tempo.</p>
              )}
            </div>
          )}

          <p className="wpp-painel-rodape">Última mudança: {dataHora(estado.mudouEm)}</p>
        </>
      )}
    </aside>
  );
};
