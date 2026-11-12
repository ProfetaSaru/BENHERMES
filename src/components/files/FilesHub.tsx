import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  UploadCloud,
  Search,
  LayoutGrid,
  List,
  ChevronRight,
  ArrowLeft,
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileAudio,
  FileVideo,
  FileCode,
  Download,
  Trash2,
  Edit2,
  Eye,
  X,
  AlertTriangle,
  HardDrive,
  Loader2,
} from 'lucide-react';
import { SharedFolder, SharedFile, SharedBreadcrumb, FolderStats } from '../../types/navigation';
import { AuthUser, ROLE_LABELS } from '../../types/auth';
import { apiRequest, getStoredAuthToken } from '../../utils/apiClient';
interface FilesHubProps {
  currentUser: AuthUser;
  onNotify: (message: string, type: 'success' | 'error' | '') => void;
}
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
function getFileMeta(fileName: string, mimeType: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mimeType.includes('pdf')) {
    return {
      icon: <FileText size={24} />,
      color: '#ef4444',
      bg: '#fee2e2',
      typeLabel: 'PDF',
      previewable: true,
      previewType: 'pdf',
    };
  }
  if (
    ['xls', 'xlsx', 'csv', 'ods'].includes(ext) ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel')
  ) {
    return {
      icon: <FileSpreadsheet size={24} />,
      color: '#10b981',
      bg: '#d1fae5',
      typeLabel: 'Planilha',
      previewable: false,
    };
  }
  if (
    ['doc', 'docx', 'odt', 'rtf'].includes(ext) ||
    mimeType.includes('word') ||
    mimeType.includes('document')
  ) {
    return {
      icon: <FileText size={24} />,
      color: '#3b82f6',
      bg: '#dbeafe',
      typeLabel: 'Documento',
      previewable: false,
    };
  }
  if (
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ||
    mimeType.startsWith('image/')
  ) {
    return {
      icon: <FileImage size={24} />,
      color: '#8b5cf6',
      bg: '#ede9fe',
      typeLabel: 'Imagem',
      previewable: true,
      previewType: 'image',
    };
  }
  if (
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) ||
    mimeType.includes('zip') ||
    mimeType.includes('archive')
  ) {
    return {
      icon: <FileArchive size={24} />,
      color: '#f59e0b',
      bg: '#fef3c7',
      typeLabel: 'Arquivo ZIP',
      previewable: false,
    };
  }
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || mimeType.startsWith('audio/')) {
    return {
      icon: <FileAudio size={24} />,
      color: '#06b6d4',
      bg: '#cffafe',
      typeLabel: 'Áudio',
      previewable: false,
    };
  }
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext) || mimeType.startsWith('video/')) {
    return {
      icon: <FileVideo size={24} />,
      color: '#ec4899',
      bg: '#fce7f3',
      typeLabel: 'Vídeo',
      previewable: false,
    };
  }
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'py', 'sql'].includes(ext)) {
    return {
      icon: <FileCode size={24} />,
      color: '#6366f1',
      bg: '#e0e7ff',
      typeLabel: 'Código',
      previewable: false,
    };
  }
  return {
    icon: <File size={24} />,
    color: '#64748b',
    bg: '#f1f5f9',
    typeLabel: 'Arquivo',
    previewable: false,
  };
}
export const FilesHub: React.FC<FilesHubProps> = ({ currentUser: _currentUser, onNotify }) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolder, setCurrentFolder] = useState<SharedFolder | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<SharedBreadcrumb[]>([{ id: null, name: 'Início' }]);
  const [folders, setFolders] = useState<SharedFolder[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  // Uploading state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Modals state
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingItem, setRenamingItem] = useState<{
    id: string;
    type: 'folder' | 'file';
    name: string;
  } | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [deletingFolder, setDeletingFolder] = useState<{
    folder: SharedFolder;
    stats: FolderStats | null;
  } | null>(null);
  const [deletingFile, setDeletingFile] = useState<SharedFile | null>(null);
  const [previewFile, setPreviewFile] = useState<SharedFile | null>(null);
  // Carrega itens da pasta atual ou da busca
  const loadItems = useCallback(
    async (folderId: string | null, search = '') => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (folderId) params.set('folderId', folderId);
        if (search.trim()) params.set('search', search.trim());
        const res = await apiRequest<{
          currentFolder: SharedFolder | null;
          breadcrumbs: SharedBreadcrumb[];
          folders: SharedFolder[];
          files: SharedFile[];
        }>(`/api/files/items?${params.toString()}`);
        setFolders(res.folders || []);
        setFiles(res.files || []);
        setBreadcrumbs(res.breadcrumbs || [{ id: null, name: 'Início' }]);
        setCurrentFolder(res.currentFolder || null);
      } catch (err: any) {
        onNotify(err.message || 'Erro ao carregar arquivos.', 'error');
      } finally {
        setLoading(false);
      }
    },
    [onNotify]
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadItems(currentFolderId, searchQuery);
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [currentFolderId, searchQuery, loadItems]);
  // Manipulação de Upload
  const handleUploadFiles = async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;
    const items = Array.from(fileList);
    setUploading(true);
    setUploadProgress({ current: 0, total: items.length });
    let successCount = 0;
    const token = getStoredAuthToken();
    for (let i = 0; i < items.length; i++) {
      const file = items[i];
      setUploadProgress({ current: i + 1, total: items.length });
      
      try {
        const headers: Record<string, string> = {
          'x-file-name': encodeURIComponent(file.name),
          'content-type': file.type || 'application/octet-stream',
        };
        if (currentFolderId) {
          headers['x-folder-id'] = currentFolderId;
        }
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: file,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.erro || `Erro HTTP ${res.status}`);
        }
        successCount++;
      } catch (err: any) {
        onNotify(`Erro ao enviar "${file.name}": ${err.message}`, 'error');
      }
    }
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (successCount > 0) {
      onNotify(
        successCount === 1
          ? 'Arquivo enviado com sucesso!'
          : `${successCount} arquivos enviados com sucesso!`,
        'success'
      );
      void loadItems(currentFolderId, searchQuery);
    }
  };
  // Drag and drop events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleUploadFiles(e.dataTransfer.files);
    }
  };
  // Criar Pasta
  const handleConfirmCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await apiRequest('/api/files/folders', {
        method: 'POST',
        body: { name, parentId: currentFolderId },
      });
      onNotify(`Pasta "${name}" criada com sucesso!`, 'success');
      setNewFolderName('');
      setIsNewFolderModalOpen(false);
      void loadItems(currentFolderId, searchQuery);
    } catch (err: any) {
      onNotify(err.message || 'Erro ao criar pasta.', 'error');
    }
  };
  // Renomear Item (Pasta ou Arquivo)
  const handleStartRename = (item: { id: string; type: 'folder' | 'file'; name: string }) => {
    setRenamingItem(item);
    setRenameInputValue(item.name);
  };
  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem) return;
    const name = renameInputValue.trim();
    if (!name) return;
    try {
      if (renamingItem.type === 'folder') {
        await apiRequest(`/api/files/folders/${renamingItem.id}`, {
          method: 'PUT',
          body: { name },
        });
      } else {
        await apiRequest(`/api/files/${renamingItem.id}`, {
          method: 'PUT',
          body: { name },
        });
      }
      onNotify('Item renomeado com sucesso!', 'success');
      setRenamingItem(null);
      void loadItems(currentFolderId, searchQuery);
    } catch (err: any) {
      onNotify(err.message || 'Erro ao renomear item.', 'error');
    }
  };
  // Iniciar Exclusão de Pasta (obtém estatísticas)
  const handleStartDeleteFolder = async (folder: SharedFolder) => {
    try {
      const res = await apiRequest<{ stats: FolderStats }>(`/api/files/folders/${folder.id}/stats`);
      setDeletingFolder({ folder, stats: res.stats });
    } catch {
      setDeletingFolder({ folder, stats: null });
    }
  };
  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    try {
      await apiRequest(`/api/files/folders/${deletingFolder.folder.id}`, { method: 'DELETE' });
      onNotify(`Pasta "${deletingFolder.folder.name}" excluída com sucesso!`, 'success');
      setDeletingFolder(null);
      void loadItems(currentFolderId, searchQuery);
    } catch (err: any) {
      onNotify(err.message || 'Erro ao excluir pasta.', 'error');
    }
  };
  // Excluir Arquivo
  const handleConfirmDeleteFile = async () => {
    if (!deletingFile) return;
    try {
      await apiRequest(`/api/files/${deletingFile.id}`, { method: 'DELETE' });
      onNotify(`Arquivo "${deletingFile.name}" excluído com sucesso!`, 'success');
      setDeletingFile(null);
      void loadItems(currentFolderId, searchQuery);
    } catch (err: any) {
      onNotify(err.message || 'Erro ao excluir arquivo.', 'error');
    }
  };
  // Download do Arquivo
  const handleDownloadFile = (file: SharedFile) => {
    const token = getStoredAuthToken();
    const url = `/api/files/${file.id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    window.open(url, '_blank');
  };
  // Obter URL de Preview
  const getPreviewUrl = (file: SharedFile) => {
    const token = getStoredAuthToken();
    return `/api/files/${file.id}/view${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  };
  const hasItems = folders.length > 0 || files.length > 0;
  return (
    <div
      className="files-hub-container"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Input oculto para seleção de arquivos */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) void handleUploadFiles(e.target.files);
        }}
      />
      {/* Header Superior */}
      <header className="files-header">
        <div className="files-title-group">
          <h1>
            <HardDrive size={24} style={{ color: 'var(--blue, #2563eb)' }} />
            Arquivos da Gestão
          </h1>
          <p>
            {currentFolder
              ? `Pasta atual: ${currentFolder.name}`
              : 'Repositório de documentos, procedimentos e planilhas com controle de acesso.'}
          </p>
        </div>
        <div className="files-actions-bar">
          <div className="files-search-box">
            <Search size={16} className="files-search-icon" />
            <input
              type="text"
              placeholder="Buscar arquivos ou pastas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="files-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-icon-subtle"
                style={{ position: 'absolute', right: 6 }}
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="files-view-toggle">
            <button
              type="button"
              className={`files-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Visualização em Grade"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              className={`files-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Visualização em Lista"
            >
              <List size={16} />
            </button>
          </div>
          <button
            type="button"
            className="btn-file-action btn-file-secondary"
            onClick={() => {
              setNewFolderName('');
              setIsNewFolderModalOpen(true);
            }}
          >
            <FolderPlus size={16} />
            Nova Pasta
          </button>
          <button
            type="button"
            className="btn-file-action btn-file-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={16} />
            Enviar Arquivos
          </button>
        </div>
      </header>
      {/* Breadcrumbs de Navegação */}
      <nav className="files-breadcrumbs-bar" aria-label="Navegação em pastas">
        {currentFolderId && (
          <button
            type="button"
            className="crumb-btn"
            onClick={() => {
              const prev = breadcrumbs[breadcrumbs.length - 2];
              setCurrentFolderId(prev?.id ?? null);
            }}
            title="Voltar um nível"
          >
            <ArrowLeft size={14} />
          </button>
        )}
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.id || 'root'}>
              {idx > 0 && <ChevronRight size={14} className="crumb-separator" />}
              <button
                type="button"
                className={`crumb-btn ${isLast ? 'active' : ''}`}
                onClick={() => {
                  if (!isLast) setCurrentFolderId(crumb.id);
                }}
              >
                {idx === 0 ? <Folder size={15} /> : null}
                {crumb.name}
              </button>
            </React.Fragment>
          );
        })}
      </nav>
      {/* Banner de Upload em Andamento */}
      {uploading && (
        <div className="files-upload-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Loader2 size={18} className="spin-animate" />
            <span>
              Enviando arquivo {uploadProgress.current} de {uploadProgress.total}...
            </span>
          </div>
        </div>
      )}
      {/* Área Principal com Dropzone */}
      <div className={`files-dropzone ${isDragging ? 'is-dragging' : ''}`}>
        {isDragging && (
          <div className="files-drag-overlay">
            <UploadCloud size={48} />
            <span>Solte os arquivos aqui para enviar para esta pasta</span>
          </div>
        )}
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--muted, #64748b)' }}>
            <Loader2 size={32} className="spin-animate" style={{ margin: '0 auto 10px auto' }} />
            <p>Carregando arquivos...</p>
          </div>
        ) : !hasItems ? (
          <div className="files-empty-state">
            <FolderOpen size={48} className="files-empty-icon" />
            <h3>{searchQuery ? 'Nenhum resultado encontrado' : 'Esta pasta está vazia'}</h3>
            <p>
              {searchQuery
                ? `Nenhum arquivo ou pasta corresponde ao termo "${searchQuery}".`
                : 'Crie uma nova pasta ou arraste e solte arquivos aqui para começar.'}
            </p>
            {!searchQuery && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-file-action btn-file-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={15} />
                  Enviar Primeiro Arquivo
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* MODO EM GRADE (CARDS) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Seção de Pastas */}
            {folders.length > 0 && (
              <section className="files-section">
                <span className="files-section-title">
                  <Folder size={14} /> Pastas ({folders.length})
                </span>
                <div className="files-grid">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="folder-card"
                      onClick={() => setCurrentFolderId(folder.id)}
                      title={`Abrir pasta ${folder.name}`}
                    >
                      <div className="folder-card-main">
                        <Folder className="folder-card-icon" size={26} />
                        <div className="folder-card-info">
                          <span className="folder-card-name">{folder.name}</span>
                          <span className="folder-card-sub">
                            {folder.authorName} ({ROLE_LABELS[folder.authorRole] || folder.authorRole})
                          </span>
                        </div>
                      </div>
                      <div
                        className="folder-card-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {folder.canEdit && (
                          <>
                            <button
                              type="button"
                              className="btn-icon-subtle"
                              title="Renomear Pasta"
                              onClick={() =>
                                handleStartRename({
                                  id: folder.id,
                                  type: 'folder',
                                  name: folder.name,
                                })
                              }
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon-subtle btn-icon-danger"
                              title="Excluir Pasta"
                              onClick={() => void handleStartDeleteFolder(folder)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* Seção de Arquivos */}
            {files.length > 0 && (
              <section className="files-section">
                <span className="files-section-title">
                  <File size={14} /> Arquivos ({files.length})
                </span>
                <div className="files-grid">
                  {files.map((file) => {
                    const meta = getFileMeta(file.name, file.mimeType);
                    return (
                      <div key={file.id} className="file-card">
                        <div className="file-card-header">
                          <div
                            className="file-card-type-badge"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            {meta.icon}
                          </div>
                          <div className="file-card-details">
                            <span className="file-card-name" title={file.name}>
                              {file.name}
                            </span>
                            <span className="file-card-meta">
                              {formatBytes(file.sizeBytes)} • {meta.typeLabel}
                            </span>
                            <span className="file-card-author">
                              Enviado por: {file.authorName}
                            </span>
                          </div>
                        </div>
                        <div className="file-card-footer">
                          <span style={{ fontSize: '0.72rem', color: 'var(--muted, #64748b)' }}>
                            {formatDateTime(file.createdAt)}
                          </span>
                          <div className="file-card-actions">
                            {meta.previewable && (
                              <button
                                type="button"
                                className="btn-icon-subtle"
                                title="Pré-visualizar"
                                onClick={() => setPreviewFile(file)}
                              >
                                <Eye size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-icon-subtle"
                              title="Baixar Arquivo"
                              onClick={() => handleDownloadFile(file)}
                            >
                              <Download size={15} />
                            </button>
                            {file.canEdit && (
                              <>
                                <button
                                  type="button"
                                  className="btn-icon-subtle"
                                  title="Renomear Arquivo"
                                  onClick={() =>
                                    handleStartRename({
                                      id: file.id,
                                      type: 'file',
                                      name: file.name,
                                    })
                                  }
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon-subtle btn-icon-danger"
                                  title="Excluir Arquivo"
                                  onClick={() => setDeletingFile(file)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        ) : (
          /* MODO EM LISTA (TABELA) */
          <div className="files-table-wrap">
            <table className="files-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Tamanho</th>
                  <th>Enviado por</th>
                  <th>Data de Envio</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {folders.map((folder) => (
                  <tr
                    key={folder.id}
                    className="clickable-row"
                    onClick={() => setCurrentFolderId(folder.id)}
                  >
                    <td>
                      <div className="table-item-name">
                        <Folder size={18} style={{ color: '#f59e0b' }} />
                        <span>{folder.name}</span>
                      </div>
                    </td>
                    <td>Pasta</td>
                    <td>—</td>
                    <td>{folder.authorName}</td>
                    <td>{formatDateTime(folder.createdAt)}</td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      {folder.canEdit && (
                        <div style={{ display: 'inline-flex', gap: '0.2rem' }}>
                          <button
                            type="button"
                            className="btn-icon-subtle"
                            title="Renomear"
                            onClick={() =>
                              handleStartRename({
                                id: folder.id,
                                type: 'folder',
                                name: folder.name,
                              })
                            }
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-subtle btn-icon-danger"
                            title="Excluir"
                            onClick={() => void handleStartDeleteFolder(folder)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {files.map((file) => {
                  const meta = getFileMeta(file.name, file.mimeType);
                  return (
                    <tr key={file.id}>
                      <td>
                        <div className="table-item-name">
                          <span style={{ color: meta.color }}>{meta.icon}</span>
                          <span title={file.name}>{file.name}</span>
                        </div>
                      </td>
                      <td>{meta.typeLabel}</td>
                      <td>{formatBytes(file.sizeBytes)}</td>
                      <td>{file.authorName}</td>
                      <td>{formatDateTime(file.createdAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.2rem' }}>
                          {meta.previewable && (
                            <button
                              type="button"
                              className="btn-icon-subtle"
                              title="Visualizar"
                              onClick={() => setPreviewFile(file)}
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-icon-subtle"
                            title="Baixar"
                            onClick={() => handleDownloadFile(file)}
                          >
                            <Download size={15} />
                          </button>
                          {file.canEdit && (
                            <>
                              <button
                                type="button"
                                className="btn-icon-subtle"
                                title="Renomear"
                                onClick={() =>
                                  handleStartRename({
                                    id: file.id,
                                    type: 'file',
                                    name: file.name,
                                  })
                                }
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon-subtle btn-icon-danger"
                                title="Excluir"
                                onClick={() => setDeletingFile(file)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
{/* MODAL: NOVA PASTA */}
      {isNewFolderModalOpen && (
        <div className="preview-modal-backdrop" onClick={() => setIsNewFolderModalOpen(false)}>
          <div
            className="preview-modal-container"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-modal-header">
              <span className="preview-modal-title">
                <FolderPlus size={18} style={{ color: 'var(--blue, #2563eb)' }} />
                Criar Nova Pasta
              </span>
              <button
                type="button"
                className="btn-icon-subtle"
                onClick={() => setIsNewFolderModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmCreateFolder} style={{ padding: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--ink, #0f172a)',
                }}
              >
                Nome da Pasta
              </label>
              <input
                type="text"
                autoFocus
                placeholder="Ex: Treinamentos, Procedimentos..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                  marginBottom: '1.25rem',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-file-action btn-file-secondary"
                  onClick={() => setIsNewFolderModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="btn-file-action btn-file-primary"
                >
                  Criar Pasta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
{/* MODAL: RENOMEAR ITEM */}
      {renamingItem && (
        <div className="preview-modal-backdrop" onClick={() => setRenamingItem(null)}>
          <div
            className="preview-modal-container"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-modal-header">
              <span className="preview-modal-title">
                <Edit2 size={18} style={{ color: 'var(--blue, #2563eb)' }} />
                Renomear {renamingItem.type === 'folder' ? 'Pasta' : 'Arquivo'}
              </span>
              <button
                type="button"
                className="btn-icon-subtle"
                onClick={() => setRenamingItem(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmRename} style={{ padding: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  color: 'var(--ink, #0f172a)',
                }}
              >
                Novo Nome
              </label>
              <input
                type="text"
                autoFocus
                value={renameInputValue}
                onChange={(e) => setRenameInputValue(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                  marginBottom: '1.25rem',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-file-action btn-file-secondary"
                  onClick={() => setRenamingItem(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!renameInputValue.trim()}
                  className="btn-file-action btn-file-primary"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
{/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO DE PASTA COM CASCATA */}
      {deletingFolder && (
        <div className="preview-modal-backdrop" onClick={() => setDeletingFolder(null)}>
          <div
            className="preview-modal-container"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-modal-header">
              <span className="preview-modal-title" style={{ color: '#ef4444' }}>
                <AlertTriangle size={18} />
                Excluir pasta "{deletingFolder.folder.name}"?
              </span>
              <button
                type="button"
                className="btn-icon-subtle"
                onClick={() => setDeletingFolder(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--ink, #0f172a)', margin: 0 }}>
                Esta ação excluirá permanentemente a pasta e todo o seu conteúdo.
              </p>
              {deletingFolder.stats &&
                (deletingFolder.stats.folderCount > 0 || deletingFolder.stats.fileCount > 0) && (
                  <div
                    style={{
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      padding: '0.75rem 1rem',
                      marginTop: '1rem',
                      fontSize: '0.85rem',
                      color: '#991b1b',
                    }}
                  >
                    <strong>Atenção:</strong> Serão excluídas{' '}
                    <strong>{deletingFolder.stats.folderCount} subpastas</strong> e{' '}
                    <strong>{deletingFolder.stats.fileCount} arquivos</strong> (total de{' '}
                    {formatBytes(deletingFolder.stats.totalBytes)}).
                  </div>
                )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  marginTop: '1.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn-file-action btn-file-secondary"
                  onClick={() => setDeletingFolder(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-file-action"
                  style={{ background: '#ef4444', color: '#ffffff' }}
                  onClick={handleConfirmDeleteFolder}
                >
                  Excluir Tudo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
{/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO DE ARQUIVO */}
      {deletingFile && (
        <div className="preview-modal-backdrop" onClick={() => setDeletingFile(null)}>
          <div
            className="preview-modal-container"
            style={{ maxWidth: 450 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-modal-header">
              <span className="preview-modal-title" style={{ color: '#ef4444' }}>
                <Trash2 size={18} />
                Excluir arquivo?
              </span>
              <button
                type="button"
                className="btn-icon-subtle"
                onClick={() => setDeletingFile(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--ink, #0f172a)', margin: 0 }}>
                Tem certeza de que deseja excluir o arquivo <strong>"{deletingFile.name}"</strong>?
              </p>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  marginTop: '1.5rem',
                }}
              >
                <button
                  type="button"
                  className="btn-file-action btn-file-secondary"
                  onClick={() => setDeletingFile(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-file-action"
                  style={{ background: '#ef4444', color: '#ffffff' }}
                  onClick={handleConfirmDeleteFile}
                >
                  Excluir Arquivo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
{/* MODAL: PRÉ-VISUALIZAÇÃO DE ARQUIVO (PDF  IMAGEM) */}
      {previewFile && (
        <div className="preview-modal-backdrop" onClick={() => setPreviewFile(null)}>
          <div className="preview-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <span className="preview-modal-title">
                <Eye size={18} style={{ color: 'var(--blue, #2563eb)' }} />
                {previewFile.name}
              </span>
              <div className="preview-modal-actions">
                <button
                  type="button"
                  className="btn-file-action btn-file-primary"
                  onClick={() => handleDownloadFile(previewFile)}
                >
                  <Download size={15} />
                  Baixar
                </button>
                <button
                  type="button"
                  className="btn-icon-subtle"
                  onClick={() => setPreviewFile(null)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="preview-modal-body">
              {previewFile.mimeType.includes('pdf') || previewFile.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={getPreviewUrl(previewFile)}
                  title={previewFile.name}
                  className="preview-iframe"
                />
              ) : (
                <img
                  src={getPreviewUrl(previewFile)}
                  alt={previewFile.name}
                  className="preview-image"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};