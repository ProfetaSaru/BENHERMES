import React, { useRef, useState } from 'react';
import { Settings, CalendarX2, Plus, Trash2, Upload, Flag } from 'lucide-react';
import * as XLSX from 'xlsx';
import { NotificationType } from '../../types/task';
import { useFeriados } from '../../hooks/useFeriados';
import {
  FeriadoLocal,
  celulaParaIso,
  diaDaSemana,
  feriadosNacionaisDoAno,
  hojeIso,
  isoParaBr,
} from '../../utils/calendario';

interface ConfiguracoesHubProps {
  onNotify: (message: string, type?: NotificationType) => void;
}

/**
 * Lê o config/feriados.xlsx do BENZAITEN (ou qualquer planilha com Data e Descrição
 * nas duas primeiras colunas, a partir da segunda linha).
 */
const lerPlanilhaDeFeriados = (livro: XLSX.WorkBook): FeriadoLocal[] => {
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets[livro.SheetNames[0]], {
    header: 1,
    defval: '',
    raw: true,
  });
  return linhas
    .slice(1)
    .map(([data, descricao]) => ({ data: celulaParaIso(data) ?? '', descricao: String(descricao || 'Feriado').trim() }))
    .filter((f) => f.data);
};

export const ConfiguracoesHub: React.FC<ConfiguracoesHubProps> = ({ onNotify }) => {
  const { feriados, adicionar, remover } = useFeriados();
  const [data, setData] = useState('');
  const [descricao, setDescricao] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ano = Number(hojeIso().slice(0, 4));
  const nacionais = feriadosNacionaisDoAno(ano);
  const hoje = hojeIso();
  const proximos = feriados.filter((f) => f.data >= hoje);
  const passados = feriados.filter((f) => f.data < hoje);

  const handleAdicionar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) {
      onNotify('Escolha a data do feriado.', 'error');
      return;
    }
    const nacional = nacionais.find((f) => f.data === data);
    if (nacional) {
      onNotify(`${isoParaBr(data)} já é feriado nacional (${nacional.descricao}): não precisa cadastrar.`, 'info');
      return;
    }
    adicionar({ data, descricao: descricao.trim() || 'Feriado' });
    onNotify(`Feriado de ${isoParaBr(data)} cadastrado.`, 'success');
    setData('');
    setDescricao('');
  };

  const handleImportar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!arquivo) return;
    try {
      const lidos = lerPlanilhaDeFeriados(XLSX.read(await arquivo.arrayBuffer(), { type: 'array' }));
      lidos.forEach(adicionar);
      onNotify(`${lidos.length} feriado(s) importado(s).`, lidos.length > 0 ? 'success' : 'info');
    } catch (err: any) {
      onNotify(`Erro ao importar: ${err.message || 'arquivo ilegível'}`, 'error');
    }
  };

  const linha = (f: FeriadoLocal, removivel: boolean) => (
    <tr key={f.data}>
      <td style={{ fontWeight: 600 }}>{isoParaBr(f.data)}</td>
      <td>{diaDaSemana(f.data)}</td>
      <td>{f.descricao}</td>
      <td style={{ textAlign: 'right' }}>
        {removivel && (
          <button
            type="button"
            className="ura-arquivo-remover"
            onClick={() => remover(f.data)}
            title={`Remover o feriado de ${isoParaBr(f.data)}`}
            aria-label={`Remover o feriado de ${isoParaBr(f.data)}`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <div className="formatter-root">
      <header className="formatter-header">
        <div className="formatter-header-info">
          <p className="eyebrow">SISTEMA & APOIO</p>
          <h1>
            <Settings size={32} />
            Configurações do Hub
          </h1>
          <p>
            Ajustes que valem para todas as ferramentas. Os feriados cadastrados aqui são pulados no "dia útil
            anterior" do Relatório URA e aparecem como aviso na Escala de Bases.
          </p>
        </div>
        <div className="task-count">
          <span className="task-count-number">{proximos.length}</span>
          <span className="task-count-label">feriados locais à frente</span>
        </div>
      </header>

      <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleImportar} style={{ display: 'none' }} />

      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <CalendarX2 size={20} />
            Feriados locais
          </h2>
          <div className="formatter-actions-buttons escala-acoes">
            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              Importar feriados.xlsx
            </button>
          </div>
        </div>

        <p className="ura-ajuda">
          Estaduais, municipais e pontos facultativos (Carnaval, Corpus Christi, aniversário da cidade...). Os
          nacionais já são considerados sozinhos e estão listados abaixo.
        </p>

        <form className="config-feriado-form" onSubmit={handleAdicionar}>
          <input
            type="date"
            className="formatter-select"
            value={data}
            onChange={(e) => setData(e.target.value)}
            aria-label="Data do feriado"
          />
          <input
            className="formatter-select"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (ex.: Carnaval)"
            aria-label="Descrição do feriado"
          />
          <button type="submit" className="btn btn-primary">
            <Plus size={16} />
            Adicionar
          </button>
        </form>

        {feriados.length === 0 ? (
          <div className="formatter-field-sample ura-quebra">Nenhum feriado local cadastrado.</div>
        ) : (
          <div className="formatter-table-scroll">
            <table className="formatter-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Dia</th>
                  <th>Descrição</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {proximos.map((f) => linha(f, true))}
                {passados.length > 0 && (
                  <tr>
                    <td colSpan={4} className="config-feriado-separador">
                      Já passaram
                    </td>
                  </tr>
                )}
                {passados.map((f) => linha(f, true))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <Flag size={20} />
            Feriados nacionais de {ano}
          </h2>
          <div className="badge-wrapper">
            <span className="badge badge-muted">Automáticos • não precisa cadastrar</span>
          </div>
        </div>
        <div className="formatter-sheets-list">
          {nacionais.map((f) => (
            <span key={f.data} className="ura-check opcional" title={diaDaSemana(f.data)}>
              {isoParaBr(f.data).slice(0, 5)} • {f.descricao}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
