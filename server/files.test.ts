import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
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
    headers?: Record<string, string>;
  }
): Promise<{ status: number; data: any; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    const customHeaders = options.headers || {};
    const req: any = {
      method: options.method,
      url: options.url,
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...customHeaders,
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
      body: options.body,
    };

    const resHeaders: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      setHeader(k: string, v: string) {
        resHeaders[k.toLowerCase()] = v;
      },
      end(payload?: any) {
        let parsed = null;
        if (typeof payload === 'string') {
          try {
            parsed = JSON.parse(payload);
          } catch {
            parsed = payload;
          }
        }
        resolve({
          status: this.statusCode,
          data: parsed,
          headers: resHeaders,
        });
      },
    };

    void handler(req, res);
  });
}

describe('Módulo de Compartilhamento de Arquivos: Pastas Dinâmicas, RBAC, Uploads e Cascata', () => {
  let db: AppDatabase;
  let handler: ReturnType<typeof createApiHandler>;

  let adminToken: string;
  let gerenteToken: string;
  let supervisorAToken: string;
  let supervisorBToken: string;
  let operadorToken: string;

  let supervisorAId: string;
  let supervisorBId: string;

  beforeEach(() => {
    db = new AppDatabase(':memory:');
    handler = createApiHandler(db, { enforceIp: false });

    // 1. Admin
    const admin = db.authenticateUser('admin', process.env.ADMIN_PASSWORD || 'admin123')!;
    adminToken = signAuthToken({ id: admin.id, username: admin.username, role: 'admin' });

    // 2. Gerente
    const gerente = db.createUser({
      username: 'gerente_lucas',
      displayName: 'Lucas Gerente',
      password: '123',
      role: 'gerente',
    });
    gerenteToken = signAuthToken({ id: gerente.id, username: gerente.username, role: 'gerente' });

    // 3. Supervisor A e B
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

    // 4. Operador
    const op = db.createUser({
      username: 'op_carlos',
      displayName: 'Carlos Operador',
      password: '123',
      role: 'operador',
      supervisorId: supervisorAId,
    });
    operadorToken = signAuthToken({ id: op.id, username: op.username, role: 'operador' });
  });

  it('restringe acesso a Operadores (403) e permite acesso para Admin, Gerente e Supervisores', async () => {
    // Operador tenta listar
    const resOp = await callApi(handler, {
      method: 'GET',
      url: '/api/files/items',
      token: operadorToken,
    });
    expect(resOp.status).toBe(403);
    expect(resOp.data?.erro).toContain('Acesso restrito');

    // Supervisor tenta listar
    const resSup = await callApi(handler, {
      method: 'GET',
      url: '/api/files/items',
      token: supervisorAToken,
    });
    expect(resSup.status).toBe(200);
    expect(resSup.data.folders).toEqual([]);
    expect(resSup.data.files).toEqual([]);

    // Gerente tenta listar
    const resGer = await callApi(handler, {
      method: 'GET',
      url: '/api/files/items',
      token: gerenteToken,
    });
    expect(resGer.status).toBe(200);

    // Admin tenta listar
    const resAdm = await callApi(handler, {
      method: 'GET',
      url: '/api/files/items',
      token: adminToken,
    });
    expect(resAdm.status).toBe(200);
  });

  it('permite criar pastas e subpastas e montar breadcrumbs corretamente', async () => {
    // 1. Criar pasta raiz "Procedimentos" pelo Supervisor A
    const resPasta = await callApi(handler, {
      method: 'POST',
      url: '/api/files/folders',
      token: supervisorAToken,
      body: { name: 'Procedimentos' },
    });
    expect(resPasta.status).toBe(201);
    const pastaId = resPasta.data.folder.id;
    expect(resPasta.data.folder.name).toBe('Procedimentos');

    // 2. Criar subpasta "Atendimento 2026" dentro de "Procedimentos"
    const resSub = await callApi(handler, {
      method: 'POST',
      url: '/api/files/folders',
      token: supervisorAToken,
      body: { name: 'Atendimento 2026', parentId: pastaId },
    });
    expect(resSub.status).toBe(201);
    const subpastaId = resSub.data.folder.id;

    // 3. Listar conteúdo de "Procedimentos"
    const resList = await callApi(handler, {
      method: 'GET',
      url: `/api/files/items?folderId=${pastaId}`,
      token: supervisorBToken,
    });
    expect(resList.status).toBe(200);
    expect(resList.data.currentFolder?.id).toBe(pastaId);
    expect(resList.data.breadcrumbs).toHaveLength(2);
    expect(resList.data.breadcrumbs[0].name).toBe('Início');
    expect(resList.data.breadcrumbs[1].name).toBe('Procedimentos');
    expect(resList.data.folders).toHaveLength(1);
    expect(resList.data.folders[0].id).toBe(subpastaId);
  });

  it('impede que terceiros excluam ou renomeiem pastas alheias, mas autoriza o autor e o Admin', async () => {
    // 1. Supervisor A cria pasta "Manual de Conduta"
    const resPasta = await callApi(handler, {
      method: 'POST',
      url: '/api/files/folders',
      token: supervisorAToken,
      body: { name: 'Manual de Conduta' },
    });
    const folderId = resPasta.data.folder.id;

    // 2. Supervisor B tenta renomear -> 403
    const resRenB = await callApi(handler, {
      method: 'PUT',
      url: `/api/files/folders/${folderId}`,
      token: supervisorBToken,
      body: { name: 'Nome Invasor' },
    });
    expect(resRenB.status).toBe(403);
    expect(resRenB.data?.erro).toContain('não tem permissão');

    // 3. Supervisor B tenta excluir -> 403
    const resDelB = await callApi(handler, {
      method: 'DELETE',
      url: `/api/files/folders/${folderId}`,
      token: supervisorBToken,
    });
    expect(resDelB.status).toBe(403);

    // 4. Supervisor A (autor) renomeia com sucesso -> 200
    const resRenA = await callApi(handler, {
      method: 'PUT',
      url: `/api/files/folders/${folderId}`,
      token: supervisorAToken,
      body: { name: 'Manual de Conduta 2026' },
    });
    expect(resRenA.status).toBe(200);
    expect(resRenA.data.folder.name).toBe('Manual de Conduta 2026');

    // 5. Admin pode excluir a pasta criada por Supervisor A -> 200
    const resDelAdmin = await callApi(handler, {
      method: 'DELETE',
      url: `/api/files/folders/${folderId}`,
      token: adminToken,
    });
    expect(resDelAdmin.status).toBe(200);

    // 6. Verificar que a pasta não existe mais
    const resCheck = await callApi(handler, {
      method: 'GET',
      url: '/api/files/items',
      token: adminToken,
    });
    expect(resCheck.data.folders).toHaveLength(0);
  });

  it('bloqueia upload de extensões proibidas (.exe, .bat, etc.)', async () => {
    const resUpload = await callApi(handler, {
      method: 'POST',
      url: '/api/files/upload',
      token: supervisorAToken,
      headers: {
        'x-file-name': encodeURIComponent('instalador_malicioso.exe'),
        'content-type': 'application/x-msdownload',
      },
    });
    expect(resUpload.status).toBe(400);
    expect(resUpload.data?.erro).toContain('não são permitidos');
  });

  it('calcula estatísticas de exclusão e realiza exclusão em cascata removendo arquivos físicos do disco', async () => {
    // 1. Criar pasta pai
    const resPai = await callApi(handler, {
      method: 'POST',
      url: '/api/files/folders',
      token: supervisorAToken,
      body: { name: 'Arquivos do Setor' },
    });
    const idPai = resPai.data.folder.id;

    // 2. Criar subpasta
    const resFilho = await callApi(handler, {
      method: 'POST',
      url: '/api/files/folders',
      token: supervisorAToken,
      body: { name: 'Subpasta 1', parentId: idPai },
    });
    const idFilho = resFilho.data.folder.id;

    // 3. Criar arquivos na subpasta simulando gravação em disco
    const dummyPath = path.join(db.uploadsDir, 'teste_arquivo_1.txt');
    fs.writeFileSync(dummyPath, 'conteudo de teste para exclusao');
    expect(fs.existsSync(dummyPath)).toBe(true);

    const file = db.createSharedFile(
      { id: supervisorAId, username: 'sup_a', displayName: 'Marcos', role: 'supervisor' } as any,
      {
        folderId: idFilho,
        name: 'Relatorio.txt',
        originalName: 'Relatorio.txt',
        storagePath: 'teste_arquivo_1.txt',
        mimeType: 'text/plain',
        sizeBytes: 31,
      }
    );
    expect(file.id).toBeDefined();

    // 4. Checar estatísticas da pasta pai: 1 subpasta, 1 arquivo, 31 bytes
    const resStats = await callApi(handler, {
      method: 'GET',
      url: `/api/files/folders/${idPai}/stats`,
      token: supervisorAToken,
    });
    expect(resStats.status).toBe(200);
    expect(resStats.data.stats.folderCount).toBe(1);
    expect(resStats.data.stats.fileCount).toBe(1);
    expect(resStats.data.stats.totalBytes).toBe(31);

    // 5. Excluir pasta pai
    const resDel = await callApi(handler, {
      method: 'DELETE',
      url: `/api/files/folders/${idPai}`,
      token: supervisorAToken,
    });
    expect(resDel.status).toBe(200);

    // 6. Verificar que o arquivo físico em disco foi removido
    expect(fs.existsSync(dummyPath)).toBe(false);

    // 7. Verificar que as pastas e o arquivo no banco foram removidos
    const checkFile = db.getSharedFileById(file.id);
    expect(checkFile).toBeNull();
  });
});

