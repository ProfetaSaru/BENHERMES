import React from 'react';
import { Menu, Layers, ShieldCheck, LogOut, UserCheck } from 'lucide-react';
import { NavigationItem } from '../../types/navigation';
import { AuthUser, ROLE_LABELS } from '../../types/auth';

interface TopNavbarProps {
  activeItem: NavigationItem;
  onOpenMobileSidebar: () => void;
  taskCount?: number;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeItem,
  onOpenMobileSidebar,
  taskCount = 0,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="top-navbar">
      <div className="top-navbar-left">
        <button
          type="button"
          className="top-navbar-menu-btn"
          onClick={onOpenMobileSidebar}
          aria-label="Abrir menu de navegação"
        >
          <Menu size={22} />
        </button>

        <div className="top-navbar-breadcrumbs">
          <span className="crumb-hub">
            <Layers size={14} />
            BenHermes
          </span>
          <span className="crumb-separator">/</span>
          <span className="crumb-current">{activeItem.name}</span>
        </div>
      </div>

      <div className="top-navbar-right" style={{ gap: '0.6rem' }}>
        {activeItem.id === 'relatorios' && taskCount > 0 && (
          <div className="top-navbar-badge">
            <ShieldCheck size={14} />
            <span>
              {taskCount} {taskCount === 1 ? 'item' : 'itens'}
            </span>
          </div>
        )}

        {currentUser && (
          <div
            className="top-navbar-status"
            title={
              currentUser.supervisorName
                ? `Supervisor: ${currentUser.supervisorName}`
                : `Logado como ${ROLE_LABELS[currentUser.role]}`
            }
          >
            <UserCheck size={15} />
            <span>
              <strong>{currentUser.displayName}</strong> · {ROLE_LABELS[currentUser.role]}
            </span>
            <span className="top-navbar-pulse" />
          </div>
        )}

        {onLogout && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '0.38rem 0.75rem', fontSize: '0.8rem' }}
            onClick={onLogout}
            title="Sair da conta"
          >
            <LogOut size={14} />
            Sair
          </button>
        )}
      </div>
    </header>
  );
};
