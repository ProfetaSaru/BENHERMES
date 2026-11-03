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
  if (toolId === 'anotacoes') return true;

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

export function canExportWhatsappJson(role: UserRole): boolean {
  return role === 'admin';
}

export function canConfigureWhatsapp(role: UserRole): boolean {
  return role === 'admin';
}

export function canSeeAllMesas(role: UserRole): boolean {
  return role === 'admin' || role === 'gerente';
}

export function canExportWhatsappSpreadsheet(role: UserRole): boolean {
  return role === 'admin' || role === 'gerente' || role === 'supervisor';
}

export function canDeleteReports(role: UserRole): boolean {
  return role === 'admin';
}

export function canEditFeriados(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Modelos de relatÃ³rios autorizados exclusivamente para operadores (Atividades e TMA).
 */
export const OPERATOR_ALLOWED_TEMPLATE_IDS = [
  'atividades-padrao',
  'produtividade-atendimento',
] as const;

export function isTemplateAllowedForRole(role: UserRole | undefined, templateId: string): boolean {
  if (role === 'operador') {
    return OPERATOR_ALLOWED_TEMPLATE_IDS.includes(templateId as any);
  }
  return true;
}

/**
 * Extrai o primeiro e o Ãºltimo nome a partir de uma string de nome completo.
 * Exemplo: "Carlos Eduardo da Silva" -> "Carlos Silva"
 */
export function formatFirstAndLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/**
 * Formata o tÃ­tulo padronizado obrigatÃ³rio para relatÃ³rios de operador:
 * [PrimeiroNome] [UltimoNome] - [Data] - [Hora]
 * Exemplo: "Carlos Silva - 30/10/2026 - 12:45"
 */
export function formatOperatorReportTitle(
  user: { displayName?: string; username: string },
  displayDate?: string,
  displayTime?: string
): string {
  const rawName = user.displayName?.trim() || user.username?.trim() || 'Operador';
  const shortName = formatFirstAndLastName(rawName);

  let dateFormatted = '';
  if (displayDate && displayDate.includes('-')) {
    const parts = displayDate.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else {
      dateFormatted = displayDate;
    }
  } else if (displayDate) {
    dateFormatted = displayDate;
  } else {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    dateFormatted = `${dd}/${mm}/${yyyy}`;
  }

  let timeFormatted = displayTime?.trim() || '';
  if (!timeFormatted) {
    const now = new Date();
    timeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  return `${shortName} - ${dateFormatted} - ${timeFormatted}`;
}


