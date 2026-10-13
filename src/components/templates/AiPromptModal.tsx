import React, { useState } from 'react';
import { Copy, Check, Download, Bot, Sparkles, X, FileCode } from 'lucide-react';
import { Button } from '../common/Button';
import { AI_PROMPT_SYSTEM_INSTRUCTIONS, downloadMarkdownFile, DEFAULT_EXAMPLE_TEMPLATE_MD } from '../../utils/aiPromptTemplate';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (message: string, type?: 'success' | 'error' | '') => void;
}

export const AiPromptModal: React.FC<Props> = ({ isOpen, onClose, onNotify }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_SYSTEM_INSTRUCTIONS);
      setCopied(true);
      onNotify('Prompt para IA copiado para a área de transferência!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotify('Não foi possível copiar o prompt.', 'error');
    }
  };

  const handleDownloadBaseExample = () => {
    downloadMarkdownFile('modelo-exemplo-benhermes', DEFAULT_EXAMPLE_TEMPLATE_MD);
    onNotify('Download do modelo de exemplo concluído!', 'success');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container ai-prompt-modal"
        style={{ maxWidth: '780px', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-kicker">
              <Bot size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Inteligência Artificial & Customização
            </span>
            <h3 className="modal-title">Crie Novos Modelos com IA ou Edite Manualmente</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto' }}>
          <p className="ai-modal-intro">
            Você pode pedir para o <strong>ChatGPT, Claude ou Gemini</strong> criar qualquer tipo de relatório customizado. Basta copiar o prompt abaixo e colar na sua IA favorita!
          </p>

          <div className="ai-steps-grid">
            <div className="ai-step-card">
              <span className="ai-step-num">1</span>
              <div>
                <strong>Copie o Prompt Mestre</strong>
                <p>Ensina a IA todas as regras de formatação e tags do BENHERMES.</p>
              </div>
            </div>
            <div className="ai-step-card">
              <span className="ai-step-num">2</span>
              <div>
                <strong>Peça o Tema Desejado</strong>
                <p>Indique qual tipo de relatório você precisa (ex: Plantão, Vendas, TI).</p>
              </div>
            </div>
            <div className="ai-step-card">
              <span className="ai-step-num">3</span>
              <div>
                <strong>Importe o Arquivo .md</strong>
                <p>Salve a resposta como arquivo <code>.md</code> e clique em <em>Importar .md</em> no site!</p>
              </div>
            </div>
          </div>

          <div className="ai-prompt-box">
            <div className="ai-prompt-box-header">
              <div className="ai-prompt-box-title">
                <FileCode size={16} />
                <span>Prompt Mestre para IA (Copie e Cole)</span>
              </div>
              <Button
                variant="primary"
                onClick={handleCopyPrompt}
                style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar Prompt'}
              </Button>
            </div>
            <pre className="ai-prompt-content">{AI_PROMPT_SYSTEM_INSTRUCTIONS}</pre>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            variant="secondary"
            onClick={handleDownloadBaseExample}
            title="Baixar arquivo modelo-exemplo-benhermes.md"
          >
            <Download size={16} />
            Baixar Modelo Base (.md)
          </Button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
            <Button variant="primary" onClick={handleCopyPrompt}>
              {copied ? <Check size={16} /> : <Sparkles size={16} />}
              {copied ? 'Copiado!' : 'Copiar e Ir para IA'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
