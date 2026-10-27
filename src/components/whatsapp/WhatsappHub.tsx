import React, { useEffect, useRef, useState } from 'react';
import { Download, FileJson, FileUp, MessageCircle, Upload, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { NotificationType } from '../../types/task';
import { MapaWhatsapp } from '../../types/whatsapp';
import { useWhatsappBaias } from '../../hooks/useWhatsappBaias';
import { codigoDoLugar } from '../../utils/mapaMesas';
import { baixarPlanilha } from '../../utils/planilhaColorida';
import { ResumoWhatsapp, exportarMapa, importarMapa, resumoDaSala, resumoGeral } from '../../utils/whatsappBaias';
import {
  gerarPlanilhaWhatsapp,
  gradeDaPlanilha,
  importarPlanilhaWhatsapp,
  nomeDaPlanilhaWhatsapp,
} from '../../utils/whatsappPlanilha';
import { CampoCelular, CelularesCorporativos } from './CelularesCorporativos';
import { FiltroMapa, MapaMesa } from './MapaMesa';
import { PainelLugar } from './PainelLugar';
import { ConfigurarMesas } from './ConfigurarMesas';

interface WhatsappHubProps {
  onNotify: (message: string, type?: NotificationType) => void;
}

type Selecao =
  | { tipo: 'lugar'; salaId: string; mesaId: string; posicao: string }
  | { tipo: 'celular'; cor: string; campo: CampoCelular };

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()} às ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
};
const hojeArquivo = (d: Date) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

const FILTROS: [FiltroMapa, string][] = [
  ['todas', 'Todas'],
  ['problemas', 'Só problemas'],
  ['vazias', 'Vagas vazias'],
];

const NOME_CAMPO: Record<CampoCelular, string> = { messenger: 'Messenger', business: 'Business' };

/** Chips de contagem (OK, BANIDO, RESTRINGIDO, NÃO TEM, vagas vazias) */
const Contagens: React.FC<{ resumo: ResumoWhatsapp }> = ({ resumo }) => (
  <div className="wpp-contagens">
    <span className="wpp-contagem wpp-ok">
      <span className="wpp-bolinha" aria-hidden="true" />
      {resumo.ok} OK
    </span>
    <span className="wpp-contagem wpp-banido">
      <span className="wpp-bolinha" aria-hidden="true" />
      {resumo.banido} banido(s)
    </span>
    <span className="wpp-contagem wpp-restringido">
      <span className="wpp-bolinha" aria-hidden="true" />
      {resumo.restringido} restringido(s){resumo.vencidas > 0 ? ` · ${resumo.vencidas} vencida(s)` : ''}
    </span>
    <span className="wpp-contagem wpp-nao_tem">
      <span className="wpp-bolinha" aria-hidden="true" />
      {resumo.naoTem} não tem
    </span>
    <span className="wpp-contagem vazia">{resumo.vagasVazias} vaga(s) vazia(s)</span>
  </div>
);

export const WhatsappHub: React.FC<WhatsappHubProps> = ({ onNotify }) => {
  const wpp = useWhatsappBaias();
  const { mapa } = wpp;
  const [agora, setAgora] = useState(() => new Date());
  const [filtro, setFiltro] = useState<FiltroMapa>('todas');
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [previa, setPrevia] = useState<{ arquivo: string; mapa: MapaWhatsapp; avisos: string[] } | null>(null);
  const planilhaRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  // Mapa salvo ilegível: avisa uma vez (a cópia já foi guardada pelo hook)
  useEffect(() => {
    if (wpp.avisoInicial) onNotify(wpp.avisoInicial, 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // O tempo restante das restrições anda sozinho
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const geral = resumoGeral(mapa, agora);
  const problemas = geral.banido + geral.restringido + geral.naoTem;

  const handleBaixarPlanilha = async () => {
    try {
      const momento = new Date();
      await baixarPlanilha(await gerarPlanilhaWhatsapp(mapa, momento), nomeDaPlanilhaWhatsapp(momento));
      onNotify('Download da planilha iniciado!', 'success');
    } catch (err: any) {
      onNotify(`Erro ao gerar a planilha: ${err.message}`, 'error');
    }
  };

  const handleImportarPlanilha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      const livro = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
      const { mapa: lido, avisos } = importarPlanilhaWhatsapp(gradeDaPlanilha(livro), new Date());
      setPrevia({ arquivo: arquivo.name, mapa: lido, avisos });
    } catch (err: any) {
      onNotify(err.message || 'Não consegui ler a planilha.', 'error');
    }
  };

  const handleSubstituir = () => {
    if (!previa) return;
    wpp.substituir(previa.mapa);
    setSelecao(null);
    setPrevia(null);
    onNotify(`Mapa atualizado pela planilha ${previa.arquivo}.`, 'success');
  };

  const handleExportarMapa = () => {
    const blob = new Blob([exportarMapa(mapa, new Date())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mapa_whatsapp_${hojeArquivo(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('Mapa exportado.', 'success');
  };

  const handleImportarMapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      const lido = importarMapa(await arquivo.text());
      if (!window.confirm(`Substituir o mapa atual pelo do arquivo ${arquivo.name}?`)) return;
      wpp.substituir(lido);
      setSelecao(null);
      onNotify('Mapa importado.', 'success');
    } catch (err: any) {
      onNotify(err.message, 'error');
    }
  };

  // Painel do que está selecionado
  const painel = (() => {
    if (!selecao) return null;
    if (selecao.tipo === 'celular') {
      const cel = mapa.celulares.find((c) => c.cor === selecao.cor);
      if (!cel) return null;
      return (
        <PainelLugar
          titulo={`Celular ${cel.cor}`}
          subtitulo={`WhatsApp ${NOME_CAMPO[selecao.campo]}`}
          estado={cel[selecao.campo]}
          onEstado={(novo) => wpp.alterarCelular(cel.cor, selecao.campo, novo)}
          agora={agora}
          onFechar={() => setSelecao(null)}
        />
      );
    }
    const sala = mapa.salas.find((s) => s.id === selecao.salaId);
    const mesa = sala?.mesas.find((m) => m.id === selecao.mesaId);
    const lugar = mesa?.lugares[selecao.posicao];
    if (!sala || !mesa || !lugar) return null;
    const { posicao } = selecao;
    const nome =
      posicao === 'SUP'
        ? { rotulo: 'Supervisor', valor: mesa.supervisor, podeEsvaziar: false, onChange: (v: string) => wpp.alterarMesa(sala.id, mesa.id, { supervisor: v }) }
        : {
            rotulo: posicao === 'SUB' ? 'Backup (nome, opcional)' : 'Operador',
            valor: lugar.operador,
            podeEsvaziar: posicao !== 'SUB',
            onChange: (v: string) => wpp.alterarLugar(sala.id, mesa.id, posicao, { operador: v }),
          };
    return (
      <PainelLugar
        titulo={codigoDoLugar(mesa.sigla, posicao)}
        subtitulo={`${mesa.nome} · ${sala.nome}`}
        nome={nome}
        estado={lugar.whatsapp}
        onEstado={(novo) => wpp.alterarLugar(sala.id, mesa.id, posicao, { whatsapp: novo })}
        agora={agora}
        onFechar={() => setSelecao(null)}
      />
    );
  })();

  return (
    <div className={`formatter-root wpp-root ${painel ? 'com-painel' : ''}`}>
      <header className="formatter-header">
        <div className="formatter-header-info">
          <p className="eyebrow">AUTOMAÇÕES & DADOS</p>
          <h1>
            <MessageCircle size={32} />
            WhatsApp das Baias
          </h1>
          <p>
            Mapa das mesas com a situação do WhatsApp de cada lugar. Clique numa baia para trocar o operador ou a
            situação; tudo fica salvo neste navegador. Atualizado em {dataHora(mapa.atualizadoEm)}.
          </p>
        </div>
        <div className="task-count">
          <span className="task-count-number">{problemas}</span>
          <span className="task-count-label">com problema</span>
        </div>
      </header>

      <input type="file" ref={planilhaRef} accept=".xlsx,.xls" onChange={handleImportarPlanilha} style={{ display: 'none' }} />
      <input type="file" ref={jsonRef} accept=".json,application/json" onChange={handleImportarMapa} style={{ display: 'none' }} />

      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <Users size={20} />
            Resumo
          </h2>
          <div className="formatter-actions-buttons escala-acoes">
            <button type="button" className="btn btn-primary" onClick={handleBaixarPlanilha}>
              <Download size={16} />
              Baixar planilha
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => planilhaRef.current?.click()}>
              <Upload size={16} />
              Importar planilha
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExportarMapa}>
              <FileJson size={16} />
              Exportar mapa
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => jsonRef.current?.click()}>
              <FileUp size={16} />
              Importar mapa
            </button>
          </div>
        </div>

        <Contagens resumo={geral} />
        {mapa.salas.length > 1 && (
          <div className="wpp-resumo-salas">
            {mapa.salas.map((s) => (
              <div key={s.id}>
                <strong>{s.nome}</strong>
                <Contagens resumo={resumoDaSala(s, agora)} />
              </div>
            ))}
          </div>
        )}

        <div className="wpp-filtros" role="group" aria-label="Filtro do mapa">
          {FILTROS.map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              className={`wpp-filtro ${filtro === id ? 'ativo' : ''}`}
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {previa && (
        <div className="formatter-card wpp-previa">
          <div className="formatter-card-header">
            <h2 className="formatter-card-title">
              <Upload size={20} />
              Importar {previa.arquivo}
            </h2>
          </div>
          <p>
            {previa.mapa.salas.map((s) => `${s.nome}: ${s.mesas.length} equipe(s)`).join(' · ')} ·{' '}
            {previa.mapa.celulares.length} celular(es) · {previa.avisos.length} aviso(s)
          </p>
          {previa.avisos.map((a) => (
            <div key={a} className="escala-aviso">
              {a}
            </div>
          ))}
          <p className="ura-ajuda">O mapa atual (operadores, situações e mesas) será substituído pelo da planilha.</p>
          <div className="formatter-actions-buttons escala-acoes">
            <button type="button" className="btn btn-primary" onClick={handleSubstituir}>
              Substituir mapa
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPrevia(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mapa.salas.map((sala) => (
        <section key={sala.id} className="formatter-card wpp-sala" aria-label={sala.nome}>
          <div className="formatter-card-header">
            <h2 className="formatter-card-title">{sala.nome}</h2>
            <Contagens resumo={resumoDaSala(sala, agora)} />
          </div>
          <div className="wpp-legenda" aria-hidden="true">
            <span className="wpp-ok"><span className="wpp-bolinha" />OK</span>
            <span className="wpp-banido"><span className="wpp-bolinha" />Banido</span>
            <span className="wpp-restringido"><span className="wpp-bolinha" />Restringido</span>
            <span className="wpp-nao_tem"><span className="wpp-bolinha" />Não tem</span>
            <span className="vazia"><span className="wpp-bolinha" />Vaga vazia</span>
          </div>
          <div className="wpp-mesas">
            {sala.mesas.map((mesa) => (
              <div key={mesa.id} className="wpp-mesa-cartao">
                <button
                  type="button"
                  className="wpp-mesa-titulo"
                  onClick={() => setSelecao({ tipo: 'lugar', salaId: sala.id, mesaId: mesa.id, posicao: 'SUP' })}
                  title="Editar o supervisor"
                  disabled={!mesa.lugares.SUP}
                >
                  <strong>{mesa.nome}</strong>
                  <span>
                    {mesa.sigla} · {mesa.supervisor || 'sem supervisor'}
                  </span>
                </button>
                <MapaMesa
                  mesa={mesa}
                  filtro={filtro}
                  agora={agora}
                  selecionado={
                    selecao?.tipo === 'lugar' && selecao.mesaId === mesa.id ? selecao.posicao : null
                  }
                  onSelecionar={(posicao) => setSelecao({ tipo: 'lugar', salaId: sala.id, mesaId: mesa.id, posicao })}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <CelularesCorporativos
        celulares={mapa.celulares}
        agora={agora}
        selecionado={selecao?.tipo === 'celular' ? { cor: selecao.cor, campo: selecao.campo } : null}
        onSelecionar={(cor, campo) => setSelecao({ tipo: 'celular', cor, campo })}
      />

      <ConfigurarMesas mapa={mapa} onMapa={wpp.substituir} onNotify={onNotify} />

      {painel}
    </div>
  );
};
