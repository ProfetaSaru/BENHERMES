import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  User,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Key,
  Mail,
  Activity,
  PhoneCall,
  FileText,
  Building,
  Users,
  Briefcase,
  ChevronRight,
  Sparkles,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Task } from '../../types/task';
import { calculateTMA } from '../../utils/markdownTemplateParser';

export type ReportVisualMode = 'cards' | 'terminal' | 'executive';

export interface ReportVisualRendererProps {
  templateId?: string;
  visualMode: ReportVisualMode;
  tasks: Task[];
  fieldValues?: Record<string, string>;
  rawReportText: string;
  title?: string;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (id: string, title: string) => void;
}

export function calculateDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '';
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  if (mins === 0) return '0 min';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

export const ReportVisualRenderer: React.FC<ReportVisualRendererProps> = ({
  templateId = 'atividades-padrao',
  visualMode,
  tasks,
  fieldValues = {},
  title,
  onEditTask,
  onDeleteTask,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopySnippet = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  // Helper para agrupar categorias do relatório de produtividade
  const isCategory = (t: Task, pattern: string) => {
    const cat = (t.category || '').toLowerCase();
    return cat.includes(pattern);
  };

  const desbloqueados = tasks.filter((t) => isCategory(t, 'desbloquead'));
  const formalizados = tasks.filter((t) => isCategory(t, 'formaliza'));
  const anuencia = tasks.filter((t) => isCategory(t, 'anuencia') || isCategory(t, 'anuência'));
  const tentativas = tasks.filter((t) => isCategory(t, 'tentativa'));

  const totalFinalizados = tasks.filter((t) => !isCategory(t, 'tentativa') && !!t.end).length;
  const tmaCalculado = calculateTMA(tasks);

  // -------------------------------------------------------------
  // RENDERIZADOR 1: PRODUTIVIDADE & TMA (produtividade-atendimento)
  // -------------------------------------------------------------
  if (templateId === 'produtividade-atendimento') {
    const operador = fieldValues.nome_colaborador?.trim() || 'COLABORADOR';

    if (visualMode === 'terminal') {
      return (
        <div className="report-terminal-view">
          <div className="terminal-header-bar">
            <div className="terminal-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="terminal-title">BENHERMES-CLI // PRODUTIVIDADE & TMA</span>
            <span className="terminal-badge">SISTEMA BENZAITEN</span>
          </div>

          <div className="terminal-body">
            <div className="term-line prompt-line">
              <span className="term-prompt">$</span>
              <span className="term-cmd">relatorio --operador="{operador.toUpperCase()}" --status=consolidado</span>
            </div>

            <div className="term-box-header">
              ============================================================<br />
              RELATÓRIO DE PRODUTIVIDADE: {operador.toUpperCase()}<br />
              ============================================================
            </div>

            {/* Desbloqueados */}
            <div className="term-section">
              <span className="term-tag tag-green">&gt;&gt;&gt; DESBLOQUEADOS (Total: {desbloqueados.length})</span>
              {desbloqueados.length === 0 ? (
                <div className="term-sub-line term-muted">*(Nenhum registro)*</div>
              ) : (
                desbloqueados.map((t) => (
                  <div key={t.id} className="term-item-line">
                    <span className="term-time">&lt;{t.start} – {t.end || '--:--'}&gt;</span>
                    <span className="term-cpf">CPF: {t.title.toUpperCase()}</span>
                    {t.end && <span className="term-duration">({calculateDuration(t.start, t.end)})</span>}
                    {(onEditTask || onDeleteTask) && (
                      <span className="term-item-actions">
                        {onEditTask && (
                          <button
                            type="button"
                            className="term-mini-btn"
                            onClick={() => onEditTask(t)}
                            title="Editar atendimento"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            className="term-mini-btn term-mini-danger"
                            onClick={() => onDeleteTask(t.id, t.title)}
                            title="Excluir atendimento"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Formalização */}
            <div className="term-section">
              <span className="term-tag tag-blue">&gt;&gt;&gt; FORMALIZAÇÃO (Total: {formalizados.length})</span>
              {formalizados.length === 0 ? (
                <div className="term-sub-line term-muted">*(Nenhum registro)*</div>
              ) : (
                formalizados.map((t) => (
                  <div key={t.id} className="term-item-line">
                    <span className="term-time">&lt;{t.start} – {t.end || '--:--'}&gt;</span>
                    <span className="term-cpf">CPF: {t.title.toUpperCase()}</span>
                    {t.end && <span className="term-duration">({calculateDuration(t.start, t.end)})</span>}
                    {(onEditTask || onDeleteTask) && (
                      <span className="term-item-actions">
                        {onEditTask && (
                          <button
                            type="button"
                            className="term-mini-btn"
                            onClick={() => onEditTask(t)}
                            title="Editar atendimento"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            className="term-mini-btn term-mini-danger"
                            onClick={() => onDeleteTask(t.id, t.title)}
                            title="Excluir atendimento"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Anuência */}
            <div className="term-section">
              <span className="term-tag tag-amber">&gt;&gt;&gt; ANUÊNCIA (Total: {anuencia.length})</span>
              {anuencia.length === 0 ? (
                <div className="term-sub-line term-muted">*(Nenhum registro)*</div>
              ) : (
                anuencia.map((t) => (
                  <div key={t.id} className="term-item-line">
                    <span className="term-time">&lt;{t.start} – {t.end || '--:--'}&gt;</span>
                    <span className="term-cpf">CPF: {t.title.toUpperCase()}</span>
                    {t.end && <span className="term-duration">({calculateDuration(t.start, t.end)})</span>}
                    {(onEditTask || onDeleteTask) && (
                      <span className="term-item-actions">
                        {onEditTask && (
                          <button
                            type="button"
                            className="term-mini-btn"
                            onClick={() => onEditTask(t)}
                            title="Editar atendimento"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            className="term-mini-btn term-mini-danger"
                            onClick={() => onDeleteTask(t.id, t.title)}
                            title="Excluir atendimento"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Tentativas */}
            <div className="term-section">
              <span className="term-tag tag-muted">&gt;&gt;&gt; TENTATIVAS DE CONTATO (Total: {tentativas.length})</span>
              {tentativas.length === 0 ? (
                <div className="term-sub-line term-muted">*(Nenhuma tentativa registrada)*</div>
              ) : (
                tentativas.map((t) => (
                  <div key={t.id} className="term-item-line">
                    <span className="term-time">&lt;{t.start}&gt;</span>
                    <span className="term-cpf">CPF: {t.title.toUpperCase()}</span>
                    <span className="term-muted">· Tentativa registrada</span>
                    {(onEditTask || onDeleteTask) && (
                      <span className="term-item-actions">
                        {onEditTask && (
                          <button
                            type="button"
                            className="term-mini-btn"
                            onClick={() => onEditTask(t)}
                            title="Editar tentativa"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            className="term-mini-btn term-mini-danger"
                            onClick={() => onDeleteTask(t.id, t.title)}
                            title="Excluir tentativa"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Rodapé Terminal */}
            <div className="term-footer-metrics">
              <span className="term-stat-pill pill-primary">FINALIZADOS: {totalFinalizados}</span>
              <span className="term-stat-pill pill-cyan">TMA MÉDIO: {tmaCalculado}</span>
              <span className="term-stat-pill pill-success">SISTEMA ATIVO</span>
            </div>
          </div>
        </div>
      );
    }

    if (visualMode === 'cards') {
      return (
        <div className="report-cards-view">
          {/* Header & Operador */}
          <div className="cards-hero-bar">
            <div className="cards-hero-info">
              <span className="cards-hero-tag">
                <Activity size={13} />
                Produtividade Operacional
              </span>
              <h2 className="cards-hero-title">{operador.toUpperCase()}</h2>
            </div>
            <div className="cards-hero-date">
              <Calendar size={13} />
              <span>{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {/* KPI Dashboard */}
          <div className="kpi-dashboard-grid">
            <div className="kpi-card card-desbloqueados">
              <span className="kpi-label">Desbloqueados</span>
              <span className="kpi-value">{desbloqueados.length}</span>
              <span className="kpi-sub">Finalizados</span>
            </div>

            <div className="kpi-card card-formalizados">
              <span className="kpi-label">Formalização</span>
              <span className="kpi-value">{formalizados.length}</span>
              <span className="kpi-sub">Concluídos</span>
            </div>

            <div className="kpi-card card-anuencia">
              <span className="kpi-label">Anuência</span>
              <span className="kpi-value">{anuencia.length}</span>
              <span className="kpi-sub">Confirmadas</span>
            </div>

            <div className="kpi-card card-total">
              <span className="kpi-label">Total Finalizado</span>
              <span className="kpi-value">{totalFinalizados}</span>
              <span className="kpi-sub">Atendimentos</span>
            </div>

            <div className="kpi-card card-tma">
              <span className="kpi-label">TMA Médio</span>
              <span className="kpi-value">{tmaCalculado}</span>
              <span className="kpi-sub">Por Atendimento</span>
            </div>
          </div>

          {/* Cards por Etapa */}
          <div className="cards-sections-stack">
            {/* Desbloqueados */}
            <div className="cards-group">
              <div className="cards-group-header">
                <span className="group-badge badge-green">Desbloqueados ({desbloqueados.length})</span>
              </div>
              <div className="cards-items-grid">
                {desbloqueados.length === 0 ? (
                  <div className="cards-empty-box">Nenhum desbloqueio registrado</div>
                ) : (
                  desbloqueados.map((t) => (
                    <div key={t.id} className="item-card item-card-green">
                      <div className="item-card-top">
                        <span className="item-time-pill">
                          <Clock size={12} />
                          {t.start} – {t.end || '--:--'}
                        </span>
                        {t.end && (
                          <span className="item-duration-pill">{calculateDuration(t.start, t.end)}</span>
                        )}
                        {(onEditTask || onDeleteTask) && (
                          <div className="item-actions-compact">
                            {onEditTask && (
                              <button
                                type="button"
                                className="item-action-btn edit"
                                onClick={() => onEditTask(t)}
                                title="Editar"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                            {onDeleteTask && (
                              <button
                                type="button"
                                className="item-action-btn delete"
                                onClick={() => onDeleteTask(t.id, t.title)}
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <strong className="item-cpf-text">{t.title.toUpperCase()}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Formalização */}
            <div className="cards-group">
              <div className="cards-group-header">
                <span className="group-badge badge-blue">Formalização ({formalizados.length})</span>
              </div>
              <div className="cards-items-grid">
                {formalizados.length === 0 ? (
                  <div className="cards-empty-box">Nenhuma formalização registrada</div>
                ) : (
                  formalizados.map((t) => (
                    <div key={t.id} className="item-card item-card-blue">
                      <div className="item-card-top">
                        <span className="item-time-pill">
                          <Clock size={12} />
                          {t.start} – {t.end || '--:--'}
                        </span>
                        {t.end && (
                          <span className="item-duration-pill">{calculateDuration(t.start, t.end)}</span>
                        )}
                        {(onEditTask || onDeleteTask) && (
                          <div className="item-actions-compact">
                            {onEditTask && (
                              <button
                                type="button"
                                className="item-action-btn edit"
                                onClick={() => onEditTask(t)}
                                title="Editar"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                            {onDeleteTask && (
                              <button
                                type="button"
                                className="item-action-btn delete"
                                onClick={() => onDeleteTask(t.id, t.title)}
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <strong className="item-cpf-text">{t.title.toUpperCase()}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Anuência */}
            <div className="cards-group">
              <div className="cards-group-header">
                <span className="group-badge badge-amber">Anuência ({anuencia.length})</span>
              </div>
              <div className="cards-items-grid">
                {anuencia.length === 0 ? (
                  <div className="cards-empty-box">Nenhuma anuência registrada</div>
                ) : (
                  anuencia.map((t) => (
                    <div key={t.id} className="item-card item-card-amber">
                      <div className="item-card-top">
                        <span className="item-time-pill">
                          <Clock size={12} />
                          {t.start} – {t.end || '--:--'}
                        </span>
                        {t.end && (
                          <span className="item-duration-pill">{calculateDuration(t.start, t.end)}</span>
                        )}
                        {(onEditTask || onDeleteTask) && (
                          <div className="item-actions-compact">
                            {onEditTask && (
                              <button
                                type="button"
                                className="item-action-btn edit"
                                onClick={() => onEditTask(t)}
                                title="Editar"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                            {onDeleteTask && (
                              <button
                                type="button"
                                className="item-action-btn delete"
                                onClick={() => onDeleteTask(t.id, t.title)}
                                title="Excluir"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <strong className="item-cpf-text">{t.title.toUpperCase()}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tentativas de Contato */}
            {tentativas.length > 0 && (
              <div className="cards-group">
                <div className="cards-group-header">
                  <span className="group-badge badge-muted">
                    <PhoneCall size={12} />
                    Tentativas de Contato ({tentativas.length})
                  </span>
                </div>
                <div className="chips-cloud">
                  {tentativas.map((t) => (
                    <span key={t.id} className="contact-attempt-chip">
                      <span className="attempt-cpf">{t.title.toUpperCase()}</span>
                      <span className="attempt-time">{t.start}</span>
                      {(onEditTask || onDeleteTask) && (
                        <span className="chip-actions">
                          {onEditTask && (
                            <button
                              type="button"
                              className="chip-action-btn"
                              onClick={() => onEditTask(t)}
                              title="Editar"
                            >
                              <Pencil size={10} />
                            </button>
                          )}
                          {onDeleteTask && (
                            <button
                              type="button"
                              className="chip-action-btn delete"
                              onClick={() => onDeleteTask(t.id, t.title)}
                              title="Excluir"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // visualMode === 'executive'
    return (
      <div className="report-executive-view">
        <div className="exec-letterhead">
          <div className="exec-title-row">
            <div>
              <span className="exec-kicker">BENCONSIG // CONTROLE OPERACIONAL</span>
              <h2 className="exec-heading">PAINEL DE PRODUTIVIDADE & TMA</h2>
            </div>
            <div className="exec-stamp">CONFERIDO</div>
          </div>

          <div className="exec-meta-grid">
            <div className="meta-cell">
              <span className="meta-label">Colaborador:</span>
              <span className="meta-value">{operador.toUpperCase()}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Data de Referência:</span>
              <span className="meta-value">{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Total Finalizado:</span>
              <span className="meta-value">{totalFinalizados} atendimentos</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">TMA Médio:</span>
              <span className="meta-value">{tmaCalculado}</span>
            </div>
          </div>
        </div>

        <div className="exec-table-wrap">
          <table className="exec-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Etapa Operacional</th>
                <th style={{ width: '38%' }}>Identificador / CPF</th>
                <th style={{ width: '18%' }}>Horário</th>
                <th style={{ width: '12%' }}>Duração</th>
                {(onEditTask || onDeleteTask) && <th style={{ width: '10%', textAlign: 'center' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={(onEditTask || onDeleteTask) ? 5 : 4} className="exec-empty-cell">Nenhum atendimento registrado no momento.</td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="exec-stage-pill">{t.category || 'Atendimento'}</span>
                    </td>
                    <td>
                      <strong>{t.title.toUpperCase()}</strong>
                    </td>
                    <td>{t.start} {t.end ? `– ${t.end}` : ''}</td>
                    <td>{t.end ? calculateDuration(t.start, t.end) : '--'}</td>
                    {(onEditTask || onDeleteTask) && (
                      <td style={{ textAlign: 'center' }}>
                        <div className="exec-row-actions">
                          {onEditTask && (
                            <button
                              type="button"
                              className="exec-action-btn edit"
                              onClick={() => onEditTask(t)}
                              title="Editar"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {onDeleteTask && (
                            <button
                              type="button"
                              className="exec-action-btn delete"
                              onClick={() => onDeleteTask(t.id, t.title)}
                              title="Excluir"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {tasks.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <strong>Resumo Consolidado: {totalFinalizados} Concluídos</strong>
                  </td>
                  <td colSpan={(onEditTask || onDeleteTask) ? 3 : 2} style={{ textAlign: 'right' }}>
                    <strong>TMA Geral: {tmaCalculado}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDERIZADOR 2: NOVO COLABORADOR (novo-colaborador)
  // -------------------------------------------------------------
  if (templateId === 'novo-colaborador') {
    const nome = fieldValues.nome_completo?.trim() || 'NOVO COLABORADOR';
    const setor = fieldValues.setor?.trim() || 'Operações';
    const equipe = fieldValues.equipe?.trim() || 'Geral';
    const periodo = fieldValues.periodo?.trim() || '08:00 - 17:00';

    const loginVanguard = fieldValues.login_vanguard || '';
    const senhaVanguard = fieldValues.senha_vanguard || '';
    const linkVanguard = fieldValues.link_vanguard || 'https://gestao.sistemacorban.com.br/index.php/';

    const loginArgus = fieldValues.login_argus || '';
    const senhaArgus = fieldValues.senha_argus || '';

    const nomeBenhub = fieldValues.nome_benhub || '';
    const emailBenhub = fieldValues.email_benhub || '';
    const senhaBenhub = fieldValues.senha_benhub || '';

    if (visualMode === 'terminal') {
      return (
        <div className="report-terminal-view">
          <div className="terminal-header-bar">
            <div className="terminal-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="terminal-title">BENHERMES-CLI // PROVISÃO DE ACESSOS TI</span>
            <span className="terminal-badge">BENCONSIG TI</span>
          </div>

          <div className="terminal-body">
            <div className="term-box-header">
              ============================================================<br />
              CREDENCIAIS DE ACESSO: {nome.toUpperCase()}<br />
              SETOR: {setor.toUpperCase()} | EQUIPE: {equipe.toUpperCase()} | EXPEDIENTE: {periodo}<br />
              ============================================================
            </div>

            <div className="term-section">
              <span className="term-tag tag-blue">&gt;&gt;&gt; SISTEMA VANGUARD (CORBAN)</span>
              <div className="term-item-line">
                <span className="term-prompt">LOGIN:</span>
                <span className="term-cpf">{loginVanguard || '[NÃO DEFINIDO]'}</span>
                <button
                  type="button"
                  className="term-mini-btn"
                  onClick={() => handleCopySnippet(loginVanguard, 'vanguard-login')}
                >
                  {copiedField === 'vanguard-login' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              <div className="term-item-line">
                <span className="term-prompt">SENHA:</span>
                <span className="term-cpf">{senhaVanguard || '[NÃO DEFINIDO]'}</span>
                <button
                  type="button"
                  className="term-mini-btn"
                  onClick={() => handleCopySnippet(senhaVanguard, 'vanguard-pass')}
                >
                  {copiedField === 'vanguard-pass' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              <div className="term-item-line">
                <span className="term-prompt">LINK :</span>
                <span className="term-muted">{linkVanguard}</span>
              </div>
            </div>

            <div className="term-section">
              <span className="term-tag tag-green">&gt;&gt;&gt; SISTEMA ARGUS</span>
              <div className="term-item-line">
                <span className="term-prompt">LOGIN:</span>
                <span className="term-cpf">{loginArgus || '[NÃO DEFINIDO]'}</span>
                <button
                  type="button"
                  className="term-mini-btn"
                  onClick={() => handleCopySnippet(loginArgus, 'argus-login')}
                >
                  {copiedField === 'argus-login' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              <div className="term-item-line">
                <span className="term-prompt">SENHA:</span>
                <span className="term-cpf">{senhaArgus || '[NÃO DEFINIDO]'}</span>
                <button
                  type="button"
                  className="term-mini-btn"
                  onClick={() => handleCopySnippet(senhaArgus, 'argus-pass')}
                >
                  {copiedField === 'argus-pass' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>

            <div className="term-section">
              <span className="term-tag tag-amber">&gt;&gt;&gt; E-MAIL &amp; BENHUB</span>
              <div className="term-item-line">
                <span className="term-prompt">NOME :</span>
                <span className="term-cpf">{nomeBenhub || nome}</span>
              </div>
              <div className="term-item-line">
                <span className="term-prompt">EMAIL:</span>
                <span className="term-cpf">{emailBenhub || '[NÃO DEFINIDO]'}</span>
                <button
                  type="button"
                  className="term-mini-btn"
                  onClick={() => handleCopySnippet(emailBenhub, 'benhub-email')}
                >
                  {copiedField === 'benhub-email' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              <div className="term-item-line">
                <span className="term-prompt">SENHA:</span>
                <span className="term-cpf">{senhaBenhub || '[NÃO DEFINIDO]'}</span>
                <button
                  type="button"
                  className="term-mini-btn"
                  onClick={() => handleCopySnippet(senhaBenhub, 'benhub-pass')}
                >
                  {copiedField === 'benhub-pass' ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>

            <div className="term-footer-metrics">
              <span className="term-stat-pill pill-cyan">STATUS: PROVISIONADO</span>
              <span className="term-stat-pill pill-primary">TROCAR SENHAS NO 1º ACESSO</span>
            </div>
          </div>
        </div>
      );
    }

    if (visualMode === 'cards') {
      return (
        <div className="report-cards-view">
          {/* Hero Colaborador */}
          <div className="cards-hero-bar hero-blue">
            <div className="cards-hero-info">
              <span className="cards-hero-tag">
                <User size={13} />
                Ficha de Integração &amp; Acessos
              </span>
              <h2 className="cards-hero-title">{nome.toUpperCase()}</h2>
              <div className="hero-sub-pills">
                <span className="hero-sub-pill"><Building size={12} /> {setor}</span>
                <span className="hero-sub-pill"><Users size={12} /> Equipe: {equipe}</span>
                <span className="hero-sub-pill"><Clock size={12} /> {periodo}</span>
              </div>
            </div>
          </div>

          {/* 3 Cards de Sistemas */}
          <div className="system-credentials-grid">
            {/* Vanguard */}
            <div className="system-card card-vanguard">
              <div className="system-card-header">
                <div className="system-title-box">
                  <Shield size={16} className="system-icon-vanguard" />
                  <strong>Sistema Vanguard</strong>
                </div>
                {linkVanguard && (
                  <a
                    href={linkVanguard}
                    target="_blank"
                    rel="noreferrer"
                    className="system-link-pill"
                    title="Abrir ambiente no navegador"
                  >
                    Acessar <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div className="system-fields-body">
                <div className="cred-field-row">
                  <span className="cred-field-label">Login:</span>
                  <code className="cred-code">{loginVanguard || '—'}</code>
                  {loginVanguard && (
                    <button
                      type="button"
                      className="cred-copy-btn"
                      onClick={() => handleCopySnippet(loginVanguard, 'card-vanguard-user')}
                    >
                      {copiedField === 'card-vanguard-user' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
                <div className="cred-field-row">
                  <span className="cred-field-label">Senha:</span>
                  <code className="cred-code">{senhaVanguard || '—'}</code>
                  {senhaVanguard && (
                    <button
                      type="button"
                      className="cred-copy-btn"
                      onClick={() => handleCopySnippet(senhaVanguard, 'card-vanguard-pass')}
                    >
                      {copiedField === 'card-vanguard-pass' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Argus */}
            <div className="system-card card-argus">
              <div className="system-card-header">
                <div className="system-title-box">
                  <Key size={16} className="system-icon-argus" />
                  <strong>Sistema Argus</strong>
                </div>
              </div>
              <div className="system-fields-body">
                <div className="cred-field-row">
                  <span className="cred-field-label">Login:</span>
                  <code className="cred-code">{loginArgus || '—'}</code>
                  {loginArgus && (
                    <button
                      type="button"
                      className="cred-copy-btn"
                      onClick={() => handleCopySnippet(loginArgus, 'card-argus-user')}
                    >
                      {copiedField === 'card-argus-user' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
                <div className="cred-field-row">
                  <span className="cred-field-label">Senha:</span>
                  <code className="cred-code">{senhaArgus || '—'}</code>
                  {senhaArgus && (
                    <button
                      type="button"
                      className="cred-copy-btn"
                      onClick={() => handleCopySnippet(senhaArgus, 'card-argus-pass')}
                    >
                      {copiedField === 'card-argus-pass' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* BenHub */}
            <div className="system-card card-benhub">
              <div className="system-card-header">
                <div className="system-title-box">
                  <Mail size={16} className="system-icon-benhub" />
                  <strong>E-mail &amp; BenHub</strong>
                </div>
              </div>
              <div className="system-fields-body">
                <div className="cred-field-row">
                  <span className="cred-field-label">Nome:</span>
                  <span className="cred-plain">{nomeBenhub || nome}</span>
                </div>
                <div className="cred-field-row">
                  <span className="cred-field-label">E-mail:</span>
                  <code className="cred-code">{emailBenhub || '—'}</code>
                  {emailBenhub && (
                    <button
                      type="button"
                      className="cred-copy-btn"
                      onClick={() => handleCopySnippet(emailBenhub, 'card-benhub-email')}
                    >
                      {copiedField === 'card-benhub-email' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
                <div className="cred-field-row">
                  <span className="cred-field-label">Senha:</span>
                  <code className="cred-code">{senhaBenhub || '—'}</code>
                  {senhaBenhub && (
                    <button
                      type="button"
                      className="cred-copy-btn"
                      onClick={() => handleCopySnippet(senhaBenhub, 'card-benhub-pass')}
                    >
                      {copiedField === 'card-benhub-pass' ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // visualMode === 'executive'
    return (
      <div className="report-executive-view">
        <div className="exec-letterhead">
          <div className="exec-title-row">
            <div>
              <span className="exec-kicker">BENCONSIG // RECURSOS HUMANOS &amp; TI</span>
              <h2 className="exec-heading">TERMO DE ENTREGA DE CREDENCIAIS DE ACESSO</h2>
            </div>
            <div className="exec-stamp">AUTORIZADO</div>
          </div>

          <div className="exec-meta-grid">
            <div className="meta-cell">
              <span className="meta-label">Colaborador(a):</span>
              <span className="meta-value">{nome.toUpperCase()}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Setor / Equipe:</span>
              <span className="meta-value">{setor} — {equipe}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Horário de Trabalho:</span>
              <span className="meta-value">{periodo}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Emissão:</span>
              <span className="meta-value">{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>

        <div className="exec-table-wrap">
          <table className="exec-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Sistema Autorizado</th>
                <th style={{ width: '35%' }}>Usuário / E-mail</th>
                <th style={{ width: '25%' }}>Senha Provisória</th>
                <th style={{ width: '15%' }}>Ambiente</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Vanguard (Corban)</strong></td>
                <td><code>{loginVanguard || '—'}</code></td>
                <td><code>{senhaVanguard || '—'}</code></td>
                <td>Web</td>
              </tr>
              <tr>
                <td><strong>Argus</strong></td>
                <td><code>{loginArgus || '—'}</code></td>
                <td><code>{senhaArgus || '—'}</code></td>
                <td>Desktop / Web</td>
              </tr>
              <tr>
                <td><strong>E-mail &amp; BenHub</strong></td>
                <td><code>{emailBenhub || '—'}</code></td>
                <td><code>{senhaBenhub || '—'}</code></td>
                <td>Nuvem</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="exec-callout callout-info">
          <strong>Orientações de Segurança:</strong> As senhas fornecidas são provisórias e de uso pessoal e intransferível. Por determinação da Segurança da Informação, altere-as imediatamente no primeiro acesso aos sistemas.
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDERIZADOR 3: PASSAGEM DE PLANTÃO (passagem-plantao)
  // -------------------------------------------------------------
  if (templateId === 'passagem-plantao') {
    const turnoSaida = fieldValues.turno_saindo || 'Manhã';
    const respSaida = fieldValues.responsavel_saindo || 'Operador';
    const turnoEntrada = fieldValues.turno_entrando || 'Tarde';
    const respEntrada = fieldValues.responsavel_entrando || 'Operador';
    const pendencias = fieldValues.pendencias_criticas?.trim();
    const alertas = fieldValues.alertas_proximo_turno?.trim();

    if (visualMode === 'terminal') {
      return (
        <div className="report-terminal-view">
          <div className="terminal-header-bar">
            <div className="terminal-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="terminal-title">BENHERMES-CLI // TRANSIÇÃO DE TURNO</span>
            <span className="terminal-badge">HANDOVER</span>
          </div>

          <div className="terminal-body">
            <div className="term-box-header">
              ============================================================<br />
              PASSAGEM DE PLANTÃO &amp; TURNO<br />
              TURNO SAINDO   : {turnoSaida.toUpperCase()} ({respSaida.toUpperCase()})<br />
              TURNO ENTRANDO : {turnoEntrada.toUpperCase()} ({respEntrada.toUpperCase()})<br />
              DATA/HORA      : {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}<br />
              ============================================================
            </div>

            <div className="term-section">
              <span className="term-tag tag-blue">&gt;&gt;&gt; ATIVIDADES EXECUTADAS NO TURNO ({tasks.length})</span>
              {tasks.length === 0 ? (
                <div className="term-sub-line term-muted">*(Nenhuma tarefa apontada no turno)*</div>
              ) : (
                tasks.map((t) => (
                  <div key={t.id} className="term-item-line">
                    <span className="term-time">&lt;{t.start} – {t.end || '--:--'}&gt;</span>
                    <span className="term-cpf">{t.title.toUpperCase()}</span>
                    {t.description && <span className="term-muted">· {t.description}</span>}
                    {(onEditTask || onDeleteTask) && (
                      <span className="term-item-actions">
                        {onEditTask && (
                          <button
                            type="button"
                            className="term-mini-btn"
                            onClick={() => onEditTask(t)}
                            title="Editar"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            className="term-mini-btn term-mini-danger"
                            onClick={() => onDeleteTask(t.id, t.title)}
                            title="Excluir"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {pendencias && (
              <div className="term-section">
                <span className="term-tag tag-red">&gt;&gt;&gt; PENDÊNCIAS CRÍTICAS / AÇÕES EM ABERTO</span>
                <div className="term-sub-line term-alert">{pendencias}</div>
              </div>
            )}

            {alertas && (
              <div className="term-section">
                <span className="term-tag tag-amber">&gt;&gt;&gt; ALERTAS E PROCEDIMENTOS PARA O PRÓXIMO TURNO</span>
                <div className="term-sub-line">{alertas}</div>
              </div>
            )}

            <div className="term-footer-metrics">
              <span className="term-stat-pill pill-primary">HANDOVER CONCLUÍDO</span>
              <span className="term-stat-pill pill-cyan">{tasks.length} TAREFAS REGISTRADAS</span>
            </div>
          </div>
        </div>
      );
    }

    if (visualMode === 'cards') {
      return (
        <div className="report-cards-view">
          {/* Transition Cards */}
          <div className="handover-banner-grid">
            <div className="handover-side-card card-saindo">
              <span className="handover-badge badge-saindo">Turno Saindo</span>
              <h3 className="handover-shift">{turnoSaida}</h3>
              <p className="handover-person"><User size={13} /> {respSaida}</p>
            </div>

            <div className="handover-arrow-divider">
              <ChevronRight size={22} />
            </div>

            <div className="handover-side-card card-entrando">
              <span className="handover-badge badge-entrando">Turno Entrando</span>
              <h3 className="handover-shift">{turnoEntrada}</h3>
              <p className="handover-person"><User size={13} /> {respEntrada}</p>
            </div>
          </div>

          {/* Tarefas Concluídas */}
          <div className="cards-group">
            <div className="cards-group-header">
              <span className="group-badge badge-green">
                <CheckCircle2 size={13} />
                Atividades Realizadas no Turno ({tasks.length})
              </span>
            </div>
            <div className="cards-timeline-stack">
              {tasks.length === 0 ? (
                <div className="cards-empty-box">Nenhuma tarefa registrada para este turno.</div>
              ) : (
                tasks.map((t) => (
                  <div key={t.id} className="timeline-task-card">
                    <div className="timeline-card-time">
                      <Clock size={12} />
                      {t.start} – {t.end || '--:--'}
                      {t.end && <span className="timeline-dur">({calculateDuration(t.start, t.end)})</span>}
                    </div>
                    <div className="timeline-card-body">
                      <strong>{t.title.toUpperCase()}</strong>
                      {t.description && <p>{t.description}</p>}
                    </div>
                    {(onEditTask || onDeleteTask) && (
                      <div className="timeline-actions">
                        {onEditTask && (
                          <button
                            type="button"
                            className="timeline-action-btn edit"
                            onClick={() => onEditTask(t)}
                            title="Editar"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            className="timeline-action-btn delete"
                            onClick={() => onDeleteTask(t.id, t.title)}
                            title="Excluir"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pendências */}
          {pendencias && (
            <div className="handover-alert-card card-red">
              <div className="alert-card-header">
                <AlertTriangle size={16} />
                <strong>Pendências Críticas &amp; Ações em Aberto</strong>
              </div>
              <p>{pendencias}</p>
            </div>
          )}

          {/* Alertas */}
          {alertas && (
            <div className="handover-alert-card card-amber">
              <div className="alert-card-header">
                <AlertCircle size={16} />
                <strong>Alertas e Procedimentos para o Próximo Turno</strong>
              </div>
              <p>{alertas}</p>
            </div>
          )}
        </div>
      );
    }

    // visualMode === 'executive'
    return (
      <div className="report-executive-view">
        <div className="exec-letterhead">
          <div className="exec-title-row">
            <div>
              <span className="exec-kicker">OPERAÇÕES // ALINHAMENTO DE EQUIPE</span>
              <h2 className="exec-heading">ATA DE TRANSIÇÃO E PASSAGEM DE TURNO</h2>
            </div>
            <div className="exec-stamp">REGISTRADO</div>
          </div>

          <div className="exec-meta-grid">
            <div className="meta-cell">
              <span className="meta-label">Turno Encerrado:</span>
              <span className="meta-value">{turnoSaida} ({respSaida})</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Turno Assumido:</span>
              <span className="meta-value">{turnoEntrada} ({respEntrada})</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Data e Horário:</span>
              <span className="meta-value">{new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Atividades Apontadas:</span>
              <span className="meta-value">{tasks.length} itens registrados</span>
            </div>
          </div>
        </div>

        <div className="exec-table-wrap">
          <table className="exec-table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Horário</th>
                <th style={{ width: '35%' }}>Atividade do Turno</th>
                <th style={{ width: '35%' }}>Detalhamento Técnico</th>
                {(onEditTask || onDeleteTask) && <th style={{ width: '10%', textAlign: 'center' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={(onEditTask || onDeleteTask) ? 4 : 3} className="exec-empty-cell">Nenhuma atividade apontada no turno.</td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.start} – {t.end || '--:--'}</strong></td>
                    <td>{t.title.toUpperCase()}</td>
                    <td>{t.description || '—'}</td>
                    {(onEditTask || onDeleteTask) && (
                      <td style={{ textAlign: 'center' }}>
                        <div className="exec-row-actions">
                          {onEditTask && (
                            <button
                              type="button"
                              className="exec-action-btn edit"
                              onClick={() => onEditTask(t)}
                              title="Editar"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {onDeleteTask && (
                            <button
                              type="button"
                              className="exec-action-btn delete"
                              onClick={() => onDeleteTask(t.id, t.title)}
                              title="Excluir"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pendencias && (
          <div className="exec-callout callout-danger">
            <strong>Pendências Críticas:</strong> {pendencias}
          </div>
        )}

        {alertas && (
          <div className="exec-callout callout-warning">
            <strong>Recomendações para o Próximo Turno:</strong> {alertas}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDERIZADOR 4: COMUNICADO GERAL (comunicado-geral)
  // -------------------------------------------------------------
  if (templateId === 'comunicado-geral') {
    const assunto = fieldValues.assunto || 'COMUNICADO INTERNO';
    const remetente = fieldValues.departamento_remetente || 'Tecnologia da Informação';
    const destinatarios = fieldValues.destinatarios || 'Todos os Colaboradores';
    const prioridade = fieldValues.nivel_prioridade || 'Normal';
    const mensagem = fieldValues.mensagem_principal || '';
    const orientacoes = fieldValues.orientacoes_e_prazos || '';
    const canal = fieldValues.canal_duvidas || 'Suporte Interno';

    const isUrgente = prioridade.toLowerCase().includes('urgente') || prioridade.toLowerCase().includes('alta');

    if (visualMode === 'terminal') {
      return (
        <div className="report-terminal-view">
          <div className="terminal-header-bar">
            <div className="terminal-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="terminal-title">BENHERMES-CLI // BROADCAST OFICIAL</span>
            <span className="terminal-badge">COMUNICADO</span>
          </div>

          <div className="terminal-body">
            <div className="term-box-header">
              ============================================================<br />
              COMUNICADO OFICIAL: {assunto.toUpperCase()}<br />
              DE: {remetente.toUpperCase()} | PARA: {destinatarios.toUpperCase()}<br />
              PRIORIDADE: {prioridade.toUpperCase()}<br />
              ============================================================
            </div>

            <div className="term-section">
              <span className="term-tag tag-blue">&gt;&gt;&gt; MENSAGEM PRINCIPAL</span>
              <div className="term-sub-line">{mensagem || '(Mensagem não preenchida)'}</div>
            </div>

            {orientacoes && (
              <div className="term-section">
                <span className="term-tag tag-amber">&gt;&gt;&gt; ORIENTAÇÕES E PRAZOS</span>
                <div className="term-sub-line">{orientacoes}</div>
              </div>
            )}

            <div className="term-footer-metrics">
              <span className="term-stat-pill pill-cyan">DÚVIDAS: {canal}</span>
              <span className="term-stat-pill pill-primary">EMITIDO</span>
            </div>
          </div>
        </div>
      );
    }

    if (visualMode === 'cards') {
      return (
        <div className="report-cards-view">
          <div className={`cards-hero-bar ${isUrgente ? 'hero-red' : 'hero-blue'}`}>
            <div className="cards-hero-info">
              <span className="cards-hero-tag">
                <Mail size={13} />
                Prioridade: {prioridade.toUpperCase()}
              </span>
              <h2 className="cards-hero-title">{assunto}</h2>
              <div className="hero-sub-pills">
                <span className="hero-sub-pill"><Building size={12} /> De: {remetente}</span>
                <span className="hero-sub-pill"><Users size={12} /> Para: {destinatarios}</span>
                <span className="hero-sub-pill"><Calendar size={12} /> {new Date().toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>

          <div className="comunicado-main-card">
            <h3 className="comunicado-section-title">Mensagem Oficial</h3>
            <p className="comunicado-body-text">{mensagem || 'Preencha a mensagem no painel à esquerda...'}</p>
          </div>

          {orientacoes && (
            <div className="handover-alert-card card-amber">
              <div className="alert-card-header">
                <CheckCircle2 size={16} />
                <strong>Orientações e Ações Requeridas</strong>
              </div>
              <p>{orientacoes}</p>
            </div>
          )}

          <div className="comunicado-contact-pill">
            <PhoneCall size={14} />
            <span>Canal para dúvidas: <strong>{canal}</strong></span>
          </div>
        </div>
      );
    }

    // visualMode === 'executive'
    return (
      <div className="report-executive-view">
        <div className="exec-letterhead">
          <div className="exec-title-row">
            <div>
              <span className="exec-kicker">COMUNICAÇÃO INSTITUCIONAL</span>
              <h2 className="exec-heading">MEMORANDO INTERNO: {assunto.toUpperCase()}</h2>
            </div>
            <div className="exec-stamp">OFICIAL</div>
          </div>

          <div className="exec-meta-grid">
            <div className="meta-cell">
              <span className="meta-label">Origem:</span>
              <span className="meta-value">{remetente}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Destinatários:</span>
              <span className="meta-value">{destinatarios}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Data de Emissão:</span>
              <span className="meta-value">{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Prioridade:</span>
              <span className="meta-value">{prioridade}</span>
            </div>
          </div>
        </div>

        <div className="exec-content-block">
          <h4 className="exec-subheading">1. Mensagem</h4>
          <p className="exec-p">{mensagem || '(Mensagem principal)'}</p>

          {orientacoes && (
            <>
              <h4 className="exec-subheading" style={{ marginTop: '20px' }}>2. Orientações e Procedimentos</h4>
              <div className="exec-callout callout-info">{orientacoes}</div>
            </>
          )}

          <div className="exec-signoff">
            <p>Em caso de esclarecimentos, contate: <strong>{canal}</strong>.</p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDERIZADOR 5: RELATÓRIO DE INCIDENTE (relatorio-incidente)
  // -------------------------------------------------------------
  if (templateId === 'relatorio-incidente') {
    const ticket = fieldValues.ticket_id || 'INC-2026';
    const sistema = fieldValues.sistema_afetado || 'Sistema';
    const inicio = fieldValues.inicio_incidente || '—';
    const fim = fieldValues.fim_incidente || '—';
    const responsavel = fieldValues.responsavel_tecnico || 'Equipe NOC';
    const impacto = fieldValues.impacto_observado || '';
    const causa = fieldValues.causa_raiz || '';
    const acoes = fieldValues.acoes_tomadas || '';
    const prevencao = fieldValues.medidas_preventivas || '';

    if (visualMode === 'terminal') {
      return (
        <div className="report-terminal-view">
          <div className="terminal-header-bar">
            <div className="terminal-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <span className="terminal-title">BENHERMES-CLI // PÓS-INCIDENTE NOC</span>
            <span className="terminal-badge">INCIDENTE</span>
          </div>

          <div className="terminal-body">
            <div className="term-box-header">
              ============================================================<br />
              INCIDENTE: {ticket.toUpperCase()} // SERVIÇO: {sistema.toUpperCase()}<br />
              INÍCIO: {inicio} | RESOLUÇÃO: {fim}<br />
              RESPONSÁVEL: {responsavel.toUpperCase()}<br />
              ============================================================
            </div>

            <div className="term-section">
              <span className="term-tag tag-red">&gt;&gt;&gt; IMPACTO OBSERVADO</span>
              <div className="term-sub-line">{impacto || '(Não informado)'}</div>
            </div>

            <div className="term-section">
              <span className="term-tag tag-amber">&gt;&gt;&gt; CAUSA RAIZ IDENTIFICADA</span>
              <div className="term-sub-line">{causa || '(Não informado)'}</div>
            </div>

            <div className="term-section">
              <span className="term-tag tag-blue">&gt;&gt;&gt; MITIGAÇÃO E CORREÇÃO</span>
              <div className="term-sub-line">{acoes || '(Não informado)'}</div>
            </div>

            <div className="term-section">
              <span className="term-tag tag-green">&gt;&gt;&gt; PLANO PREVENTIVO</span>
              <div className="term-sub-line">{prevencao || '(Não informado)'}</div>
            </div>

            <div className="term-footer-metrics">
              <span className="term-stat-pill pill-primary">TICKET RESOLVIDO</span>
              <span className="term-stat-pill pill-cyan">STATUS: NORMALIZADO</span>
            </div>
          </div>
        </div>
      );
    }

    if (visualMode === 'cards') {
      return (
        <div className="report-cards-view">
          <div className="cards-hero-bar hero-red">
            <div className="cards-hero-info">
              <span className="cards-hero-tag">
                <AlertTriangle size={13} />
                Pós-Morte &amp; Análise de Incidente
              </span>
              <h2 className="cards-hero-title">{ticket} — {sistema}</h2>
              <div className="hero-sub-pills">
                <span className="hero-sub-pill"><Clock size={12} /> {inicio} → {fim}</span>
                <span className="hero-sub-pill"><User size={12} /> NOC: {responsavel}</span>
              </div>
            </div>
          </div>

          <div className="incident-cards-stack">
            {impacto && (
              <div className="incident-card card-impacto">
                <div className="incident-card-top">
                  <span className="group-badge badge-red">Impacto no Negócio</span>
                </div>
                <p>{impacto}</p>
              </div>
            )}

            {causa && (
              <div className="incident-card card-causa">
                <div className="incident-card-top">
                  <span className="group-badge badge-amber">Diagnóstico &amp; Causa Raiz</span>
                </div>
                <p>{causa}</p>
              </div>
            )}

            {acoes && (
              <div className="incident-card card-acoes">
                <div className="incident-card-top">
                  <span className="group-badge badge-blue">Ações Corretivas Executadas</span>
                </div>
                <p>{acoes}</p>
              </div>
            )}

            {prevencao && (
              <div className="incident-card card-prevencao">
                <div className="incident-card-top">
                  <span className="group-badge badge-green">Medidas Preventivas</span>
                </div>
                <p>{prevencao}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // visualMode === 'executive'
    return (
      <div className="report-executive-view">
        <div className="exec-letterhead">
          <div className="exec-title-row">
            <div>
              <span className="exec-kicker">ENGENHARIA &amp; NOC // PÓS-INCIDENTE</span>
              <h2 className="exec-heading">SUMÁRIO EXECUTIVO: {ticket}</h2>
            </div>
            <div className="exec-stamp">RESOLVIDO</div>
          </div>

          <div className="exec-meta-grid">
            <div className="meta-cell">
              <span className="meta-label">Sistema / Serviço:</span>
              <span className="meta-value">{sistema}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Responsável Técnico:</span>
              <span className="meta-value">{responsavel}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Início da Instabilidade:</span>
              <span className="meta-value">{inicio}</span>
            </div>
            <div className="meta-cell">
              <span className="meta-label">Restabelecimento:</span>
              <span className="meta-value">{fim}</span>
            </div>
          </div>
        </div>

        <div className="exec-content-block">
          <h4 className="exec-subheading">1. Resumo do Impacto</h4>
          <p className="exec-p">{impacto || '—'}</p>

          <h4 className="exec-subheading" style={{ marginTop: '16px' }}>2. Causa Raiz</h4>
          <p className="exec-p">{causa || '—'}</p>

          <h4 className="exec-subheading" style={{ marginTop: '16px' }}>3. Resolução e Mitigação</h4>
          <p className="exec-p">{acoes || '—'}</p>

          <h4 className="exec-subheading" style={{ marginTop: '16px' }}>4. Plano Preventivo</h4>
          <div className="exec-callout callout-info">{prevencao || '—'}</div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDERIZADOR PADRÃO: ATIVIDADES PADRÃO & ATIVIDADES EM TABELA
  // (atividades-padrao, atividades-tabela e modelos genéricos)
  // -------------------------------------------------------------
  const reportTitle = title || 'Relatório de Atividades';
  const profissional = fieldValues.nome_profissional || fieldValues.nome_colaborador || '';
  const projeto = fieldValues.projeto || '';
  const resumo = fieldValues.resumo_executivo || '';
  const bloqueios = fieldValues.bloqueios || '';

  if (visualMode === 'terminal') {
    return (
      <div className="report-terminal-view">
        <div className="terminal-header-bar">
          <div className="terminal-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <span className="terminal-title">BENHERMES-CLI // APONTAMENTO OPERACIONAL</span>
          <span className="terminal-badge">SISTEMA BENZAITEN</span>
        </div>

        <div className="terminal-body">
          <div className="term-box-header">
            ============================================================<br />
            {reportTitle.toUpperCase()}<br />
            {profissional && `PROFISSIONAL : ${profissional.toUpperCase()}\n`}
            {projeto && `PROJETO      : ${projeto.toUpperCase()}\n`}
            DATA         : {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}<br />
            ============================================================
          </div>

          {resumo && (
            <div className="term-section">
              <span className="term-tag tag-blue">&gt;&gt;&gt; SÍNTESE DO DIA</span>
              <div className="term-sub-line">{resumo}</div>
            </div>
          )}

          <div className="term-section">
            <span className="term-tag tag-green">&gt;&gt;&gt; REGISTRO DE ATIVIDADES ({tasks.length})</span>
            {tasks.length === 0 ? (
              <div className="term-sub-line term-muted">*(Nenhuma tarefa registrada no momento)*</div>
            ) : (
              tasks.map((t, idx) => (
                <div key={t.id} className="term-item-line">
                  <span className="term-time">&lt;{t.start} – {t.end || '--:--'}&gt;</span>
                  <span className="term-cpf">[{String(idx + 1).padStart(2, '0')}] {t.title.toUpperCase()}</span>
                  {t.end && <span className="term-duration">({calculateDuration(t.start, t.end)})</span>}
                  {(onEditTask || onDeleteTask) && (
                    <span className="term-item-actions">
                      {onEditTask && (
                        <button
                          type="button"
                          className="term-mini-btn"
                          onClick={() => onEditTask(t)}
                          title="Editar tarefa"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                      {onDeleteTask && (
                        <button
                          type="button"
                          className="term-mini-btn term-mini-danger"
                          onClick={() => onDeleteTask(t.id, t.title)}
                          title="Excluir tarefa"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </span>
                  )}
                  {t.description && <div className="term-sub-desc">└─ {t.description}</div>}
                </div>
              ))
            )}
          </div>

          {bloqueios && (
            <div className="term-section">
              <span className="term-tag tag-amber">&gt;&gt;&gt; PONTOS DE ATENÇÃO &amp; BLOQUEIOS</span>
              <div className="term-sub-line term-alert">{bloqueios}</div>
            </div>
          )}

          <div className="term-footer-metrics">
            <span className="term-stat-pill pill-primary">REGISTROS: {tasks.length}</span>
            <span className="term-stat-pill pill-cyan">STATUS: CONCLUÍDO</span>
          </div>
        </div>
      </div>
    );
  }

  if (visualMode === 'cards') {
    return (
      <div className="report-cards-view">
        {/* Hero Card */}
        <div className="cards-hero-bar">
          <div className="cards-hero-info">
            <span className="cards-hero-tag">
              <FileText size={13} />
              Registro de Produtividade
            </span>
            <h2 className="cards-hero-title">{reportTitle}</h2>
            {(profissional || projeto) && (
              <div className="hero-sub-pills">
                {profissional && <span className="hero-sub-pill"><User size={12} /> {profissional}</span>}
                {projeto && <span className="hero-sub-pill"><Briefcase size={12} /> {projeto}</span>}
                <span className="hero-sub-pill"><Calendar size={12} /> {new Date().toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Resumo do Dia (se houver) */}
        {resumo && (
          <div className="cards-summary-box">
            <Sparkles size={16} className="summary-icon" />
            <div>
              <strong>Síntese do Dia:</strong>
              <p>{resumo}</p>
            </div>
          </div>
        )}

        {/* Timeline de Tarefas */}
        <div className="cards-group">
          <div className="cards-group-header">
            <span className="group-badge badge-blue">
              <Clock size={13} />
              Atividades do Período ({tasks.length})
            </span>
          </div>

          <div className="cards-timeline-stack">
            {tasks.length === 0 ? (
              <div className="cards-empty-box">Nenhuma tarefa apontada até o momento.</div>
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="timeline-task-card">
                  <div className="timeline-card-time">
                    <Clock size={12} />
                    {t.start} – {t.end || '--:--'}
                    {t.end && <span className="timeline-dur">({calculateDuration(t.start, t.end)})</span>}
                  </div>
                  <div className="timeline-card-body">
                    <strong>{t.title.toUpperCase()}</strong>
                    {t.description && <p>{t.description}</p>}
                  </div>
                  {(onEditTask || onDeleteTask) && (
                    <div className="timeline-actions">
                      {onEditTask && (
                        <button
                          type="button"
                          className="timeline-action-btn edit"
                          onClick={() => onEditTask(t)}
                          title="Editar"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {onDeleteTask && (
                        <button
                          type="button"
                          className="timeline-action-btn delete"
                          onClick={() => onDeleteTask(t.id, t.title)}
                          title="Excluir"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bloqueios */}
        {bloqueios && (
          <div className="handover-alert-card card-amber">
            <div className="alert-card-header">
              <AlertTriangle size={16} />
              <strong>Pontos de Atenção &amp; Bloqueios</strong>
            </div>
            <p>{bloqueios}</p>
          </div>
        )}
      </div>
    );
  }

  // visualMode === 'executive'
  return (
    <div className="report-executive-view">
      <div className="exec-letterhead">
        <div className="exec-title-row">
          <div>
            <span className="exec-kicker">BENCONSIG // REGISTRO OPERACIONAL</span>
            <h2 className="exec-heading">{reportTitle.toUpperCase()}</h2>
          </div>
          <div className="exec-stamp">CONCLUÍDO</div>
        </div>

        <div className="exec-meta-grid">
          <div className="meta-cell">
            <span className="meta-label">Data:</span>
            <span className="meta-value">{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
          {profissional && (
            <div className="meta-cell">
              <span className="meta-label">Profissional:</span>
              <span className="meta-value">{profissional}</span>
            </div>
          )}
          {projeto && (
            <div className="meta-cell">
              <span className="meta-label">Projeto / Setor:</span>
              <span className="meta-value">{projeto}</span>
            </div>
          )}
          <div className="meta-cell">
            <span className="meta-label">Volume:</span>
            <span className="meta-value">{tasks.length} atividades</span>
          </div>
        </div>
      </div>

      {resumo && (
        <div className="exec-content-block">
          <h4 className="exec-subheading">Síntese do Dia</h4>
          <p className="exec-p">{resumo}</p>
        </div>
      )}

      <div className="exec-table-wrap">
        <table className="exec-table">
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Horário</th>
              <th style={{ width: '32%' }}>Atividade</th>
              <th style={{ width: '15%' }}>Duração</th>
              <th style={{ width: '25%' }}>Detalhamento</th>
              {(onEditTask || onDeleteTask) && <th style={{ width: '10%', textAlign: 'center' }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={(onEditTask || onDeleteTask) ? 5 : 4} className="exec-empty-cell">Nenhuma atividade cadastrada.</td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.start} – {t.end || '--:--'}</strong></td>
                  <td>{t.title.toUpperCase()}</td>
                  <td>{t.end ? calculateDuration(t.start, t.end) : '--'}</td>
                  <td>{t.description || '—'}</td>
                  {(onEditTask || onDeleteTask) && (
                    <td style={{ textAlign: 'center' }}>
                      <div className="exec-row-actions">
                        {onEditTask && (
                          <button
                            type="button"
                            className="exec-action-btn edit"
                            onClick={() => onEditTask(t)}
                            title="Editar"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            className="exec-action-btn delete"
                            onClick={() => onDeleteTask(t.id, t.title)}
                            title="Excluir"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {tasks.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <strong>Total: {tasks.length} tarefas apontadas</strong>
                </td>
                <td colSpan={(onEditTask || onDeleteTask) ? 3 : 2} style={{ textAlign: 'right' }}>
                  <strong>Fechamento: {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {bloqueios && (
        <div className="exec-callout callout-warning">
          <strong>Pontos de Atenção / Bloqueios:</strong> {bloqueios}
        </div>
      )}
    </div>
  );
};
