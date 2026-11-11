import React from 'react';
import { NotificationState } from '../../types/task';
import { NotificationToast } from './NotificationToast';

/** Telas que já mostram o aviso no próprio formulário (as outras usam o flutuante) */
const TELAS_COM_AVISO_PROPRIO = new Set(['relatorios']);

export const avisoFlutuanteNaTela = (tela: string): boolean => !TELAS_COM_AVISO_PROPRIO.has(tela);

/** Aviso flutuante no rodapé da tela, para os onNotify de todas as ferramentas */
export const AvisoFlutuante: React.FC<{ notification: NotificationState }> = ({ notification }) =>
  notification.message ? (
    <div className="aviso-flutuante">
      <NotificationToast message={notification.message} type={notification.type} />
    </div>
  ) : null;
