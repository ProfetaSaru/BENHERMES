import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, verifyPassword, type UserRole } from './auth.ts';

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  supervisorId: string | null;
  supervisorName: string | null;
  active: boolean;
  createdAt: string;
}

export interface StoredReportRow {
  id: string;
  userId: string;
  authorName: string;
  authorRole: UserRole;
  supervisorId: string | null;
  supervisorName: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  displayDate: string;
  displayTime: string;
  templateId: string;
  templateTitle: string;
  templateCategory: string;
  isExpandable: boolean;
  fieldValues: Record<string, string>;
  tasks: any[];
  reportText: string;
  taskCount: number;
  periodSummary: string;
  note?: string;
}

export interface UserDraftState {
  activeTemplateId: string;
  tasksByTemplate: Record<string, any[]>;
  fieldsByTemplate: Record<string, Record<string, string>>;
  activeReportIds: Record<string, string>;
  customTemplates: any[];
  theme?: 'light' | 'dark';
}

export class AppDatabase {
  public db: DatabaseSync;

  constructor(dbFilePath?: string) {
    const resolvedPath =
      dbFilePath ||
      path.join(process.env.DATA_DIR || path.resolve(process.cwd(), 'data'), 'benhermes.db');

    if (resolvedPath !== ':memory:') {
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(resolvedPath);
    this.initSchema();
    this.seedInitialAdmin();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'gerente', 'supervisor', 'operador')),
        supervisor_id TEXT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        display_date TEXT NOT NULL,
        display_time TEXT NOT NULL,
        template_id TEXT NOT NULL,
        template_title TEXT NOT NULL,
        template_category TEXT NOT NULL,
        is_expandable INTEGER NOT NULL DEFAULT 1,
        field_values_json TEXT NOT NULL DEFAULT '{}',
        tasks_json TEXT NOT NULL DEFAULT '[]',
        report_text TEXT NOT NULL DEFAULT '',
        task_count INTEGER NOT NULL DEFAULT 0,
        period_summary TEXT NOT NULL DEFAULT 'Sem tarefas',
        note TEXT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
      CREATE INDEX IF NOT EXISTS idx_reports_updated_at ON reports(updated_at DESC);

      CREATE TABLE IF NOT EXISTS drafts (
        user_id TEXT PRIMARY KEY,
        active_template_id TEXT NOT NULL DEFAULT 'atividades-padrao',
        tasks_by_template_json TEXT NOT NULL DEFAULT '{}',
        fields_by_template_json TEXT NOT NULL DEFAULT '{}',
        active_report_ids_json TEXT NOT NULL DEFAULT '{}',
        custom_templates_json TEXT NOT NULL DEFAULT '[]',
        theme TEXT NOT NULL DEFAULT 'light',
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    try {
      this.db.exec(`ALTER TABLE drafts ADD COLUMN theme TEXT NOT NULL DEFAULT 'light';`);
    } catch {
      // Já existe
    }
  }

  private seedInitialAdmin(): void {
    const existingAdmin = this.db
      .prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`)
      .get() as { id: string } | undefined;

    if (existingAdmin) return;

    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = (process.env.ADMIN_NAME || 'Administrador').trim();

    this.db
      .prepare(
        `INSERT INTO users (id, username, display_name, password_hash, role, supervisor_id, active, created_at)
         VALUES (?, ?, ?, ?, 'admin', NULL, 1, ?)`
      )
      .run(
        crypto.randomUUID(),
        adminUsername,
        adminName,
        hashPassword(adminPassword),
        new Date().toISOString()
      );
  }

  private mapUserRow(row: any): PublicUser {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role as UserRole,
      supervisorId: row.supervisor_id || null,
      supervisorName: row.supervisor_name || null,
      active: Boolean(row.active),
      createdAt: row.created_at,
    };
  }

  public authenticateUser(username: string, password: string): PublicUser | null {
    const row = this.db
      .prepare(
        `SELECT u.*, sup.display_name AS supervisor_name
         FROM users u
         LEFT JOIN users sup ON u.supervisor_id = sup.id
         WHERE u.username = ? COLLATE NOCASE`
      )
      .get(username.trim()) as any;

    if (!row || !row.active) return null;
    if (!verifyPassword(password, row.password_hash)) return null;
    return this.mapUserRow(row);
  }

  public getUserById(id: string): PublicUser | null {
    const row = this.db
      .prepare(
        `SELECT u.*, sup.display_name AS supervisor_name
         FROM users u
         LEFT JOIN users sup ON u.supervisor_id = sup.id
         WHERE u.id = ?`
      )
      .get(id) as any;

    if (!row) return null;
    return this.mapUserRow(row);
  }

  public listUsers(): PublicUser[] {
    const rows = this.db
      .prepare(
        `SELECT u.*, sup.display_name AS supervisor_name
         FROM users u
         LEFT JOIN users sup ON u.supervisor_id = sup.id
         ORDER BY
           CASE u.role
             WHEN 'admin' THEN 1
             WHEN 'gerente' THEN 2
             WHEN 'supervisor' THEN 3
             ELSE 4
           END,
           u.display_name ASC`
      )
      .all() as any[];

    return rows.map((r) => this.mapUserRow(r));
  }

  public createUser(params: {
    username: string;
    displayName: string;
    password: string;
    role: UserRole;
    supervisorId?: string | null;
  }): PublicUser {
    const username = params.username.trim();
    const displayName = params.displayName.trim();
    if (!username || !displayName || !params.password) {
      throw new Error('Usuário, nome de exibição e senha são obrigatórios.');
    }

    const existing = this.db
      .prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE`)
      .get(username);
    if (existing) {
      throw new Error(`O login "${username}" já está em uso.`);
    }

    const supervisorId =
      params.role === 'operador' && params.supervisorId ? params.supervisorId : null;

    if (supervisorId) {
      const sup = this.getUserById(supervisorId);
      if (!sup || sup.role !== 'supervisor') {
        throw new Error('O supervisor selecionado é inválido.');
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO users (id, username, display_name, password_hash, role, supervisor_id, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(id, username, displayName, hashPassword(params.password), params.role, supervisorId, now);

    return this.getUserById(id)!;
  }

  public updateUser(
    id: string,
    params: {
      displayName?: string;
      role?: UserRole;
      supervisorId?: string | null;
      active?: boolean;
      password?: string;
    }
  ): PublicUser {
    const current = this.getUserById(id);
    if (!current) {
      throw new Error('Usuário não encontrado.');
    }

    const nextRole = params.role ?? current.role;
    const nextName = params.displayName !== undefined ? params.displayName.trim() : current.displayName;
    if (!nextName) {
      throw new Error('O nome de exibição não pode ficar vazio.');
    }

    const nextSupervisorId =
      nextRole === 'operador'
        ? params.supervisorId !== undefined
          ? params.supervisorId || null
          : current.supervisorId
        : null;

    if (nextSupervisorId) {
      const sup = this.getUserById(nextSupervisorId);
      if (!sup || sup.role !== 'supervisor') {
        throw new Error('O supervisor selecionado é inválido.');
      }
    }

    const nextActive = params.active !== undefined ? (params.active ? 1 : 0) : current.active ? 1 : 0;

    this.db
      .prepare(
        `UPDATE users
         SET display_name = ?, role = ?, supervisor_id = ?, active = ?
         WHERE id = ?`
      )
      .run(nextName, nextRole, nextSupervisorId, nextActive, id);

    if (params.password && params.password.trim()) {
      this.db
        .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
        .run(hashPassword(params.password), id);
    }

    return this.getUserById(id)!;
  }

  public deleteUser(id: string): void {
    // Desvincula operadores caso um supervisor seja removido
    this.db.prepare(`UPDATE users SET supervisor_id = NULL WHERE supervisor_id = ?`).run(id);
    this.db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  }

  public changeUserPassword(userId: string, currentPass: string, newPass: string): void {
    if (!newPass || !newPass.trim()) {
      throw new Error('A nova senha não pode ser vazia.');
    }
    const row = this.db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(userId) as
      | { password_hash: string }
      | undefined;
    if (!row) {
      throw new Error('Usuário não encontrado.');
    }
    if (!verifyPassword(currentPass, row.password_hash)) {
      throw new Error('A senha atual informada está incorreta.');
    }
    this.db
      .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
      .run(hashPassword(newPass.trim()), userId);
  }

  private mapReportRow(row: any): StoredReportRow {
    let fieldValues: Record<string, string> = {};
    let tasks: any[] = [];
    try {
      fieldValues = JSON.parse(row.field_values_json || '{}');
    } catch {
      fieldValues = {};
    }
    try {
      tasks = JSON.parse(row.tasks_json || '[]');
    } catch {
      tasks = [];
    }

    return {
      id: row.id,
      userId: row.user_id,
      authorName: row.author_name || 'Usuário',
      authorRole: (row.author_role || 'operador') as UserRole,
      supervisorId: row.supervisor_id || null,
      supervisorName: row.supervisor_name || null,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      displayDate: row.display_date,
      displayTime: row.display_time,
      templateId: row.template_id,
      templateTitle: row.template_title,
      templateCategory: row.template_category,
      isExpandable: Boolean(row.is_expandable),
      fieldValues,
      tasks,
      reportText: row.report_text || '',
      taskCount: Number(row.task_count) || 0,
      periodSummary: row.period_summary || 'Sem tarefas',
      note: row.note || undefined,
    };
  }

  /**
   * Lista relatórios respeitando a hierarquia de visualização:
   * - Admin e Gerente: veem todos os relatórios (de supervisores, operadores, etc.)
   * - Supervisor: vê seus próprios relatórios + os relatórios dos operadores associados a si
   * - Operador: vê apenas os seus próprios relatórios
   */
  public listReportsForUser(user: PublicUser): StoredReportRow[] {
    const baseSelect = `
      SELECT
        r.*,
        u.display_name AS author_name,
        u.role AS author_role,
        u.supervisor_id AS supervisor_id,
        sup.display_name AS supervisor_name
      FROM reports r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users sup ON u.supervisor_id = sup.id
    `;

    if (user.role === 'admin' || user.role === 'gerente') {
      const rows = this.db
        .prepare(`${baseSelect} ORDER BY r.updated_at DESC, r.created_at DESC`)
        .all() as any[];
      return rows.map((r) => this.mapReportRow(r));
    }

    if (user.role === 'supervisor') {
      const rows = this.db
        .prepare(
          `${baseSelect}
           WHERE r.user_id = ? OR (u.role = 'operador' AND u.supervisor_id = ?)
           ORDER BY r.updated_at DESC, r.created_at DESC`
        )
        .all(user.id, user.id) as any[];
      return rows.map((r) => this.mapReportRow(r));
    }

    const rows = this.db
      .prepare(`${baseSelect} WHERE r.user_id = ? ORDER BY r.updated_at DESC, r.created_at DESC`)
      .all(user.id) as any[];
    return rows.map((r) => this.mapReportRow(r));
  }

  public getReportById(id: string): StoredReportRow | null {
    const row = this.db
      .prepare(
        `SELECT
           r.*,
           u.display_name AS author_name,
           u.role AS author_role,
           u.supervisor_id AS supervisor_id,
           sup.display_name AS supervisor_name
         FROM reports r
         JOIN users u ON r.user_id = u.id
         LEFT JOIN users sup ON u.supervisor_id = sup.id
         WHERE r.id = ?`
      )
      .get(id) as any;

    if (!row) return null;
    return this.mapReportRow(row);
  }

  /**
   * Cria ou atualiza um relatório (usado tanto no salvamento manual quanto no auto-save).
   */
  public upsertReport(
    user: PublicUser,
    params: {
      id?: string;
      title: string;
      displayDate: string;
      displayTime: string;
      templateId: string;
      templateTitle: string;
      templateCategory: string;
      isExpandable: boolean;
      fieldValues: Record<string, string>;
      tasks: any[];
      reportText: string;
      taskCount: number;
      periodSummary: string;
      note?: string;
    }
  ): StoredReportRow {
    const now = new Date().toISOString();
    const existing = params.id ? this.getReportById(params.id) : null;

    if (existing && existing.userId === user.id) {
      this.db
        .prepare(
          `UPDATE reports
           SET title = ?,
               updated_at = ?,
               display_date = ?,
               display_time = ?,
               template_id = ?,
               template_title = ?,
               template_category = ?,
               is_expandable = ?,
               field_values_json = ?,
               tasks_json = ?,
               report_text = ?,
               task_count = ?,
               period_summary = ?,
               note = ?
           WHERE id = ? AND user_id = ?`
        )
        .run(
          params.title,
          now,
          params.displayDate,
          params.displayTime,
          params.templateId,
          params.templateTitle,
          params.templateCategory,
          params.isExpandable ? 1 : 0,
          JSON.stringify(params.fieldValues || {}),
          JSON.stringify(params.tasks || []),
          params.reportText || '',
          params.taskCount ?? (params.tasks?.length || 0),
          params.periodSummary || 'Sem tarefas',
          params.note ?? existing.note ?? null,
          existing.id,
          user.id
        );

      return this.getReportById(existing.id)!;
    }

    const newId = existing ? crypto.randomUUID() : params.id || crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO reports (
           id, user_id, title, created_at, updated_at, display_date, display_time,
           template_id, template_title, template_category, is_expandable,
           field_values_json, tasks_json, report_text, task_count, period_summary, note
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        newId,
        user.id,
        params.title,
        now,
        now,
        params.displayDate,
        params.displayTime,
        params.templateId,
        params.templateTitle,
        params.templateCategory,
        params.isExpandable ? 1 : 0,
        JSON.stringify(params.fieldValues || {}),
        JSON.stringify(params.tasks || []),
        params.reportText || '',
        params.taskCount ?? (params.tasks?.length || 0),
        params.periodSummary || 'Sem tarefas',
        params.note ?? null
      );

    return this.getReportById(newId)!;
  }

  public renameReport(id: string, newTitle: string, user: PublicUser): StoredReportRow {
    const existing = this.getReportById(id);
    if (!existing) throw new Error('Relatório não encontrado.');
    if (existing.userId !== user.id && user.role !== 'admin') {
      throw new Error('Você só pode renomear seus próprios relatórios.');
    }
    this.db
      .prepare(`UPDATE reports SET title = ?, updated_at = ? WHERE id = ?`)
      .run(newTitle.trim() || existing.title, new Date().toISOString(), id);
    return this.getReportById(id)!;
  }

  public deleteReport(id: string): void {
    this.db.prepare(`DELETE FROM reports WHERE id = ?`).run(id);
  }

  public clearAllReports(): void {
    this.db.prepare(`DELETE FROM reports`).run();
  }

  public getUserDrafts(userId: string): UserDraftState {
    const row = this.db
      .prepare(`SELECT * FROM drafts WHERE user_id = ?`)
      .get(userId) as any;

    if (!row) {
      return {
        activeTemplateId: 'atividades-padrao',
        tasksByTemplate: {},
        fieldsByTemplate: {},
        activeReportIds: {},
        customTemplates: [],
        theme: 'light',
      };
    }

    const safeParse = <T>(raw: string, fallback: T): T => {
      try {
        return JSON.parse(raw) ?? fallback;
      } catch {
        return fallback;
      }
    };

    return {
      activeTemplateId: row.active_template_id || 'atividades-padrao',
      tasksByTemplate: safeParse(row.tasks_by_template_json, {}),
      fieldsByTemplate: safeParse(row.fields_by_template_json, {}),
      activeReportIds: safeParse(row.active_report_ids_json, {}),
      customTemplates: safeParse(row.custom_templates_json, []),
      theme: row.theme === 'dark' ? 'dark' : 'light',
    };
  }

  public saveUserDrafts(userId: string, state: Partial<UserDraftState>): UserDraftState {
    const current = this.getUserDrafts(userId);
    const merged: UserDraftState = {
      activeTemplateId: state.activeTemplateId ?? current.activeTemplateId,
      tasksByTemplate: state.tasksByTemplate ?? current.tasksByTemplate,
      fieldsByTemplate: state.fieldsByTemplate ?? current.fieldsByTemplate,
      activeReportIds: state.activeReportIds ?? current.activeReportIds,
      customTemplates: state.customTemplates ?? current.customTemplates,
      theme: state.theme ?? current.theme ?? 'light',
    };

    this.db
      .prepare(
        `INSERT INTO drafts (
           user_id, active_template_id, tasks_by_template_json,
           fields_by_template_json, active_report_ids_json, custom_templates_json, theme, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           active_template_id = excluded.active_template_id,
           tasks_by_template_json = excluded.tasks_by_template_json,
           fields_by_template_json = excluded.fields_by_template_json,
           active_report_ids_json = excluded.active_report_ids_json,
           custom_templates_json = excluded.custom_templates_json,
           theme = excluded.theme,
           updated_at = excluded.updated_at`
      )
      .run(
        userId,
        merged.activeTemplateId,
        JSON.stringify(merged.tasksByTemplate),
        JSON.stringify(merged.fieldsByTemplate),
        JSON.stringify(merged.activeReportIds),
        JSON.stringify(merged.customTemplates),
        merged.theme,
        new Date().toISOString()
      );

    return merged;
  }

  public getAppState<T>(key: string, fallback: T): T {
    const row = this.db
      .prepare(`SELECT value_json FROM app_state WHERE key = ?`)
      .get(key) as { value_json: string } | undefined;

    if (!row) return fallback;
    try {
      return JSON.parse(row.value_json) as T;
    } catch {
      return fallback;
    }
  }

  public setAppState<T>(key: string, value: T): void {
    this.db
      .prepare(
        `INSERT INTO app_state (key, value_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`
      )
      .run(key, JSON.stringify(value), new Date().toISOString());
  }
}

/**
 * Valida se um usuário não-Admin (Supervisor ou Gerente) tentou realizar operações proibidas
 * no mapa do WhatsApp das Baias (colocar em manutenção ou excluir salas, mesas, celulares ou vagas).
 */
export function validateWhatsappPermissions(
  oldMap: any | null,
  newMap: any,
  role: UserRole
): { ok: true } | { ok: false; error: string } {
  if (role === 'admin') {
    return { ok: true };
  }

  if (role === 'operador') {
    return { ok: false, error: 'Operadores não têm acesso ao WhatsApp das Baias.' };
  }

  // Supervisor e Gerente não podem iniciar, alterar ou concluir manutenção
  const oldManutAtual = oldMap?.manutencaoAtual ?? null;
  const newManutAtual = newMap?.manutencaoAtual ?? null;
  if (JSON.stringify(oldManutAtual) !== JSON.stringify(newManutAtual)) {
    return {
      ok: false,
      error: 'Apenas o Admin pode iniciar, alterar ou concluir o modo de manutenção.',
    };
  }

  const oldManutCount = Array.isArray(oldMap?.manutencoes) ? oldMap.manutencoes.length : 0;
  const newManutCount = Array.isArray(newMap?.manutencoes) ? newMap.manutencoes.length : 0;
  if (oldMap && newManutCount !== oldManutCount) {
    return {
      ok: false,
      error: 'Apenas o Admin pode registrar ou alterar manutenções.',
    };
  }

  if (!oldMap) {
    return { ok: true };
  }

  // Verificar que nenhuma sala existente foi excluída
  const oldSalas: any[] = Array.isArray(oldMap.salas) ? oldMap.salas : [];
  const newSalas: any[] = Array.isArray(newMap.salas) ? newMap.salas : [];
  const newSalaIds = new Set(newSalas.map((s) => s.id));
  for (const oldSala of oldSalas) {
    if (!newSalaIds.has(oldSala.id)) {
      return { ok: false, error: 'Apenas o Admin pode excluir salas.' };
    }
  }

  // Verificar que nenhuma mesa existente foi excluída
  const oldMesas = oldSalas.flatMap((s) => (Array.isArray(s.mesas) ? s.mesas : []));
  const newMesas = newSalas.flatMap((s) => (Array.isArray(s.mesas) ? s.mesas : []));
  const newMesaIds = new Set(newMesas.map((m) => m.id));
  for (const oldMesa of oldMesas) {
    if (!newMesaIds.has(oldMesa.id)) {
      return { ok: false, error: 'Apenas o Admin pode excluir mesas.' };
    }
  }

  // Verificar que nenhum celular existente nem vaga existente foram excluídos
  const oldCelulares: any[] = Array.isArray(oldMap.celulares) ? oldMap.celulares : [];
  const newCelulares: any[] = Array.isArray(newMap.celulares) ? newMap.celulares : [];
  const newCelMap = new Map(newCelulares.map((c) => [c.id, c]));
  for (const oldCel of oldCelulares) {
    const newCel = newCelMap.get(oldCel.id);
    if (!newCel) {
      return { ok: false, error: 'Apenas o Admin pode excluir celulares.' };
    }
    const oldVagas: any[] = Array.isArray(oldCel.vagas) ? oldCel.vagas : [];
    const newVagas: any[] = Array.isArray(newCel.vagas) ? newCel.vagas : [];
    const newVagaIds = new Set(newVagas.map((v) => v.id));
    for (const oldVaga of oldVagas) {
      if (!newVagaIds.has(oldVaga.id)) {
        return { ok: false, error: 'Apenas o Admin pode excluir vagas de celulares.' };
      }
    }
  }

  return { ok: true };
}
