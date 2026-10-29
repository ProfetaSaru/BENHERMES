import React, { useState } from 'react';
import { Lock, User, LogIn, ShieldCheck, Sun, Moon } from 'lucide-react';
import { AuthUser } from '../../types/auth';
import { apiRequest, setStoredAuthToken } from '../../utils/apiClient';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  theme,
  onToggleTheme,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Preencha o usuário e a senha.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ user: AuthUser; token: string }>('/api/auth/login', {
        method: 'POST',
        body: { username: username.trim(), password },
      });
      setStoredAuthToken(res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'fixed', top: '1rem', right: '1rem' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onToggleTheme}
          style={{ width: 'auto', padding: '0.5rem 0.85rem' }}
          title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        </button>
      </div>

      <div
        className="formatter-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2rem',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(245, 197, 24, 0.14)',
              border: '1px solid rgba(245, 197, 24, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--yellow)',
              marginBottom: '0.85rem',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
            BENHERMES
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
            Servidor Local · Entre com sua conta corporativa
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="login-username" className="formatter-field-label">
              Usuário
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="login-username"
                type="text"
                className="formatter-select"
                style={{ width: '100%', paddingLeft: '36px' }}
                placeholder="Ex.: admin, supervisor1, operador1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="formatter-field-label">
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="login-password"
                type="password"
                className="formatter-select"
                style={{ width: '100%', paddingLeft: '36px' }}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div
              className="escala-aviso"
              role="alert"
              style={{
                padding: '0.65rem 0.85rem',
                fontSize: '0.85rem',
                borderRadius: '8px',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: '0.35rem', width: '100%', justifyContent: 'center' }}
          >
            <LogIn size={16} />
            {loading ? 'Entrando...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
};

