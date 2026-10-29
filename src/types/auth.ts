export type UserRole = 'admin' | 'gerente' | 'supervisor' | 'operador';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  supervisorId: string | null;
  supervisorName: string | null;
  active: boolean;
  createdAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  operador: 'Operador',
};

/**
 * Define quais abas cada perfil de login pode visualizar no menu.
 */
export function canSeeTool(role: UserRole, toolId: string): boolean {
  if (toolId === 'formatador') return false;
  if (toolId === 'usuarios') return role === 'admin';

  switch (role) {
    case 'admin':
      return true;
    case 'gerente':
    case 'supervisor':
      return ['relatorios', 'whatsapp', 'historico', 'configuracoes'].includes(toolId);
    case 'operador':
      return ['relatorios', 'historico', 'configuracoes'].includes(toolId);
    default:
      return false;
  }
}

export function canManageWhatsappMaintenance(role: UserRole): boolean {
  return role === 'admin';
}

export function canDeleteWhatsappItems(role: UserRole): boolean {
  return role === 'admin';
}

export function canImportOverwriteWhatsappMap(role: UserRole): boolean {
  return role === 'admin';
}

export function canDeleteReports(role: UserRole): boolean {
  return role === 'admin';
}

export function canEditFeriados(role: UserRole): boolean {
  return role === 'admin';
}

