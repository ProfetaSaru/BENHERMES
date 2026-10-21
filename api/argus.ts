import type { IncomingMessage, ServerResponse } from 'node:http';
import { atenderArgus } from '../server/argusProxy.js';

/**
 * Função da Vercel: a ponte com a API do Argus no site publicado (veja server/argusProxy.ts).
 * Mesmo código do npm run dev. Nada é gravado nem registrado em log; do cadastro de
 * usuários, CPF, e-mail, login, RE e ramal são descartados antes da resposta.
 */
export const config = { maxDuration: 60 };

export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return atenderArgus(req, res);
}
