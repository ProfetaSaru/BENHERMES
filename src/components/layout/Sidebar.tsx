import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { NavigationItem } from '../../types/navigation';
import { ThemeMode } from '../../hooks/useTheme';
import { AuthUser, ROLE_LABELS } from '../../types/auth';

interface SidebarProps {
  items: NavigationItem[];
  activeToolId: string;
  onSelectTool: (toolId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  currentUser?: AuthUser | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeToolId,
  onSelectTool,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  theme,
  onToggleTheme,
  currentUser,
}) => {
  const automationItems = items.filter((item) => item.category === 'automacoes');
  const systemItems = items.filter((item) => item.category === 'sistema');

  const renderNavGroup = (title: string, groupItems: NavigationItem[]) => (
    <div className="sidebar-group">
      {!isCollapsed && <span className="sidebar-group-title">{title}</span>}
      <ul className="sidebar-list">
        {groupItems.map((item) => {
          const isActive = item.id === activeToolId;
          return (
            <li key={item.id} className="sidebar-list-item">
              <button
                type="button"
                className={`sidebar-nav-btn ${isActive ? 'active' : ''} ${!item.isReady ? 'is-upcoming' : ''}`}
                onClick={() => {
                  onSelectTool(item.id);
                  if (isMobileOpen) {
                    onCloseMobile();
                  }
                }}
                title={isCollapsed ? `${item.name}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>

                {!isCollapsed && (
                  <div className="sidebar-nav-content">
                    <span className="sidebar-nav-label">{item.name}</span>
                    {item.badge && (
                      <span className={`sidebar-nav-badge badge-${item.badgeVariant || 'muted'}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}

                {isCollapsed && item.badge && (
                  <span
                    className={`sidebar-collapsed-dot dot-${item.badgeVariant || 'muted'}`}
                    aria-hidden="true"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Navegação de Ferramentas"
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <Zap size={20} />
            </div>
            {!isCollapsed && (
              <div className="sidebar-brand-text">
                <span className="brand-title">BenHermes</span>
                <span className="brand-subtitle">Hub de Automações & Produtividade</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>

          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <div className="sidebar-scrollable">
          {renderNavGroup('Ferramentas & Automação', automationItems)}
          {renderNavGroup('Sistema & Apoio', systemItems)}
        </div>

        <div className="sidebar-footer">
          {!isCollapsed ? (
            <div className="sidebar-status-box">
              <div className="status-indicator-dot" />
              <div className="status-indicator-text">
                <span className="status-label">
                  {currentUser ? currentUser.displayName : 'Servidor Local'}
                </span>
                <span className="status-sub">
                  {currentUser
                    ? `${ROLE_LABELS[currentUser.role]}${
                        currentUser.supervisorName ? ` · Sup. ${currentUser.supervisorName}` : ''
                      }`
                    : 'Sincronizado'}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="sidebar-status-mini"
              title={
                currentUser
                  ? `${currentUser.displayName} (${ROLE_LABELS[currentUser.role]})`
                  : 'Servidor Local Ativo'
              }
            >
              <div className="status-indicator-dot" />
            </div>
          )}

          <button
            type="button"
            className="sidebar-theme-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            aria-label="Alternar tema"
          >
            <span className="sidebar-theme-icon">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </span>
            {!isCollapsed && (
              <div className="sidebar-theme-label">
                <span>{theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</span>
                <span className="sidebar-theme-tag">
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
