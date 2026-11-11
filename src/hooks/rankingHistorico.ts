import { RegistroRanking } from '../types/ranking';

/**
 * Histórico do ranking sem perder atualizações: cada gravação espera a anterior terminar e é montada sobre a
 * lista mais recente (e não sobre a que a tela tinha quando o botão foi clicado). Assim, apagar enquanto o
 * Gerar espera a IA não ressuscita o apagado, e o Refazer não desfaz a legenda copiada no meio do caminho.
 */
export const criarHistoricoRanking = (
  inicial: RegistroRanking[],
  gravar: (lista: RegistroRanking[]) => Promise<RegistroRanking[]>,
  aoMudar: (lista: RegistroRanking[]) => void
) => {
  let atual = inicial;
  let fila: Promise<unknown> = Promise.resolve();

  const enfileirar = (montar: (lista: RegistroRanking[]) => RegistroRanking[] | null): Promise<string> => {
    const vez = fila.then(async () => {
      const proxima = montar(atual);
      if (!proxima) return '';
      try {
        atual = await gravar(proxima);
        aoMudar(atual);
        return '';
      } catch (err: any) {
        return err?.message || 'Não foi possível salvar o histórico.';
      }
    });
    fila = vez;
    return vez;
  };

  return {
    lista: () => atual,
    /** Lista vinda do servidor ao abrir a tela */
    definir: (lista: RegistroRanking[]) => {
      atual = lista;
      aoMudar(atual);
    },
    /** Mesma data substitui o registro anterior (a confirmação é da tela) */
    salvar: (registro: RegistroRanking) =>
      enfileirar((l) => [registro, ...l.filter((h) => h.dia !== registro.dia && h.id !== registro.id)]),
    remover: (id: string) => enfileirar((l) => l.filter((h) => h.id !== id)),
    /** Junta as mudanças ao registro como ele estiver na hora de gravar; registro apagado: nada a fazer */
    atualizar: (id: string, mudancas: Partial<RegistroRanking>) =>
      enfileirar((l) => (l.some((h) => h.id === id) ? l.map((h) => (h.id === id ? { ...h, ...mudancas, id } : h)) : null)),
  };
};
