import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * Ponte local entre o BENHERMES e a API do Argus.
 *
 * O navegador não consegue chamar o Argus direto (o Argus não libera CORS e alguns
 * servidores dele usam TLS antigo, recusado pelos navegadores). Então quem chama é
 * um servidor, que recebe o pedido em /api/argus?caminho=... e repassa ao Argus —
 * igual ao argus_api.py do BENZAITEN. O mesmo código atende:
 *  - o servidor do Vite (npm run dev / npm run preview), no seu computador;
 *  - a função da Vercel em api/argus.ts, no site publicado.
 * Regras da ponte:
 *  - primeiro tenta a conexão segura padrão; se o servidor recusar, tenta de novo no
 *    modo compatível (cifras e TLS antigos liberados), com o certificado SEMPRE verificado;
 *  - só os 3 endereços que o relatório usa são repassados (não é um proxy aberto);
 *  - do cadastro de usuários, CPF, e-mail, login, RE e ramal são descartados aqui,
 *    antes de chegar ao navegador.
 *
 * O token vai no cabeçalho X-Argus-Token e é repassado como Token-Signature.
 * Nada é gravado nem registrado em log.
 */

const URL_PADRAO = 'https://argus.app.br/apiargus';

/** Endereços da API que o relatório usa */
const CAMINHOS_PERMITIDOS = new Set(['report/desempenhoresumido', 'cmd/listargrupos', 'cmd/listarusuarios']);

/** Conexão compatível com servidores de configuração antiga (certificado continua verificado) */
const agenteCompativel = new https.Agent({
  ciphers: 'DEFAULT:@SECLEVEL=0',
  minVersion: 'TLSv1',
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
});

class ErroArgus extends Error {
  constructor(
    mensagem: string,
    public status = 502
  ) {
    super(mensagem);
  }
}

/** http://localhost só é aceito para testes; o Argus de verdade é sempre https */
const validarBase = (base: string): URL => {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new ErroArgus(`Endereço da API inválido: ${base}`, 400);
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new ErroArgus('O endereço da API do Argus precisa começar com https://', 400);
  }
  return url;
};

const ehErroDeTls = (erro: NodeJS.ErrnoException): boolean =>
  /SSL|TLS|EPROTO|HANDSHAKE|ECONNRESET|cipher/i.test(`${erro.code ?? ''} ${erro.message}`);

const enviar = (endereco: URL, corpo: string, token: string, agente?: https.Agent): Promise<{ status: number; texto: string }> =>
  new Promise((resolver, rejeitar) => {
    const modulo = endereco.protocol === 'https:' ? https : http;
    const requisicao = modulo.request(
      endereco,
      {
        method: 'POST',
        headers: { 'Token-Signature': token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) },
        // Na Vercel a função tem no máximo 60 s; no computador, o mesmo limite do argus_api.py
        timeout: process.env.VERCEL ? 55_000 : 120_000,
        ...(agente && endereco.protocol === 'https:' ? { agent: agente } : {}),
      },
      (resposta) => {
        const partes: Buffer[] = [];
        resposta.on('data', (p: Buffer) => partes.push(p));
        resposta.on('end', () => resolver({ status: resposta.statusCode ?? 0, texto: Buffer.concat(partes).toString('utf-8') }));
      }
    );
    requisicao.on('timeout', () => requisicao.destroy(new Error('o Argus demorou demais para responder')));
    requisicao.on('error', rejeitar);
    requisicao.end(corpo);
  });

/** Chama o Argus (tentando o modo compatível se a conexão segura padrão falhar) */
export const chamarArgus = async (base: string, caminho: string, corpo: unknown, token: string): Promise<any> => {
  if (!CAMINHOS_PERMITIDOS.has(caminho)) throw new ErroArgus(`Endereço não permitido: ${caminho}`, 404);
  if (!token) throw new ErroArgus('Informe o token da API do Argus.', 400);
  const endereco = new URL(`${validarBase(base).href.replace(/\/$/, '')}/${caminho}`);
  const texto = JSON.stringify(corpo ?? {});

  let resposta: { status: number; texto: string };
  try {
    try {
      resposta = await enviar(endereco, texto, token);
    } catch (erro: any) {
      if (!ehErroDeTls(erro)) throw erro;
      resposta = await enviar(endereco, texto, token, agenteCompativel);
    }
  } catch (erro: any) {
    throw new ErroArgus(
      `Não consegui conectar ao Argus em ${endereco.href} (${erro.message}). Se o endereço da API da Benconsig for outro, ajuste-o nas configurações.`
    );
  }

  if (resposta.status === 403) throw new ErroArgus('O Argus recusou o acesso (403). Confira se o token está correto.', 403);
  if (resposta.status >= 400) throw new ErroArgus(`O Argus respondeu com erro ${resposta.status} em ${endereco.href}.`);

  let dados: any;
  try {
    dados = JSON.parse(resposta.texto);
  } catch {
    throw new ErroArgus('O Argus devolveu uma resposta que não é JSON.');
  }
  // codStatus 1 = sucesso; menor que 1 = falha
  if ((dados?.codStatus ?? 1) < 1) throw new ErroArgus(`O Argus devolveu uma falha em ${caminho}: ${dados.descStatus}`, 400);
  return dados;
};

/** Do cadastro de usuários, só o que o relatório usa (sem CPF, e-mail, login, RE, ramal) */
export const limparUsuarios = (dados: any): any => ({
  codStatus: dados?.codStatus,
  usuarios: (dados?.usuarios ?? []).map((u: any) => ({
    idUsuario: u.idUsuario,
    nome: u.nome,
    ativo: u.ativo,
    campanhas: (u.campanhas ?? []).map((c: any) => ({
      grupoUsuarioDesc: c.grupoUsuarioDesc,
      nomeUsuarioSupervisor: c.nomeUsuarioSupervisor,
    })),
  })),
});

const lerCorpo = (req: IncomingMessage): Promise<string> =>
  new Promise((resolver, rejeitar) => {
    let texto = '';
    req.on('data', (p) => {
      texto += p;
      if (texto.length > 100_000) rejeitar(new ErroArgus('Pedido grande demais.', 413));
    });
    req.on('end', () => resolver(texto));
    req.on('error', rejeitar);
  });

const responder = (res: ServerResponse, status: number, corpo: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
};

/** Corpo do pedido: a Vercel já entrega lido em req.body; o Vite entrega o fluxo bruto */
const corpoDoPedido = async (req: IncomingMessage & { body?: unknown }): Promise<unknown> => {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  return JSON.parse((await lerCorpo(req)) || '{}');
};

/** Atende um pedido da ponte: POST /api/argus?caminho=report/desempenhoresumido */
export const atenderArgus = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  try {
    if (req.method !== 'POST') throw new ErroArgus('Use POST.', 405);
    const caminho = new URL(req.url ?? '/', 'http://local').searchParams.get('caminho') ?? '';
    const token = String(req.headers['x-argus-token'] ?? '').trim();
    const base = String(req.headers['x-argus-url'] ?? '').trim() || URL_PADRAO;
    const corpo = await corpoDoPedido(req);

    const dados = await chamarArgus(base, caminho, corpo, token);
    responder(res, 200, caminho === 'cmd/listarusuarios' ? limparUsuarios(dados) : dados);
  } catch (erro: any) {
    responder(res, erro instanceof ErroArgus ? erro.status : 500, { erro: erro.message ?? String(erro) });
  }
};

/** Plugin do Vite: atende /api/argus no npm run dev e no npm run preview */
export const argusProxy = (): Plugin => ({
  name: 'benhermes-argus-proxy',
  configureServer(server) {
    server.middlewares.use('/api/argus', (req, res) => void atenderArgus(req, res));
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/argus', (req, res) => void atenderArgus(req, res));
  },
});
