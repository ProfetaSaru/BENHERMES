import { describe, it, expect } from 'vitest';
import { BUILTIN_TEMPLATES } from './index';
import { renderTemplate } from '../../utils/markdownTemplateParser';

describe('Modelos Nativos em TypeScript (BUILTIN_TEMPLATES)', () => {
  it('possui os 7 modelos nativos adaptados sem dependência de arquivos .md', () => {
    expect(BUILTIN_TEMPLATES.map((t) => t.id)).toEqual([
      'atividades-padrao',
      'produtividade-atendimento',
      'atividades-tabela',
      'passagem-plantao',
      'novo-colaborador',
      'comunicado-geral',
      'relatorio-incidente',
    ]);

    for (const tpl of BUILTIN_TEMPLATES) {
      expect(tpl.isBuiltin).toBe(true);
      expect(tpl.fields && tpl.fields.length > 0).toBe(true);
      expect(tpl.templateBody && tpl.templateBody.length > 0).toBe(true);
    }
  });

  it('renderiza corretamente o modelo de Produtividade & TMA e o de Novo Colaborador', () => {
    const prod = BUILTIN_TEMPLATES.find((t) => t.id === 'produtividade-atendimento')!;
    const prodText = renderTemplate(
      prod.templateBody!,
      { nome_colaborador: 'MARIA SILVA' },
      [
        {
          id: '1',
          title: '123.456.789-00',
          start: '09:00',
          end: '09:15',
          category: 'Desbloqueados',
          description: '',
        },
      ]
    );
    expect(prodText).toContain('RELATÓRIO DE PRODUTIVIDADE - MARIA SILVA');
    expect(prodText).toContain('TOTAL DESBLOQUEADO: 1');
    expect(prodText).toContain('TMA: 15 min');

    const novoColab = BUILTIN_TEMPLATES.find((t) => t.id === 'novo-colaborador')!;
    const colabText = renderTemplate(
      novoColab.templateBody!,
      {
        nome_completo: 'Carlos Souza',
        setor: 'Ativo',
        login_vanguard: 'carlos.souza',
        senha_vanguard: '1234',
        login_argus: 'csouza',
        senha_argus: '5678',
        nome_benhub: 'Carlos Souza',
        email_benhub: 'carlos.souza@benhub.com',
        senha_benhub: 'abcd',
        equipe: 'OP1',
      },
      []
    );
    expect(colabText).toContain('💙NOVO COLABORADOR(A): CARLOS SOUZA 💙');
    expect(colabText).toContain('SETOR - Ativo');
    expect(colabText).toContain('EQUIPE: OP1.');
  });
});

