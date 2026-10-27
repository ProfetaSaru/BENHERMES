import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, UserX, X } from 'lucide-react';
import { EstadoWhatsapp, Situacao } from '../../types/whatsapp';
import { ROTULOS, mudarSituacao, restricaoVencida, restringir, tempoRestante } from '../../utils/whatsappBaias';

interface PainelLugarProps {
  titulo: string;
  subtitulo: string;
  /** Campo de nome (operador, supervisor ou backup); ausente nos celulares */
  nome?: { rotulo: string; valor: string; onChange: (valor: string) => void; podeEsvaziar: boolean };
  estado: EstadoWhatsapp;
  onEstado: (novo: EstadoWhatsapp) => void;
  agora: Date;
  onFechar: () => void;
}

const SITUACOES: Situacao[] = ['OK', 'BANIDO', 'RESTRINGIDO', 'NAO_TEM'];

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} às ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
};

/** Painel lateral para editar um lugar (ou um celular): nome e situação do WhatsApp */
export const PainelLugar: React.FC<PainelLugarProps> = ({ titulo, subtitulo, nome, estado, onEstado, agora, onFechar }) => {
  const [restringindo, setRestringindo] = useState(false);
  const [quantidade, setQuantidade] = useState('24');
  const [unidade, setUnidade] = useState<'horas' | 'dias'>('horas');
  const [erro, setErro] = useState('');

  // Trocou de lugar: fecha o formulário de restrição
  useEffect(() => {
    setRestringindo(false);
    setErro('');
  }, [titulo]);

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
    onEstado(mudarSituacao(estado, situacao, new Date()));
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

  const vencida = restricaoVencida(estado, agora);

  return (
    <aside className="wpp-painel" aria-label={`Editar ${titulo}`}>
      <div className="wpp-painel-topo">
        <div>
          <h2>{titulo}</h2>
          <p>{subtitulo}</p>
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
            onBlur={(e) => nome.onChange(e.target.value.replace(/\s+/g, ' ').trim())}
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

      <div className="wpp-painel-campo">
        <div className="formatter-field-label">WhatsApp</div>
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
                <AlertTriangle size={16} /> A restrição terminou em {dataHora(estado.restritoAte!)}. Confira se o WhatsApp
                voltou.
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
    </aside>
  );
};
