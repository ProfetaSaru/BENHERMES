import { describe, it, expect, beforeEach } from 'vitest';
import { AppDatabase } from './db';
import { createApiHandler } from './apiRouter';
import { signAuthToken } from './auth';

function callApi(
  handler: ReturnType<typeof createApiHandler>,
  options: {
    method: string;
    url: string;
    body?: any;
    token?: string;
    ip?: string;
  }
): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const req: any = {
      method: options.method,
      url: options.url,
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.ip ? { 'x-forwarded-for': options.ip } : {}),
      },
      socket: {
        remoteAddress: options.ip || '127.0.0.1',
      },
      body: options.body,
    };

    const headers: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      setHeader(k: string, v: string) {
        headers[k.toLowerCase()] = v;
      },
      end(payload?: string) {
        resolve({
          status: this.statusCode,
          data: payload ? JSON.parse(payload) : null,
        });
      },
    };

    void handler(req, res);
  });
}

describe('Módulo de Anotações: RBAC, Filtros, Comentários em Thread e Notificações', () => {
  let db: AppDatabase;
  let handler: ReturnType<typeof createApiHandler>;

  let adminToken: string;
  let supervisorAToken: string;
  let supervisorBToken: string;
  let operadorAToken: string;
  let operadorBToken: string;
  let gerenteToken: string;

  let operadorAId: string;
  let operadorBId: string;
  let supervisorAId: string;
  let supervisorBId: string;

  beforeEach(async () => {
    db = new AppDatabase(':memory:');
    handler = createApiHandler(db, { enforceIp: false });

    // 1. Obter Admin
    const adminUser = db.authenticateUser('admin', process.env.ADMIN_PASSWORD || 'admin123')!;
    adminToken = signAuthToken({ id: adminUser.id, username: adminUser.username, role: 'admin' });

    // 2. Criar Gerente
    const gerente = db.createUser({
      username: 'gerente_ana',
      displayName: 'Ana Gerente',
      password: '123',
      role: 'gerente',
    });
    gerenteToken = signAuthToken({ id: gerente.id, username: gerente.username, role: 'gerente' });

    // 3. Criar Supervisor A e Supervisor B
    const supA = db.createUser({
      username: 'sup_a',
      displayName: 'Marcos Supervisor A',
      password: '123',
      role: 'supervisor',
    });
    supervisorAId = supA.id;
    supervisorAToken = signAuthToken({ id: supA.id, username: supA.username, role: 'supervisor' });

    const supB = db.createUser({
      username: 'sup_b',
      displayName: 'Julia Supervisor B',
      password: '123',
      role: 'supervisor',
    });
    supervisorBId = supB.id;
    supervisorBToken = signAuthToken({ id: supB.id, username: supB.username, role: 'supervisor' });

    // 4. Criar Operador A (vinculado a Sup A) e Operador B (vinculado a Sup B)
    const opA = db.createUser({
      username: 'op_a',
      displayName: 'Carlos Operador A',
      password: '123',
      role: 'operador',
      supervisorId: supA.id,
    });
    operadorAId = opA.id;
    operadorAToken = signAuthToken({ id: opA.id, username: opA.username, role: 'operador' });

    const opB = db.createUser({
      username: 'op_b',
      displayName: 'Beatriz Operador B',
      password: '123',
      role: 'operador',
      supervisorId: supB.id,
    });
    operadorBId = opB.id;
    operadorBToken = signAuthToken({ id: opB.id, username: opB.username, role: 'operador' });
  });

  it('permite que qualquer usuário autenticado crie anotações com categoria e cor', async () => {
    const res = await callApi(handler, {
      method: 'POST',
      url: '/api/notes',
      token: operadorAToken,
      body: {
        title: 'Verificar lead com pendência',
        content: 'Cliente aguarda retorno sobre limite de crédito até as 15h.',
        category: 'Urgente',
        color: 'yellow',
      },
    });

    expect(res.status).toBe(201);
    expect(res.data.note).toBeDefined();
    expect(res.data.note.title).toBe('Verificar lead com pendência');
    expect(res.data.note.category).toBe('Urgente');
    expect(res.data.note.color).toBe('yellow');
    expect(res.data.note.authorName).toBe('Carlos Operador A');
    expect(res.data.note.authorRole).toBe('operador');
    expect(res.data.note.commentsCount).toBe(0);
    expect(res.data.note.unreadCommentsCount).toBe(0);
  });

  it('respeita a hierarquia de visualização e filtros por pessoa', async () => {
    // Operador A cria anotação 1
    const n1 = await callApi(handler, {
      method: 'POST',
      url: '/api/notes',
      token: operadorAToken,
      body: { title: 'Nota Op A', content: 'Conteúdo A' },
    });

    // Operador B cria anotação 2
    const n2 = await callApi(handler, {
      method: 'POST',
      url: '/api/notes',
      token: operadorBToken,
      body: { title: 'Nota Op B', content: 'Conteúdo B' },
    });

    // Supervisor A cria anotação 3
    const n3 = await callApi(handler, {
      method: 'POST',
      url: '/api/notes',
      token: supervisorAToken,
      body: { title: 'Nota Sup A', content: 'Conteúdo Sup A' },
    });

    // 1. Operador A só vê as suas próprias anotações
    const opAList = await callApi(handler, { method: 'GET', url: '/api/notes', token: operadorAToken });
    expect(opAList.status).toBe(200);
    expect(opAList.data.notes).toHaveLength(1);
    expect(opAList.data.notes[0].id).toBe(n1.data.note.id);

    // 2. Supervisor A vê as suas próprias e as do Operador A (da sua equipe), mas NÃO vê as do Operador B
    const supAList = await callApi(handler, { method: 'GET', url: '/api/notes', token: supervisorAToken });
    expect(supAList.status).toBe(200);
    expect(supAList.data.notes).toHaveLength(2);
    const supAIds = supAList.data.notes.map((n: any) => n.id);
    expect(supAIds).toContain(n1.data.note.id);
    expect(supAIds).toContain(n3.data.note.id);
    expect(supAIds).not.toContain(n2.data.note.id);

    // Supervisor A filtrando por Operador A
    const supAFilterOpA = await callApi(handler, {
      method: 'GET',
      url: `/api/notes?userId=${operadorAId}`,
      token: supervisorAToken,
    });
    expect(supAFilterOpA.data.notes).toHaveLength(1);
    expect(supAFilterOpA.data.notes[0].id).toBe(n1.data.note.id);

    // Supervisor A tentando filtrar por Operador B (fora de sua equipe): não retorna nada
    const supAFilterOpB = await callApi(handler, {
      method: 'GET',
      url: `/api/notes?userId=${operadorBId}`,
      token: supervisorAToken,
    });
    expect(supAFilterOpB.data.notes).toHaveLength(0);

    // 3. Gerente e Admin veem todas as anotações e podem filtrar por qualquer pessoa
    const gerenteList = await callApi(handler, { method: 'GET', url: '/api/notes', token: gerenteToken });
    expect(gerenteList.data.notes).toHaveLength(3);

    const adminFilterOpB = await callApi(handler, {
      method: 'GET',
      url: `/api/notes?userId=${operadorBId}`,
      token: adminToken,
    });
    expect(adminFilterOpB.data.notes).toHaveLength(1);
    expect(adminFilterOpB.data.notes[0].id).toBe(n2.data.note.id);
  });

  it('permite comentários de supervisores e notifica o originador da anotação', async () => {
    // Operador A cria anotação
    const createRes = await callApi(handler, {
      method: 'POST',
      url: '/api/notes',
      token: operadorAToken,
      body: { title: 'Dúvida Argus', content: 'Instabilidade na fila de atendimento.' },
    });
    const noteId = createRes.data.note.id;

    // Inicialmente, operador não tem comentários não lidos
    const unreadInit = await callApi(handler, {
      method: 'GET',
      url: '/api/notes/unread-count',
      token: operadorAToken,
    });
    expect(unreadInit.data.unreadCount).toBe(0);

    // Supervisor A comenta na anotação do Operador A
    const commentRes = await callApi(handler, {
      method: 'POST',
      url: `/api/notes/${noteId}/comments`,
      token: supervisorAToken,
      body: { content: 'Já acionamos a equipe de TI, favor acompanhar.' },
    });
    expect(commentRes.status).toBe(201);
    expect(commentRes.data.comment.authorName).toBe('Marcos Supervisor A');
    expect(commentRes.data.comment.authorRole).toBe('supervisor');

    // O texto original da anotação PERMANECE INTACTO
    const getNote = await callApi(handler, {
      method: 'GET',
      url: `/api/notes/${noteId}`,
      token: operadorAToken,
    });
    expect(getNote.data.note.content).toBe('Instabilidade na fila de atendimento.');
    expect(getNote.data.comments).toHaveLength(1);
    expect(getNote.data.comments[0].content).toBe('Já acionamos a equipe de TI, favor acompanhar.');

    // Agora o originador (Operador A) recebe a notificação: unreadCount = 1
    const unreadAfterComment = await callApi(handler, {
      method: 'GET',
      url: '/api/notes/unread-count',
      token: operadorAToken,
    });
    expect(unreadAfterComment.data.unreadCount).toBe(1);

    // Na listagem do operador, o note indica unreadCommentsCount = 1
    const opList = await callApi(handler, { method: 'GET', url: '/api/notes', token: operadorAToken });
    expect(opList.data.notes[0].unreadCommentsCount).toBe(1);

    // Operador abre/marca como lido
    const markReadRes = await callApi(handler, {
      method: 'POST',
      url: `/api/notes/${noteId}/read`,
      token: operadorAToken,
    });
    expect(markReadRes.status).toBe(200);

    // Notificação é zerada
    const unreadAfterRead = await callApi(handler, {
      method: 'GET',
      url: '/api/notes/unread-count',
      token: operadorAToken,
    });
    expect(unreadAfterRead.data.unreadCount).toBe(0);

    // Operador responde na conversa (thread)
    const replyRes = await callApi(handler, {
      method: 'POST',
      url: `/api/notes/${noteId}/comments`,
      token: operadorAToken,
      body: { content: 'Obrigado pelo retorno, fila normalizada!' },
    });
    expect(replyRes.status).toBe(201);

    const commentsFinal = await callApi(handler, {
      method: 'GET',
      url: `/api/notes/${noteId}`,
      token: supervisorAToken,
    });
    expect(commentsFinal.data.comments).toHaveLength(2);
    expect(commentsFinal.data.comments[1].authorRole).toBe('operador');
  });

  it('permite que o autor edite/exclua sua anotação e restringe terceiros, com admin irrestrito', async () => {
    // Operador A cria anotação
    const createRes = await callApi(handler, {
      method: 'POST',
      url: '/api/notes',
      token: operadorAToken,
      body: { title: 'Título Inicial', content: 'Conteúdo Inicial', color: 'blue' },
    });
    const noteId = createRes.data.note.id;

    // Supervisor A NÃO pode editar a anotação do operador (só pode comentar)
    const supEditTry = await callApi(handler, {
      method: 'PUT',
      url: `/api/notes/${noteId}`,
      token: supervisorAToken,
      body: { title: 'Tentativa de alteração por supervisor' },
    });
    expect(supEditTry.status).toBe(403);
    expect(supEditTry.data.erro).toContain('Apenas o autor ou o Administrador');

    // Supervisor A NÃO pode excluir a anotação do operador
    const supDelTry = await callApi(handler, {
      method: 'DELETE',
      url: `/api/notes/${noteId}`,
      token: supervisorAToken,
    });
    expect(supDelTry.status).toBe(403);

    // Autor (Operador A) pode editar livremente sua própria anotação
    const opEdit = await callApi(handler, {
      method: 'PUT',
      url: `/api/notes/${noteId}`,
      token: operadorAToken,
      body: { title: 'Título Atualizado pelo Autor', content: 'Novo Conteúdo', color: 'green' },
    });
    expect(opEdit.status).toBe(200);
    expect(opEdit.data.note.title).toBe('Título Atualizado pelo Autor');
    expect(opEdit.data.note.color).toBe('green');

    // Admin pode editar qualquer anotação
    const adminEdit = await callApi(handler, {
      method: 'PUT',
      url: `/api/notes/${noteId}`,
      token: adminToken,
      body: { title: 'Título Editado pelo Admin' },
    });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.data.note.title).toBe('Título Editado pelo Admin');

    // Admin pode excluir qualquer anotação
    const adminDel = await callApi(handler, {
      method: 'DELETE',
      url: `/api/notes/${noteId}`,
      token: adminToken,
    });
    expect(adminDel.status).toBe(200);

    const getDeleted = await callApi(handler, {
      method: 'GET',
      url: `/api/notes/${noteId}`,
      token: adminToken,
    });
    expect(getDeleted.status).toBe(404);
  });
});
