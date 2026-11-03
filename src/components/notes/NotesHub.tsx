import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StickyNote,
  Plus,
  Search,
  LayoutGrid,
  List,
  User,
  Tag,
  RefreshCw,
} from 'lucide-react';
import type { NoteItem, NoteColor } from '../../types/notes';
import { NOTE_CATEGORIES } from '../../types/notes';
import type { AuthUser } from '../../types/auth';
import { apiRequest } from '../../utils/apiClient';
import { NoteCard } from './NoteCard';
import { NoteRow } from './NoteRow';
import { NoteEditorModal } from './NoteEditorModal';
import { NoteDetailModal } from './NoteDetailModal';
import { Modal } from '../common/Modal';

interface NotesHubProps {
  currentUser: AuthUser;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onUnreadCountChanged?: () => void;
}

export const NotesHub: React.FC<NotesHubProps> = ({
  currentUser,
  onNotify,
  onUnreadCountChanged,
}) => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('benhermes_notes_view_mode');
      return saved === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');

  // Modais
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<NoteItem | null>(null);
  const [detailNote, setDetailNote] = useState<NoteItem | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<NoteItem | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const query = selectedUserFilter !== 'all' ? `?userId=${encodeURIComponent(selectedUserFilter)}` : '';
      const res = await apiRequest<{ notes: NoteItem[] }>(`/api/notes${query}`);
      setNotes(res.notes || []);
      if (onUnreadCountChanged) {
        onUnreadCountChanged();
      }
    } catch (err: any) {
      if (onNotify) {
        onNotify(err.message || 'Erro ao carregar anotações.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserFilter, onNotify, onUnreadCountChanged]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('benhermes_notes_view_mode', mode);
    } catch {
      // Ignora falhas de localStorage
    }
  };

  // Extrai lista única de colaboradores visíveis para o dropdown de filtro
  const availableAuthors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string }>();
    for (const n of notes) {
      if (!map.has(n.userId)) {
        map.set(n.userId, { id: n.userId, name: n.authorName, role: n.authorRole });
      }
    }
    return Array.from(map.values());
  }, [notes]);

  // Filtragem local por busca e categoria
  const filteredNotes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return notes.filter((n) => {
      const matchesCategory = selectedCategory === 'all' || n.category === selectedCategory;
      const matchesSearch =
        !term ||
        n.title.toLowerCase().includes(term) ||
        n.content.toLowerCase().includes(term) ||
        n.authorName.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [notes, searchTerm, selectedCategory]);

  const handleOpenCreateModal = () => {
    setNoteToEdit(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (note: NoteItem) => {
    setNoteToEdit(note);
    setIsEditorOpen(true);
  };

  const handleSaveNote = async (data: {
    title: string;
    content: string;
    category: string;
    color: NoteColor;
  }) => {
    if (noteToEdit) {
      const res = await apiRequest<{ note: NoteItem }>(`/api/notes/${noteToEdit.id}`, {
        method: 'PUT',
        body: data,
      });
      setNotes((prev) => prev.map((n) => (n.id === noteToEdit.id ? res.note : n)));
      if (detailNote?.id === noteToEdit.id) {
        setDetailNote(res.note);
      }
      if (onNotify) onNotify('Anotação atualizada com sucesso!', 'success');
    } else {
      const res = await apiRequest<{ note: NoteItem }>('/api/notes', {
        method: 'POST',
        body: data,
      });
      setNotes((prev) => [res.note, ...prev]);
      if (onNotify) onNotify('Anotação criada com sucesso!', 'success');
    }
    if (onUnreadCountChanged) onUnreadCountChanged();
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      await apiRequest(`/api/notes/${noteToDelete.id}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      if (detailNote?.id === noteToDelete.id) {
        setDetailNote(null);
      }
      setNoteToDelete(null);
      if (onNotify) onNotify('Anotação excluída.', 'info');
      if (onUnreadCountChanged) onUnreadCountChanged();
    } catch (err: any) {
      if (onNotify) onNotify(err.message || 'Erro ao excluir anotação.', 'error');
    }
  };

  const canFilterByPerson = currentUser.role !== 'operador';

  return (
    <div className="notes-hub-container">
      {/* Header */}
      <div className="notes-hub-header">
        <div className="header-text-block">
          <div className="header-title-row">
            <div className="header-icon-box">
              <StickyNote size={24} />
            </div>
            <div>
              <h1 className="header-main-title">Mural de Anotações</h1>
              <p className="header-subtitle">
                Espaço compartilhado para anotações, recados e feedbacks contextuais com sua equipe.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions-block">
          <button
            type="button"
            className="btn btn-primary create-note-btn"
            onClick={handleOpenCreateModal}
          >
            <Plus size={16} />
            <span>Nova Anotação</span>
          </button>
        </div>
      </div>

      {/* Toolbar / Filtros */}
      <div className="notes-hub-toolbar">
        <div className="toolbar-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="toolbar-search-input"
            placeholder="Buscar por título, texto ou autor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="toolbar-filters-group">
          {/* Filtro por Categoria */}
          <div className="toolbar-select-wrap">
            <Tag size={14} className="filter-select-icon" />
            <select
              className="toolbar-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filtrar por Categoria"
            >
              <option value="all">Todas as Categorias</option>
              {NOTE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Pessoa (para Supervisores, Gerentes e Admins) */}
          {canFilterByPerson && (
            <div className="toolbar-select-wrap">
              <User size={14} className="filter-select-icon" />
              <select
                className="toolbar-select"
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                aria-label="Filtrar por Pessoa"
              >
                <option value="all">Todas as Pessoas</option>
                {availableAuthors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name} ({author.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botão de Atualizar */}
          <button
            type="button"
            className="toolbar-icon-btn"
            title="Atualizar anotações"
            onClick={fetchNotes}
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Alternador Grid / Lista */}
          <div className="view-mode-toggle" role="group" aria-label="Modo de visualização">
            <button
              type="button"
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              title="Visualização em Grade (Cards)"
              onClick={() => handleToggleViewMode('grid')}
            >
              <LayoutGrid size={15} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="Visualização em Lista (Tabela)"
              onClick={() => handleToggleViewMode('list')}
            >
              <List size={15} />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="notes-hub-content">
        {isLoading && notes.length === 0 ? (
          <div className="notes-loading-state">
            <RefreshCw size={24} className="animate-spin" />
            <p>Carregando anotações do servidor...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="notes-empty-state">
            <div className="empty-icon-box">
              <StickyNote size={40} />
            </div>
            <h3>Nenhuma anotação encontrada</h3>
            <p>
              {searchTerm || selectedCategory !== 'all' || selectedUserFilter !== 'all'
                ? 'Nenhuma anotação corresponde aos filtros selecionados. Tente limpar os filtros.'
                : 'Ainda não há anotações registradas. Crie a primeira para começar!'}
            </p>
            {searchTerm || selectedCategory !== 'all' || selectedUserFilter !== 'all' ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedUserFilter('all');
                }}
              >
                Limpar Filtros
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenCreateModal}
              >
                <Plus size={16} />
                <span>Criar Anotação</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="notes-grid">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                currentUser={currentUser}
                onClick={() => setDetailNote(note)}
                onEdit={(e) => {
                  e.stopPropagation();
                  handleOpenEditModal(note);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  setNoteToDelete(note);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="notes-table-container">
            <table className="notes-table">
              <thead>
                <tr>
                  <th style={{ width: '140px' }}>Categoria / Cor</th>
                  <th>Título & Prévia</th>
                  <th style={{ width: '180px' }}>Autor</th>
                  <th style={{ width: '160px' }}>Criado em</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Comentários</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotes.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    currentUser={currentUser}
                    onClick={() => setDetailNote(note)}
                    onEdit={(e) => {
                      e.stopPropagation();
                      handleOpenEditModal(note);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      setNoteToDelete(note);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      <NoteEditorModal
        isOpen={isEditorOpen}
        noteToEdit={noteToEdit}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveNote}
      />

      {/* Modal de Detalhes e Comentários */}
      <NoteDetailModal
        isOpen={Boolean(detailNote)}
        note={detailNote}
        currentUser={currentUser}
        onClose={() => setDetailNote(null)}
        onEdit={(note) => {
          setDetailNote(null);
          handleOpenEditModal(note);
        }}
        onDelete={(note) => {
          setDetailNote(null);
          setNoteToDelete(note);
        }}
        onCommentsUpdated={fetchNotes}
      />

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={Boolean(noteToDelete)}
        kicker="Excluir Anotação"
        title={`Deseja excluir "${noteToDelete?.title}"?`}
        message="Essa ação removerá permanentemente a anotação e todos os seus comentários."
        confirmLabel="Excluir Definitivamente"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
