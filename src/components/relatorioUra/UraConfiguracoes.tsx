import React, { useState, useEffect } from 'react';
import { Settings2, Users, Link2, Target, History, FileDown, Trash2, KeyRound } from 'lucide-react';
import { Apelido, ChaveIndicador, Meta, Metas, OperadorCadastro, RegistroHistoricoUra } from '../../types/relatorioUra';
import { isoParaBr, normalizarNome } from '../../utils/calendario';
import { INDICADORES } from '../../utils/uraLeitura';
import { ConfigArgus, URL_PADRAO_ARGUS } from '../../utils/argusApi';

interface UraConfiguracoesProps {
  cadastro: OperadorCadastro[];
  apelidos: Apelido[];
  metas: Metas;
  historico: RegistroHistoricoUra[];
  argus: ConfigArgus;
  onArgusChange: (argus: ConfigArgus) => void;
  onApelidosChange: (apelidos: Apelido[]) => void;
  onMetasChange: (metas: Metas) => void;
  onExportarHistorico: () => void;
  onRemoverDia: (data: string) => void;
  onLimparHistorico: () => void;
}

/** Apelidos em texto: um por linha, "NOME NO SISTEMA = NOME OFICIAL" */
const apelidosParaTexto = (apelidos: Apelido[]): string =>
  apelidos.map((a) => `${a.noSistema} = ${a.oficial}`).join('\n');

const textoParaApelidos = (texto: string): Apelido[] =>
  texto
    .split(/\r?\n/)
    .map((linha) => linha.split('='))
    .filter((partes) => partes.length === 2)
    .map(([noSistema, oficial]) => ({ noSistema: noSistema.trim(), oficial: oficial.trim() }))
    .filter((a) => a.noSistema && a.oficial);

export const UraConfiguracoes: React.FC<UraConfiguracoesProps> = ({
  cadastro,
  apelidos,
  metas,
  historico,
  argus,
  onArgusChange,
  onApelidosChange,
  onMetasChange,
  onExportarHistorico,
  onRemoverDia,
  onLimparHistorico,
}) => {
  // O texto dos apelidos é editado livremente e só vira lista ao sair do campo
  const [textoApelidos, setTextoApelidos] = useState(apelidosParaTexto(apelidos));
  useEffect(() => setTextoApelidos(apelidosParaTexto(apelidos)), [apelidos]);

  const ativos = cadastro.filter((op) => normalizarNome(op.status) === 'ATIVO');
  const equipes = [...new Set(ativos.map((op) => op.equipe || 'SEM EQUIPE'))].sort();
  const dias = [...new Set(historico.map((r) => r.data))].sort().reverse();

  const alterarMeta = (chave: ChaveIndicador, campo: keyof Meta, valor: string) => {
    const padrao = INDICADORES.find((i) => i.chave === chave)!;
    const atual: Meta = metas[chave] ?? { sentido: padrao.sentido, verde: '', vermelho: '' };
    onMetasChange({ ...metas, [chave]: { ...atual, [campo]: valor } });
  };

  return (
    <div className="formatter-card">
      <div className="formatter-card-header">
        <h2 className="formatter-card-title">
          <Settings2 size={20} />
          Configurações
        </h2>
        <div className="badge-wrapper">
          <span className="badge badge-muted">Salvas só neste navegador</span>
        </div>
      </div>

      <div className="ura-config-grid">
        {/* Cadastro */}
        <div className="formatter-mapping-field mapped">
          <div className="formatter-field-label">
            <Users size={14} style={{ display: 'inline', marginRight: 6 }} />
            Cadastro de operadores
          </div>
          {cadastro.length === 0 ? (
            <div className="formatter-field-sample ura-quebra">
              Vazio. Arraste a exportação de OPERADORES do Argus (ou o operadores.xlsx do BENZAITEN).
            </div>
          ) : (
            <div className="formatter-field-sample ura-quebra">
              <span>{ativos.length}</span> ativos, {cadastro.length - ativos.length} inativos •{' '}
              {equipes.length} equipes: {equipes.join(', ')}. Atualizado sempre que a exportação de operadores é carregada.
            </div>
          )}
        </div>

        {/* Apelidos */}
        <div className="formatter-mapping-field mapped">
          <label htmlFor="ura-apelidos" className="formatter-field-label">
            <Link2 size={14} style={{ display: 'inline', marginRight: 6 }} />
            Apelidos ({apelidos.length})
          </label>
          <textarea
            id="ura-apelidos"
            className="formatter-select escala-textarea ura-textarea-apelidos"
            value={textoApelidos}
            onChange={(e) => setTextoApelidos(e.target.value)}
            onBlur={() => onApelidosChange(textoParaApelidos(textoApelidos))}
            placeholder={'JOANNA SOUSA = JOANA SOUSA'}
          />
          <div className="formatter-field-sample ura-quebra">
            Um por linha: <span>nome no sistema = nome oficial do cadastro</span>
          </div>
        </div>
      </div>

      {/* API do Argus */}
      <div className="formatter-mapping-field mapped">
        <div className="formatter-field-label">
          <KeyRound size={14} style={{ display: 'inline', marginRight: 6 }} />
          API do Argus
        </div>
        <div className="ura-argus-grid">
          <input
            type="password"
            className="formatter-select"
            value={argus.token}
            onChange={(e) => onArgusChange({ ...argus, token: e.target.value })}
            placeholder="Token (Argus > Configurações > Desenvolvedor > Acesso API)"
            aria-label="Token da API do Argus"
            autoComplete="off"
          />
          <input
            className="formatter-select"
            value={argus.url}
            onChange={(e) => onArgusChange({ ...argus, url: e.target.value })}
            onBlur={() => !argus.url.trim() && onArgusChange({ ...argus, url: URL_PADRAO_ARGUS })}
            aria-label="Endereço da API do Argus"
          />
        </div>
        <div className="formatter-field-sample ura-quebra">
          O token fica só neste navegador e vai direto do seu computador para o Argus (pela ponte local do{' '}
          <span>npm run dev</span>). Não compartilhe a tela com ele visível. A tarifação não existe na API: continua manual.
        </div>
      </div>

      {/* Metas */}
      <div>
        <h3 className="ura-subtitulo">
          <Target size={16} />
          Metas (semáforo nas linhas dos operadores)
        </h3>
        <p className="ura-ajuda">
          Deixe em branco para não pintar. TMA e TMO como 00:01:30; valores em reais só com o número (15000,50).
        </p>
        <div className="formatter-table-scroll">
          <table className="formatter-table ura-metas">
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Melhor quando</th>
                <th>Verde</th>
                <th>Vermelho</th>
              </tr>
            </thead>
            <tbody>
              {INDICADORES.map((indicador) => {
                const meta = metas[indicador.chave];
                return (
                  <tr key={indicador.chave}>
                    <td>{indicador.titulo}</td>
                    <td>
                      <select
                        className="formatter-select"
                        value={meta?.sentido ?? indicador.sentido}
                        onChange={(e) => alterarMeta(indicador.chave, 'sentido', e.target.value)}
                        aria-label={`Sentido da meta de ${indicador.titulo}`}
                      >
                        <option value="maior">maior</option>
                        <option value="menor">menor</option>
                      </select>
                    </td>
                    {(['verde', 'vermelho'] as const).map((campo) => (
                      <td key={campo}>
                        <input
                          className="formatter-select"
                          value={meta?.[campo] ?? ''}
                          onChange={(e) => alterarMeta(indicador.chave, campo, e.target.value)}
                          aria-label={`Limite ${campo} de ${indicador.titulo}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico */}
      <div>
        <h3 className="ura-subtitulo">
          <History size={16} />
          Histórico ({dias.length} relatório(s))
        </h3>
        <p className="ura-ajuda">
          Guarda só os totais de cada dia, para a comparação com o dia útil anterior. Mesmo formato do
          historico/relatorio_ura.csv do BENZAITEN (arraste-o aqui para importar).
        </p>
        {dias.length > 0 && (
          <div className="formatter-sheets-list">
            {dias.slice(0, 15).map((dia) => (
              <button
                key={dia}
                type="button"
                className="formatter-sheet-pill"
                title={`Apagar o relatório de ${isoParaBr(dia)} do histórico`}
                onClick={() => onRemoverDia(dia)}
              >
                {isoParaBr(dia)} ✕
              </button>
            ))}
          </div>
        )}
        <div className="formatter-actions-buttons escala-acoes" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={onExportarHistorico} disabled={dias.length === 0}>
            <FileDown size={16} />
            Exportar histórico
          </button>
          <button type="button" className="btn btn-danger" onClick={onLimparHistorico} disabled={dias.length === 0}>
            <Trash2 size={16} />
            Limpar histórico
          </button>
        </div>
      </div>
    </div>
  );
};
