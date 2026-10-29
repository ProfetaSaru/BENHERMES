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
} from 'lucide-react';
import { AuthUser, ROLE_LABELS, UserRole } from '../../types/auth';
import { NotificationType } from '../../types/task';
import { apiRequest } from '../../utils/apiClient';

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

  // Edição inline de usuário
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('operador');
  const [editSupervisorId, setEditSupervisorId] = useState('');
  const [editPassword, setEditPassword] = useState('');

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
    setEditingUserId(u.id);
    setEditDisplayName(u.displayName);
    setEditRole(u.role);
    setEditSupervisorId(u.supervisorId || '');
    setEditPassword('');
  };

  const handleSaveEdit = async (u: AuthUser) => {
    try {
      await apiRequest(`/api/users/${encodeURIComponent(u.id)}`, {
        method: 'PUT',
        body: {
          displayName: editDisplayName.trim(),
          role: editRole,
          supervisorId: editRole === 'operador' ? editSupervisorId || null : null,
          password: editPassword.trim() ? editPassword.trim() : undefined,
        },
      });
      onNotify(`Conta "${editDisplayName.trim()}" atualizada!`, 'success');
      setEditingUserId(null);
      await loadUsers();
    } catch (err: any) {
      onNotify(err.message || 'Erro ao atualizar conta.', 'error');
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
                Supervisor Associado
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
      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <Users size={20} />
            Contas Cadastradas
          </h2>
        </div>

        {loading ? (
          <div className="formatter-field-sample">Carregando contas...</div>
        ) : (
          <div className="formatter-table-scroll">
            <table className="formatter-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Login</th>
                  <th>Perfil</th>
                  <th>Supervisor Associado</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isEditing = editingUserId === u.id;
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>
                        {isEditing ? (
                          <input
                            className="formatter-select"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            aria-label="Editar nome"
                          />
                        ) : (
                          u.displayName
                        )}
                      </td>
                      <td>
                        <code>{u.username}</code>
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="formatter-select"
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            aria-label="Editar perfil"
                          >
                            <option value="operador">Operador</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="gerente">Gerente</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="badge badge-primary">{ROLE_LABELS[u.role]}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          editRole === 'operador' ? (
                            <select
                              className="formatter-select"
                              value={editSupervisorId}
                              onChange={(e) => setEditSupervisorId(e.target.value)}
                              aria-label="Editar supervisor associado"
                            >
                              <option value="">Sem supervisor</option>
                              {supervisors.map((sup) => (
                                <option key={sup.id} value={sup.id}>
                                  {sup.displayName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )
                        ) : u.role === 'operador' ? (
                          u.supervisorName || (
                            <span style={{ color: 'var(--text-muted)' }}>Sem supervisor</span>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <KeyRound size={14} />
                            <input
                              id={`edit-password-${u.id}`}
                              name="new-password"
                              autoComplete="new-password"
                              type="password"
                              className="formatter-select"
                              placeholder="Nova senha (opcional)"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              aria-label="Nova senha opcional"
                            />
                          </div>
                        ) : u.active ? (
                          <span className="badge badge-success">Ativo</span>
                        ) : (
                          <span className="badge badge-muted">Inativo</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            gap: '0.4rem',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', width: 'auto' }}
                                onClick={() => handleSaveEdit(u)}
                                title="Salvar alterações"
                              >
                                <Check size={14} />
                                Salvar
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', width: 'auto' }}
                                onClick={() => setEditingUserId(null)}
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '5px 10px', width: 'auto', fontSize: '0.78rem' }}
                                onClick={() => startEditing(u)}
                                title="Editar nome, cargo, supervisor ou senha"
                              >
                                <Edit3 size={14} />
                                Editar / Senha
                              </button>
                              {u.id !== currentUser.id && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '5px 10px', width: 'auto', fontSize: '0.78rem' }}
                                    onClick={() => handleToggleActive(u)}
                                    title={u.active ? 'Desativar conta' : 'Ativar conta'}
                                  >
                                    {u.active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                    {u.active ? 'Desativar' : 'Ativar'}
                                  </button>
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
    </div>
  );
};

