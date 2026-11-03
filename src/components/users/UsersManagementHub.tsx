import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  Edit3,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AuthUser, ROLE_LABELS, UserRole } from '../../types/auth';
import { NotificationType } from '../../types/task';
import { apiRequest } from '../../utils/apiClient';
import { Button } from '../common/Button';

interface UsersManagementHubProps {
  currentUser: AuthUser;
  onNotify: (message: string, type?: NotificationType) => void;
}

export const UsersManagementHub: React.FC<UsersManagementHubProps> = ({
  currentUser,
  onNotify,
}) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulário de nova conta
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operador');
  const [supervisorId, setSupervisorId] = useState('');

  // Edição em modal de usuário e senha
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('operador');
  const [editSupervisorId, setEditSupervisorId] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ users: AuthUser[] }>('/api/users');
      setUsers(res.users || []);
    } catch (err: any) {
      onNotify(err.message || 'Erro ao carregar usuários.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!editingUser) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingUser(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingUser]);

  const supervisors = users.filter((u) => u.role === 'supervisor' && u.active);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim() || !password) {
      onNotify('Preencha login, nome e senha para criar a conta.', 'error');
      return;
    }

    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: {
          username: username.trim(),
          displayName: displayName.trim(),
          password,
          role,
          supervisorId: role === 'operador' ? supervisorId || null : null,
        },
      });
      onNotify(`Conta "${displayName.trim()}" (${ROLE_LABELS[role]}) criada com sucesso!`, 'success');
      setUsername('');
      setDisplayName('');
      setPassword('');
      setRole('operador');
      setSupervisorId('');
      await loadUsers();
    } catch (err: any) {
      onNotify(err.message || 'Erro ao criar conta.', 'error');
    }
  };

  const startEditing = (u: AuthUser) => {
    setEditingUser(u);
    setEditDisplayName(u.displayName);
    setEditRole(u.role);
    setEditSupervisorId(u.supervisorId || '');
    setEditPassword('');
    setShowEditPassword(false);
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingUser) return;
    if (!editDisplayName.trim()) {
      onNotify('O nome do usuário não pode ficar em branco.', 'error');
      return;
    }

    try {
      setIsSavingEdit(true);
      await apiRequest(`/api/users/${encodeURIComponent(editingUser.id)}`, {
        method: 'PUT',
        body: {
          displayName: editDisplayName.trim(),
          role: editRole,
          supervisorId: editRole === 'operador' ? editSupervisorId || null : null,
          password: editPassword.trim() ? editPassword.trim() : undefined,
        },
      });
      onNotify(`Conta "${editDisplayName.trim()}" atualizada com sucesso!`, 'success');
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      onNotify(err.message || 'Erro ao atualizar conta.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleActive = async (u: AuthUser) => {
    if (u.id === currentUser.id) {
      onNotify('Você não pode desativar sua própria conta.', 'error');
      return;
    }
    try {
      await apiRequest(`/api/users/${encodeURIComponent(u.id)}`, {
        method: 'PUT',
        body: { active: !u.active },
      });
      onNotify(
        `Conta "${u.displayName}" ${!u.active ? 'ativada' : 'desativada'}.`,
        'success'
      );
      await loadUsers();
    } catch (err: any) {
      onNotify(err.message || 'Erro ao alterar status da conta.', 'error');
    }
  };

  const handleDeleteUser = async (u: AuthUser) => {
    if (u.id === currentUser.id) {
      onNotify('Você não pode excluir sua própria conta.', 'error');
      return;
    }
    const confirmed = window.confirm(
      `Excluir a conta "${u.displayName}" (${u.username}) permanentemente?`
    );
    if (!confirmed) return;

    try {
      await apiRequest(`/api/users/${encodeURIComponent(u.id)}`, {
        method: 'DELETE',
      });
      onNotify(`Conta "${u.displayName}" removida.`, 'success');
      await loadUsers();
    } catch (err: any) {
      onNotify(err.message || 'Erro ao excluir conta.', 'error');
    }
  };

  return (
    <div className="formatter-root">
      <header className="formatter-header">
        <div className="formatter-header-info">
          <p className="eyebrow">ADMINISTRAÇÃO & ACESSOS</p>
          <h1>
            <Users size={32} />
            Gestão de Contas e Hierarquia
          </h1>
          <p>
            Crie contas de Admin, Gerente, Supervisor e Operador, associe operadores aos seus
            respectivos supervisores e gerencie senhas e permissões.
          </p>
        </div>
        <div className="task-count">
          <span className="task-count-number">{users.length}</span>
          <span className="task-count-label">contas cadastradas</span>
        </div>
      </header>

      {/* Card de Criação de Nova Conta */}
      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <UserPlus size={20} />
            Criar Nova Conta
          </h2>
        </div>

        <form
          onSubmit={handleCreateUser}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.85rem',
            alignItems: 'end',
          }}
        >
          <div>
            <label className="formatter-field-label" htmlFor="new-user-login">
              Login de Acesso
            </label>
            <input
              id="new-user-login"
              name="username"
              autoComplete="username"
              className="formatter-select"
              style={{ width: '100%' }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex.: joao.silva"
            />
          </div>

          <div>
            <label className="formatter-field-label" htmlFor="new-user-name">
              Nome Completo / Exibição
            </label>
            <input
              id="new-user-name"
              name="displayName"
              autoComplete="name"
              className="formatter-select"
              style={{ width: '100%' }}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex.: João Silva"
            />
          </div>

          <div>
            <label className="formatter-field-label" htmlFor="new-user-pass">
              Senha Inicial
            </label>
            <input
              id="new-user-pass"
              name="password"
              type="password"
              autoComplete="new-password"
              className="formatter-select"
              style={{ width: '100%' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha de acesso"
            />
          </div>

          <div>
            <label className="formatter-field-label" htmlFor="new-user-role">
              Tipo de Login (Cargo)
            </label>
            <select
              id="new-user-role"
              name="role"
              className="formatter-select"
              style={{ width: '100%' }}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="operador">Operador</option>
              <option value="supervisor">Supervisor</option>
              <option value="gerente">Gerente</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {role === 'operador' && (
            <div>
              <label className="formatter-field-label" htmlFor="new-user-sup">
                Supervisor
              </label>
              <select
                id="new-user-sup"
                name="supervisorId"
                className="formatter-select"
                style={{ width: '100%' }}
                value={supervisorId}
                onChange={(e) => setSupervisorId(e.target.value)}
              >
                <option value="">Sem supervisor vinculado</option>
                {supervisors.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.displayName} ({sup.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <UserPlus size={16} />
              Criar Conta
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Contas */}
      <div className="users-mgmt-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <Users size={20} />
            Contas Cadastradas
          </h2>
        </div>

        {loading ? (
          <div className="formatter-field-sample">Carregando contas...</div>
        ) : (
          <div className="users-table-scroll">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Login</th>
                  <th>Perfil</th>
                  <th>Supervisor</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.displayName}</td>
                      <td>
                        <code>{u.username}</code>
                      </td>
                      <td>
                        <span className="badge badge-primary">{ROLE_LABELS[u.role]}</span>
                      </td>
                      <td>
                        {u.role === 'operador' ? (
                          u.supervisorName || (
                            <span style={{ color: 'var(--text-muted)' }}>Sem supervisor</span>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {u.active ? (
                          <span className="badge badge-success">Ativo</span>
                        ) : (
                          <span className="badge badge-muted">Inativo</span>
                        )}
                      </td>
                      <td className="users-col-actions">
                        <div className="users-actions-group">
                          <Button
                            variant="secondary"
                            icon={<Edit3 size={14} />}
                            onClick={() => startEditing(u)}
                            title="Editar dados da conta e redefinir senha"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            Editar / Senha
                          </Button>
                          {u.id !== currentUser.id && (
                            <>
                              <Button
                                variant="secondary"
                                icon={u.active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                onClick={() => handleToggleActive(u)}
                                title={u.active ? 'Desativar conta' : 'Ativar conta'}
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              >
                                {u.active ? 'Desativar' : 'Ativar'}
                              </Button>
                              <button
                                type="button"
                                className="ura-arquivo-remover"
                                onClick={() => handleDeleteUser(u)}
                                title="Excluir conta"
                                aria-label={`Excluir conta ${u.displayName}`}
                              >
                                <Trash2 size={16} />
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

      {/* Modal de Edição de Conta & Redefinição de Senha */}
      {editingUser && (
        <div
          className="modal-backdrop"
          onClick={() => setEditingUser(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '100%' }}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <p className="modal-kicker">GESTÃO DE ACESSO</p>
                <h3 className="modal-title">Editar Conta &amp; Senha</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingUser(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleSaveEdit}
              className="modal-body"
              style={{ padding: '20px 24px', overflowY: 'auto' }}
            >
              <div className="user-edit-modal-form">
                <div className="form-group">
                  <label htmlFor="edit-username">Login de Acesso (Identificador)</label>
                  <input
                    id="edit-username"
                    className="formatter-select"
                    value={editingUser.username}
                    disabled
                    style={{
                      background: 'var(--paper-surface)',
                      cursor: 'not-allowed',
                      opacity: 0.8,
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-display-name">Nome Completo / Exibição</label>
                  <input
                    id="edit-display-name"
                    className="formatter-select"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Nome completo do usuário"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-role">Tipo de Login (Cargo)</label>
                  <select
                    id="edit-role"
                    className="formatter-select"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                  >
                    <option value="operador">Operador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="gerente">Gerente</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {editRole === 'operador' && (
                  <div className="form-group">
                    <label htmlFor="edit-supervisor">Supervisor</label>
                    <select
                      id="edit-supervisor"
                      className="formatter-select"
                      value={editSupervisorId}
                      onChange={(e) => setEditSupervisorId(e.target.value)}
                    >
                      <option value="">Sem supervisor vinculado</option>
                      {supervisors
                        .filter((s) => s.id !== editingUser.id)
                        .map((sup) => (
                          <option key={sup.id} value={sup.id}>
                            {sup.displayName} ({sup.username})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="user-edit-modal-password-box">
                  <div className="user-edit-modal-password-header">
                    <KeyRound size={16} style={{ color: 'var(--blue)' }} />
                    <span>Redefinir Senha de Acesso</span>
                  </div>
                  <p className="user-edit-modal-password-desc">
                    Deixe em branco para manter a senha atual inalterada. Preencha apenas caso queira cadastrar uma nova senha para este usuário.
                  </p>
                  <div className="user-password-input-wrap">
                    <input
                      id="edit-password"
                      name="new-password"
                      type={showEditPassword ? 'text' : 'password'}
                      className="formatter-select"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Digite a nova senha..."
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="user-password-toggle-btn"
                      onClick={() => setShowEditPassword((prev) => !prev)}
                      title={showEditPassword ? 'Ocultar senha' : 'Ver senha'}
                      aria-label="Alternar visibilidade da senha"
                    >
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setEditingUser(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  icon={<Check size={16} />}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

