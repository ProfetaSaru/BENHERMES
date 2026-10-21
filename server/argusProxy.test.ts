import { describe, expect, it } from 'vitest';
import { chamarArgus, limparUsuarios } from './argusProxy';

// Só as regras da ponte; nenhuma chamada sai para a internet.
describe('ponte com o Argus', () => {
  it('descarta CPF, e-mail, login, RE e ramal do cadastro de usuários', () => {
    const limpo = limparUsuarios({
      codStatus: 1,
      usuarios: [
        {
          idUsuario: 1,
          nome: 'ANA TESTE',
          ativo: true,
          cpf: '12345678901',
          email: 'ana@exemplo.com',
          login: 'ANA.T',
          re: '9',
          ramal: '100',
          campanhas: [{ grupoUsuarioDesc: 'URA', nomeUsuarioSupervisor: 'SUP', idUsuarioSupervisor: 3 }],
        },
      ],
    });
    expect(limpo).toEqual({
      codStatus: 1,
      usuarios: [{ idUsuario: 1, nome: 'ANA TESTE', ativo: true, campanhas: [{ grupoUsuarioDesc: 'URA', nomeUsuarioSupervisor: 'SUP' }] }],
    });
    expect(JSON.stringify(limpo)).not.toMatch(/12345678901|@/);
  });

  it('só repassa os 3 endereços que o relatório usa', async () => {
    await expect(chamarArgus('https://argus.app.br/apiargus', 'cmd/apagartudo', {}, 'x')).rejects.toThrow('não permitido');
  });

  it('exige https fora do próprio computador e exige token', async () => {
    await expect(chamarArgus('http://exemplo.com/api', 'cmd/listargrupos', {}, 'x')).rejects.toThrow('https://');
    await expect(chamarArgus('https://argus.app.br/apiargus', 'cmd/listargrupos', {}, '')).rejects.toThrow('token');
  });
});
