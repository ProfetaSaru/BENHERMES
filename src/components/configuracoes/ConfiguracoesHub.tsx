import React, { useRef, useState } from 'react';
import { Settings, CalendarX2, Plus, Trash2, Upload, Flag, UserCheck, Sun, Moon, KeyRound } from 'lucide-react';
import * as XLSX from 'xlsx';
import { NotificationType } from '../../types/task';
import { AuthUser, canEditFeriados, ROLE_LABELS } from '../../types/auth';
import { ThemeMode } from '../../hooks/useTheme';
import { useFeriados } from '../../hooks/useFeriados';
import { apiRequest } from '../../utils/apiClient';
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
  currentUser?: AuthUser | null;
  theme?: ThemeMode;
  onToggleTheme?: () => void;
}

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

export const ConfiguracoesHub: React.FC<ConfiguracoesHubProps> = ({
  onNotify,
  currentUser,
  theme,
  onToggleTheme,
}) => {
  const { feriados, adicionar, remover } = useFeriados();
  const [data, setData] = useState('');
  const [descricao, setDescricao] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPassForm, setShowPassForm] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const handleTrocarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass || !newPass) {
      onNotify('Preencha a senha atual e a nova senha.', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      onNotify('A confirmação da senha não confere.', 'error');
      return;
    }
    try {
      setIsChangingPass(true);
      await apiRequest('/api/auth/password', {
        method: 'PUT',
        body: { currentPassword: currentPass, newPassword: newPass },
      });
      onNotify('Sua senha foi alterada com sucesso!', 'success');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      setShowPassForm(false);
    } catch (err: any) {
      onNotify(err.message || 'Erro ao alterar senha.', 'error');
    } finally {
      setIsChangingPass(false);
    }
  };

  const canEdit = currentUser ? canEditFeriados(currentUser.role) : true;

  const ano = Number(hojeIso().slice(0, 4));
  const nacionais = feriadosNacionaisDoAno(ano);
  const hoje = hojeIso();
  const proximos = feriados.filter((f) => f.data >= hoje);
  const passados = feriados.filter((f) => f.data < hoje);

  const handleAdicionar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
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
    if (!canEdit) return;
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
        {removivel && canEdit && (
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
            Dados da sua conta, preferência de tema e calendário de feriados locais sincronizado no servidor.
          </p>
        </div>
        <div className="task-count">
          <span className="task-count-number">{proximos.length}</span>
          <span className="task-count-label">feriados locais à frente</span>
        </div>
      </header>

      {currentUser && (
        <div className="formatter-card">
          <div className="formatter-card-header">
            <h2 className="formatter-card-title">
              <UserCheck size={20} />
              Minha Conta & Preferências
            </h2>
            {onToggleTheme && theme && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto' }}
                onClick={onToggleTheme}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
              </button>
            )}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            <div className="formatter-field-sample">
              <strong>Nome:</strong> {currentUser.displayName}
            </div>
            <div className="formatter-field-sample">
              <strong>Login:</strong> <code>{currentUser.username}</code>
            </div>
            <div className="formatter-field-sample">
              <strong>Perfil de Acesso:</strong> {ROLE_LABELS[currentUser.role]}
            </div>
            {currentUser.role === 'operador' && (
              <div className="formatter-field-sample">
                <strong>Supervisor Associado:</strong>{' '}
                {currentUser.supervisorName || 'Não vinculado'}
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            {!showPassForm ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: 'auto' }}
                onClick={() => setShowPassForm(true)}
              >
                <KeyRound size={15} />
                Alterar Minha Senha
              </button>
            ) : (
              <form onSubmit={handleTrocarSenha} style={{ maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <KeyRound size={16} /> Alterar Minha Senha
                </h3>

                <div>
                  <label htmlFor="user-current-pass" className="formatter-field-label">
                    Senha Atual
                  </label>
                  <input
                    id="user-current-pass"
                    name="current-password"
                    type="password"
                    autoComplete="current-password"
                    className="formatter-select"
                    style={{ width: '100%' }}
                    placeholder="Digite a senha atual"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="user-new-pass" className="formatter-field-label">
                    Nova Senha
                  </label>
                  <input
                    id="user-new-pass"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    className="formatter-select"
                    style={{ width: '100%' }}
                    placeholder="Digite a nova senha"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="user-confirm-pass" className="formatter-field-label">
                    Confirmar Nova Senha
                  </label>
                  <input
                    id="user-confirm-pass"
                    name="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    className="formatter-select"
                    style={{ width: '100%' }}
                    placeholder="Repita a nova senha"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={isChangingPass} style={{ width: 'auto' }}>
                    {isChangingPass ? 'Salvando...' : 'Salvar Nova Senha'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: 'auto' }}
                    onClick={() => {
                      setShowPassForm(false);
                      setCurrentPass('');
                      setNewPass('');
                      setConfirmPass('');
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {canEdit && (
        <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleImportar} style={{ display: 'none' }} />
      )}

      <div className="formatter-card">
        <div className="formatter-card-header">
          <h2 className="formatter-card-title">
            <CalendarX2 size={20} />
            Feriados locais
          </h2>
          {canEdit ? (
            <div className="formatter-actions-buttons escala-acoes">
              <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} />
                Importar feriados.xlsx
              </button>
            </div>
          ) : (
            <div className="badge-wrapper">
              <span className="badge badge-muted">Somente leitura · Gerenciado pelo Admin</span>
            </div>
          )}
        </div>

        <p className="ura-ajuda">
          Estaduais, municipais e pontos facultativos (Carnaval, Corpus Christi, aniversário da cidade...). Os
          nacionais já são considerados sozinhos e estão listados abaixo.
        </p>

        {canEdit && (
          <form className="config-feriado-form" onSubmit={handleAdicionar}>
            <input
              id="feriado-data"
              name="feriado-data"
              type="date"
              className="formatter-select"
              value={data}
              onChange={(e) => setData(e.target.value)}
              aria-label="Data do feriado"
            />
            <input
              id="feriado-descricao"
              name="feriado-descricao"
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
        )}

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
