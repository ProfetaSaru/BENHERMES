import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AvisoFlutuante, avisoFlutuanteNaTela } from './AvisoFlutuante';

describe('aviso flutuante do app', () => {
  it('aparece com a mensagem e o tipo, e some sem mensagem', () => {
    const html = renderToStaticMarkup(<AvisoFlutuante notification={{ message: 'Escala copiada!', type: 'success' }} />);
    expect(html).toContain('aviso-flutuante');
    expect(html).toContain('Escala copiada!');
    expect(html).toContain('form-message success');
    expect(renderToStaticMarkup(<AvisoFlutuante notification={{ message: '', type: '' }} />)).toBe('');
  });

  it('vale para todas as telas, menos a Central de Relatórios (que mostra no formulário)', () => {
    for (const tela of ['escala', 'relatorio-ura', 'ranking', 'configuracoes', 'arquivos', 'anotacoes', 'historico', 'usuarios', 'whatsapp']) {
      expect(avisoFlutuanteNaTela(tela), tela).toBe(true);
    }
    expect(avisoFlutuanteNaTela('relatorios')).toBe(false);
  });
});
