import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Copy,
  Download,
  RotateCcw,
  Trash2,
  Calendar,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
  Edit2,
  CheckCircle,
  Layers,
  Sparkles,
  Tag,
  AlertTriangle,
  UserCheck,
  Radio,
  Users,
} from 'lucide-react';
import { SavedReport } from '../../types/task';
import { AuthUser, canDeleteReports, ROLE_LABELS } from '../../types/auth';

interface ReportsHistoryHubProps {
  savedReports: SavedReport[];
  onDeleteReport: (id: string) => void;
  onRenameReport: (id: string, newTitle: string) => void;
  onClearAllReports: () => void;
  onRestoreReport: (report: SavedReport) => void;
  onNotify: (message: string, type: 'success' | 'error' | '') => void;
  onNavigateToGenerator: () => void;
  currentUser?: AuthUser | null;
}

type FilterCategory = 'all' | 'atividades' | 'incidentes' | 'rh' | 'plantao' | 'custom';

function matchesCategory(report: SavedReport, category: FilterCategory): boolean {
  if (category === 'all') return true;
  const cat = (report.templateCategory || '').toLowerCase();
  const id = (report.templateId || '').toLowerCase();

  switch (category) {
    case 'atividades':
      return report.isExpandable === true || id.includes('atividade') || cat === 'geral';
    case 'incidentes':
      return cat === 'incidentes' || id.includes('incidente');
    case 'rh':
      return cat === 'rh' || id.includes('colaborador') || id.includes('acesso');
    case 'plantao':
      return cat === 'suporte' || cat === 'plantao' || id.includes('plantao');
    case 'custom':
      return cat === 'custom' || id.startsWith('custom-');
    default:
      return true;
  }
}

function getCategoryBadgeInfo(report: SavedReport): { label: string; className: string } {
  const cat = (report.templateCategory || '').toLowerCase();
  const id = (report.templateId || '').toLowerCase();

  if (id.startsWith('custom-') || cat === 'custom') {
    return { label: 'Customizado', className: 'history-badge-cat-custom' };
  }
  if (id.includes('incidente') || cat === 'incidentes') {
    return { label: 'Incidente', className: 'history-badge-cat-incidente' };
  }
  if (id.includes('colaborador') || cat === 'rh') {
    return { label: 'RH & Acesso', className: 'history-badge-cat-rh' };
  }
  if (id.includes('plantao') || cat === 'suporte') {
    return { label: 'Plantão', className: 'history-badge-cat-plantao' };
  }
  if (id.includes('comunicado')) {
    return { label: 'Comunicado', className: 'history-badge-cat-comunicado' };
  }
  return { label: 'Atividades', className: 'history-badge-cat-atividades' };
}

function getKeyFieldHighlights(report: SavedReport): { label: string; value: string }[] {
  if (!report.fieldValues) return [];
  const fields = report.fieldValues;
  const list: { label: string; value: string }[] = [];

  const addIf = (key: string, label: string) => {
    if (fields[key] && fields[key].trim()) {
      list.push({ label, value: fields[key].trim() });
    }
  };

  addIf('nome_completo', 'Colaborador');
  addIf('nome_colaborador', 'Colaborador');
  addIf('colaborador', 'Colaborador');
  addIf('cargo', 'Cargo');
  addIf('sistema_afetado', 'Sistema');
  addIf('gravidade', 'Gravidade');
  addIf('titulo_incidente', 'Incidente');
  addIf('colaborador_saindo', 'Saindo');
  addIf('colaborador_entrando', 'Entrando');
  addIf('titulo_comunicado', 'Comunicado');

  return list.slice(0, 3);
}

export const ReportsHistoryHub: React.FC<ReportsHistoryHubProps> = ({
  savedReports,
  onDeleteReport,
  onRenameReport,
  onClearAllReports,
  onRestoreReport,
  onNotify,
  onNavigateToGenerator,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edição inline de título
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  const userCanDelete = currentUser ? canDeleteReports(currentUser.role) : true;
  const showHierarchyFilters = currentUser && currentUser.role !== 'operador';

  // Opções únicas de Supervisores e Autores presentes nos relatórios visíveis
  const supervisorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of savedReports) {
      if (r.supervisorId && r.supervisorName) {
        map.set(r.supervisorId, r.supervisorName);
      } else if (r.authorRole === 'supervisor' && r.userId && r.authorName) {
        map.set(r.userId, r.authorName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [savedReports]);

  const authorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of savedReports) {
      if (r.userId && r.authorName) {
        const roleLabel = r.authorRole ? ` (${ROLE_LABELS[r.authorRole]})` : '';
        map.set(r.userId, `${r.authorName}${roleLabel}`);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [savedReports]);

  // Contadores por categoria
  const categoryCounts = useMemo(() => {
    return {
      all: savedReports.length,
      atividades: savedReports.filter((r) => matchesCategory(r, 'atividades')).length,
      incidentes: savedReports.filter((r) => matchesCategory(r, 'incidentes')).length,
      rh: savedReports.filter((r) => matchesCategory(r, 'rh')).length,
      plantao: savedReports.filter((r) => matchesCategory(r, 'plantao')).length,
      custom: savedReports.filter((r) => matchesCategory(r, 'custom')).length,
    };
  }, [savedReports]);

  // Filtragem combinada (categoria + supervisor + autor + busca textual)
  const filteredReports = useMemo(() => {
    let list = savedReports;

    if (selectedCategory !== 'all') {
      list = list.filter((r) => matchesCategory(r, selectedCategory));
    }

    if (selectedSupervisor !== 'all') {
      list = list.filter(
        (r) => r.supervisorId === selectedSupervisor || r.userId === selectedSupervisor
      );
    }

    if (selectedAuthor !== 'all') {
      list = list.filter((r) => r.userId === selectedAuthor);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((report) => {
      const matchTitle = report.title.toLowerCase().includes(q);
      const matchAuthor = report.authorName ? report.authorName.toLowerCase().includes(q) : false;
      const matchSupervisor = report.supervisorName
        ? report.supervisorName.toLowerCase().includes(q)
        : false;
      const matchTemplateTitle = report.templateTitle?.toLowerCase().includes(q);
      const matchNote = report.note ? report.note.toLowerCase().includes(q) : false;
      const matchDate = report.displayDate.includes(q);
      const matchReportText = report.reportText.toLowerCase().includes(q);
      const matchTasks = report.tasks.some(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
      const matchFields = report.fieldValues
        ? Object.values(report.fieldValues).some(
            (v) => typeof v === 'string' && v.toLowerCase().includes(q)
          )
        : false;

      return (
        matchTitle ||
        matchAuthor ||
        matchSupervisor ||
        matchTemplateTitle ||
        matchNote ||
        matchDate ||
        matchReportText ||
        matchTasks ||
        matchFields
      );
    });
  }, [savedReports, selectedCategory, selectedSupervisor, selectedAuthor, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = async (report: SavedReport) => {
    try {
      await navigator.clipboard.writeText(report.reportText);
      setCopiedId(report.id);
      onNotify('Relatório copiado para a área de transferência!', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      onNotify('Erro ao copiar texto do relatório.', 'error');
    }
  };

  const handleDownloadFile = (report: SavedReport, format: 'txt' | 'md') => {
    try {
      const mime = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
      const blob = new Blob([report.reportText], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = report.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      link.download = `${safeTitle}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      onNotify(`Download do arquivo .${format} realizado!`, 'success');
    } catch {
      onNotify('Erro ao baixar arquivo do relatório.', 'error');
    }
  };

  const handleRestore = (report: SavedReport) => {
    onRestoreReport(report);
  };

  const handleDelete = (report: SavedReport) => {
    const confirmed = window.confirm(`Excluir o relatório "${report.title}" permanentemente?`);
    if (confirmed) {
      onDeleteReport(report.id);
      onNotify('Relatório excluído do histórico.', '');
    }
  };

  const handleStartRename = (report: SavedReport) => {
    setEditingId(report.id);
    setEditTitleValue(report.title);
  };

  const handleSaveRename = (id: string) => {
    if (editTitleValue.trim()) {
      onRenameReport(id, editTitleValue.trim());
      onNotify('Título do relatório atualizado.', 'success');
    }
    setEditingId(null);
  };

  const handleClearAll = () => {
    if (savedReports.length === 0) return;
    const confirmed = window.confirm(
      'Tem certeza de que deseja excluir TODOS os relatórios salvos no histórico? Esta ação não pode ser desfeita.'
    );
    if (confirmed) {
      onClearAllReports();
      onNotify('Todo o histórico de relatórios foi limpo.', '');
    }
  };

  return (
    <div className="history-container">
      {/* Header do Histórico */}
      <div className="history-header">
        <div className="history-header-info">
          <h2>
            <History size={24} style={{ color: 'var(--yellow)' }} />
            Histórico & Arquivos de Relatórios
          </h2>
          <p>
            {currentUser?.role === 'admin' || currentUser?.role === 'gerente'
              ? 'Visualizando relatórios de todos os supervisores e operadores (salvamento automático ativo).'
              : currentUser?.role === 'supervisor'
              ? 'Visualizando seus relatórios e todos os relatórios dos operadores associados a você.'
              : 'Consolidação de todos os seus relatórios salvos automaticamente.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="history-badge-count">
            {savedReports.length} {savedReports.length === 1 ? 'relatório salvo' : 'relatórios salvos'}
          </span>

          {userCanDelete && savedReports.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              onClick={handleClearAll}
              title="Excluir todos os relatórios do histórico"
            >
              <Trash2 size={13} style={{ color: 'var(--red)' }} />
              Limpar histórico
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros por Categoria */}
      <div className="history-category-filters">
        <button
          type="button"
          className={`history-filter-pill ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          <Layers size={14} />
          Todos
          <span className="pill-count">{categoryCounts.all}</span>
        </button>

        <button
          type="button"
          className={`history-filter-pill ${selectedCategory === 'atividades' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('atividades')}
        >
          <Clock size={14} />
          Atividades Diárias
          <span className="pill-count">{categoryCounts.atividades}</span>
        </button>

        <button
          type="button"
          className={`history-filter-pill ${selectedCategory === 'incidentes' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('incidentes')}
        >
          <AlertTriangle size={14} />
          Incidentes
          <span className="pill-count">{categoryCounts.incidentes}</span>
        </button>

        <button
          type="button"
          className={`history-filter-pill ${selectedCategory === 'rh' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('rh')}
        >
          <UserCheck size={14} />
          RH & Acesso
          <span className="pill-count">{categoryCounts.rh}</span>
        </button>

        <button
          type="button"
          className={`history-filter-pill ${selectedCategory === 'plantao' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('plantao')}
        >
          <Radio size={14} />
          Plantão
          <span className="pill-count">{categoryCounts.plantao}</span>
        </button>

        {categoryCounts.custom > 0 && (
          <button
            type="button"
            className={`history-filter-pill ${selectedCategory === 'custom' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('custom')}
          >
            <Sparkles size={14} />
            Customizados
            <span className="pill-count">{categoryCounts.custom}</span>
          </button>
        )}
      </div>

      {/* Barra de Busca Textual e Filtros de Hierarquia (Supervisor / Operador) */}
      {savedReports.length > 0 && (
        <div
          className="history-toolbar"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}
        >
          <div className="history-search-wrapper" style={{ flex: '1 1 280px' }}>
            <Search size={16} className="history-search-icon" />
            <input
              type="text"
              className="history-search-input"
              placeholder="Pesquisar por título, autor, supervisor, colaborador, modelo ou conteúdo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="field-icon-btn"
                style={{ position: 'static', padding: 4 }}
                onClick={() => setSearchQuery('')}
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          {showHierarchyFilters && supervisorOptions.length > 0 && (
            <select
              className="formatter-select"
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              aria-label="Filtrar por Supervisor"
            >
              <option value="all">Todos os Supervisores</option>
              {supervisorOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  Sup.: {s.name}
                </option>
              ))}
            </select>
          )}

          {showHierarchyFilters && authorOptions.length > 0 && (
            <select
              className="formatter-select"
              value={selectedAuthor}
              onChange={(e) => setSelectedAuthor(e.target.value)}
              aria-label="Filtrar por Operador / Autor"
            >
              <option value="all">Todos os Autores</option>
              {authorOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Listagem de Relatórios Arquivados */}
      {filteredReports.length === 0 ? (
        <div className="history-empty-state">
          <div className="history-empty-icon">
            <FileText size={28} />
          </div>
          {savedReports.length === 0 ? (
            <>
              <h3>Nenhum relatório salvo ainda</h3>
              <p>
                Os relatórios são salvos automaticamente na <strong>Central de Relatórios</strong> assim que tarefas ou campos são preenchidos.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: 'auto', marginTop: '0.5rem' }}
                onClick={onNavigateToGenerator}
              >
                Ir para o Gerador de Relatórios
              </button>
            </>
          ) : (
            <>
              <h3>Nenhum resultado nesta categoria</h3>
              <p>Não há relatórios correspondentes aos filtros e termos de pesquisa aplicados.</p>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto', marginTop: '0.5rem' }}
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedSupervisor('all');
                  setSelectedAuthor('all');
                  setSearchQuery('');
                }}
              >
                Limpar filtros e exibir todos
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="history-list">
          {filteredReports.map((report) => {
            const isExpanded = !!expandedIds[report.id];
            const isCopied = copiedId === report.id;
            const isEditing = editingId === report.id;
            const catBadge = getCategoryBadgeInfo(report);
            const fieldHighlights = getKeyFieldHighlights(report);
            const isOwnReport =
              !report.userId || !currentUser || report.userId === currentUser.id;
            const canEditThisReport = isOwnReport || currentUser?.role === 'admin';

            const [yyyy, mm, dd] = report.displayDate.split('-');
            const formattedDateBR = dd && mm && yyyy ? `${dd}/${mm}/${yyyy}` : report.displayDate;

            return (
              <div key={report.id} className="history-card">
                <div className="history-card-header">
                  <div className="history-card-title-group" style={{ flex: 1, minWidth: '260px' }}>
                    <div className="history-card-badges-row">
                      <span className={`history-category-badge ${catBadge.className}`}>
                        {catBadge.label}
                      </span>
                      <span className="history-model-badge">
                        <Tag size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                        {report.templateTitle || 'Relatório'}
                      </span>
                      {report.authorName && (
                        <span className="history-model-badge" style={{ fontWeight: 600 }}>
                          <UserCheck size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                          {report.authorName}
                          {report.authorRole ? ` · ${ROLE_LABELS[report.authorRole]}` : ''}
                        </span>
                      )}
                      {report.supervisorName && (
                        <span className="history-model-badge">
                          <Users size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                          Sup.: {report.supervisorName}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                        <input
                          type="text"
                          className="field-input"
                          style={{ padding: '4px 8px', fontSize: '0.95rem' }}
                          value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(report.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 10px', width: 'auto' }}
                          onClick={() => handleSaveRename(report.id)}
                          title="Salvar novo título"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <h3>
                        <span>{report.title}</span>
                        {canEditThisReport && (
                          <button
                            type="button"
                            className="field-icon-btn"
                            style={{ position: 'static', padding: 2 }}
                            onClick={() => handleStartRename(report)}
                            title="Renomear título"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </h3>
                    )}

                    <div className="history-card-meta">
                      <span className="history-card-meta-item">
                        <Calendar size={13} style={{ color: 'var(--blue)' }} />
                        {formattedDateBR} às {report.displayTime}
                      </span>

                      {report.isExpandable ? (
                        <>
                          <span className="history-card-meta-item">
                            <Clock size={13} style={{ color: 'var(--yellow)' }} />
                            Período: {report.periodSummary}
                          </span>
                          <span className="history-card-meta-item">
                            <CheckCircle size={13} style={{ color: 'var(--green)' }} />
                            {report.taskCount} {report.taskCount === 1 ? 'tarefa' : 'tarefas'}
                          </span>
                        </>
                      ) : (
                        <span className="history-card-meta-item">
                          <Layers size={13} style={{ color: 'var(--yellow)' }} />
                          Formulário de Modelo
                        </span>
                      )}
                    </div>

                    {fieldHighlights.length > 0 && (
                      <div className="history-card-highlights">
                        {fieldHighlights.map((fh, idx) => (
                          <span key={idx} className="highlight-chip">
                            <strong>{fh.label}:</strong> {fh.value}
                          </span>
                        ))}
                      </div>
                    )}

                    {report.note && (
                      <div className="history-card-note">
                        <strong>Nota:</strong> {report.note}
                      </div>
                    )}
                  </div>

                  {/* Ações por Relatório */}
                  <div className="history-card-actions">
                    <button
                      type="button"
                      className="btn-history-action"
                      onClick={() => handleCopy(report)}
                      title="Copiar texto compilado do relatório"
                    >
                      {isCopied ? <Check size={14} style={{ color: 'var(--green)' }} /> : <Copy size={14} />}
                      {isCopied ? 'Copiado!' : 'Copiar'}
                    </button>

                    <button
                      type="button"
                      className="btn-history-action"
                      onClick={() => handleDownloadFile(report, 'txt')}
                      title="Baixar como arquivo .txt"
                    >
                      <Download size={14} />
                      .txt
                    </button>

                    {isOwnReport && (
                      <button
                        type="button"
                        className="btn-history-action restore highlight-restore"
                        onClick={() => handleRestore(report)}
                        title="Restaurar este relatório no Gerador: carrega o modelo e preenche todos os campos para edição"
                      >
                        <RotateCcw size={14} />
                        Restaurar no Gerador
                      </button>
                    )}

                    {userCanDelete && (
                      <button
                        type="button"
                        className="btn-history-action delete"
                        onClick={() => handleDelete(report)}
                        title="Excluir este relatório do histórico"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Alternador de Pré-visualização */}
                <div>
                  <button
                    type="button"
                    className="history-preview-toggle"
                    onClick={() => toggleExpand(report.id)}
                  >
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    {isExpanded ? 'Ocultar texto do relatório' : 'Visualizar texto do relatório'}
                  </button>

                  {isExpanded && (
                    <div className="history-preview-box" style={{ marginTop: '0.65rem' }}>
                      {report.reportText}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
