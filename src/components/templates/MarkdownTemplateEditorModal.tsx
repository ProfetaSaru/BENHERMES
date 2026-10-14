import React, { useState, useEffect, useMemo } from 'react';
import { Save, X, Tag, Code } from 'lucide-react';
import { Button } from '../common/Button';
import { extractTemplateFields, parseFrontmatter } from '../../utils/markdownTemplateParser';
import { MarkdownTemplateMeta } from '../../types/markdownTemplate';

interface Props {
  isOpen: boolean;
  editingTemplate?: MarkdownTemplateMeta | null;
  onClose: () => void;
  onSave: (title: string, rawContent: string) => void;
  onNotify: (message: string, type?: 'success' | 'error' | '') => void;
}

const STARTER_MD_TEMPLATE = `---
title: Meu Novo Modelo de Relatório
description: Modelo personalizado de acompanhamento
category: personalizado
---

# 📋 {{titulo_relatorio}}

**Data:** {{data_atual}}
**Responsável:** {{responsavel}}

---

## ⏱️ Atividades Realizadas
{{tarefas_tabela}}

---

## 📌 Observações & Próximos Passos
{{observacoes:textarea}}
`;

export const MarkdownTemplateEditorModal: React.FC<Props> = ({
  isOpen,
  editingTemplate,
  onClose,
  onSave,
  onNotify,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isExpandable, setIsExpandable] = useState(true);

  useEffect(() => {
    if (editingTemplate) {
      setTitle(editingTemplate.title);
      setContent(editingTemplate.rawContent);
      setIsExpandable(editingTemplate.expandable ?? false);
    } else {
      setTitle('Meu Novo Modelo');
      setContent(STARTER_MD_TEMPLATE);
      setIsExpandable(true);
    }
  }, [editingTemplate, isOpen]);

  const detectedFields = useMemo(() => {
    const { body } = parseFrontmatter(content);
    return extractTemplateFields(body);
  }, [content]);

  if (!isOpen) return null;

  const handleInsertTag = (tag: string) => {
    setContent((prev) => `${prev} {{${tag}}}`);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onNotify('Informe um título para o modelo.', 'error');
      return;
    }
    if (!content.trim()) {
      onNotify('O conteúdo do modelo não pode estar vazio.', 'error');
      return;
    }

    // Garante que o frontmatter tenha expandable: true/false conforme selecionado
    let finalContent = content;
    if (finalContent.startsWith('---')) {
      const closingIdx = finalContent.indexOf('\n---', 3);
      if (closingIdx !== -1) {
        const fm = finalContent.slice(0, closingIdx);
        const rest = finalContent.slice(closingIdx);
        if (/expandable:\s*(true|false)/i.test(fm)) {
          finalContent = fm.replace(/expandable:\s*(true|false)/i, `expandable: ${isExpandable}`) + rest;
        } else {
          finalContent = `${fm}\nexpandable: ${isExpandable}${rest}`;
        }
      }
    } else {
      finalContent = `---\ntitle: ${title.trim()}\nexpandable: ${isExpandable}\n---\n\n${content}`;
    }

    onSave(title.trim(), finalContent);
    onNotify(editingTemplate ? 'Modelo atualizado com sucesso!' : 'Novo modelo salvo com sucesso!', 'success');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container md-editor-modal"
        style={{ maxWidth: '880px', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-kicker">
              <Code size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Editor de Modelos Markdown
            </span>
            <h3 className="modal-title">
              {editingTemplate ? `Editar: ${editingTemplate.title}` : 'Criar Novo Modelo de Relatório'}
            </h3>
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

        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="template-title-input">
                Título do Modelo
              </label>
              <input
                id="template-title-input"
                type="text"
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Relatório de Turno / Fechamento de Vendas"
                required
              />
            </div>

            <div className="form-group" style={{ margin: '0 0 4px 0' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isExpandable}
                  onChange={(e) => setIsExpandable(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--blue)', cursor: 'pointer' }}
                />
                <span>
                  <strong>Relatório Expansível</strong> (integra formulário e grade de tarefas dinâmicas)
                </span>
              </label>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '24px', display: 'block' }}>
                {isExpandable
                  ? 'Exibirá os apontamentos de tarefas e lista de horários diários na Central de Relatórios.'
                  : 'Exibirá apenas os campos pontuais de formulário direto sem lista de tarefas diárias.'}
              </span>
            </div>

            {/* Barra de atalhos de tags */}
            <div className="template-editor-tag-toolbar">
              <span className="template-toolbar-label">
                <Tag size={13} /> Inserir Tag:
              </span>
              <div className="template-tag-chips">
                <button
                  type="button"
                  className="tag-chip-btn"
                  onClick={() => handleInsertTag('campo')}
                  title="Campo de texto normal"
                >
                  {'+ {{campo}}'}
                </button>
                <button
                  type="button"
                  className="tag-chip-btn"
                  onClick={() => handleInsertTag('senha:password')}
                  title="Campo protegido de senha com botão de exibir/ocultar"
                >
                  {'+ {{senha:password}}'}
                </button>
                <button
                  type="button"
                  className="tag-chip-btn"
                  onClick={() => handleInsertTag('detalhes:textarea')}
                  title="Campo de texto longo"
                >
                  {'+ {{detalhes:textarea}}'}
                </button>
                <button
                  type="button"
                  className="tag-chip-btn tag-chip-auto"
                  onClick={() => handleInsertTag('tarefas')}
                  title="Lista clássica de tarefas do sistema"
                >
                  {'+ {{tarefas}}'}
                </button>
                <button
                  type="button"
                  className="tag-chip-btn tag-chip-auto"
                  onClick={() => handleInsertTag('tarefas_tabela')}
                  title="Tabela de tarefas do sistema"
                >
                  {'+ {{tarefas_tabela}}'}
                </button>
                <button
                  type="button"
                  className="tag-chip-btn tag-chip-auto"
                  onClick={() => handleInsertTag('tarefas_lista')}
                  title="Lista com marcadores das tarefas"
                >
                  {'+ {{tarefas_lista}}'}
                </button>
                <button
                  type="button"
                  className="tag-chip-btn tag-chip-auto"
                  onClick={() => handleInsertTag('data_atual')}
                  title="Data de hoje automática"
                >
                  {'+ {{data_atual}}'}
                </button>
                <button
                  type="button"
                  className="tag-chip-btn tag-chip-auto"
                  onClick={() => handleInsertTag('hora_atual')}
                  title="Hora atual automática"
                >
                  {'+ {{hora_atual}}'}
                </button>
              </div>
            </div>

            {/* Área de edição */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" htmlFor="template-content-textarea" style={{ margin: 0 }}>
                  Conteúdo Markdown (.md)
                </label>
                <span className="template-fields-count-badge">
                  {detectedFields.length} {detectedFields.length === 1 ? 'campo detectado' : 'campos detectados'}
                </span>
              </div>
              <textarea
                id="template-content-textarea"
                className="textarea-field"
                style={{
                  minHeight: '260px',
                  fontFamily: 'monospace',
                  fontSize: '0.88rem',
                  lineHeight: '1.5',
                  resize: 'vertical',
                }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Cole ou digite aqui seu Markdown com as tags {{variavel}}..."
                required
              />
            </div>

            {/* Painel de campos detectados */}
            <div className="detected-fields-panel">
              <span className="detected-fields-title">
                Campos que serão gerados automaticamente no formulário:
              </span>
              <div className="detected-fields-list">
                {detectedFields.length === 0 ? (
                  <span className="detected-field-empty">
                    Nenhuma tag {'{{campo}}'} encontrada ainda. Use as tags acima para criar variáveis dinâmicas!
                  </span>
                ) : (
                  detectedFields.map((f) => (
                    <span
                      key={f.id}
                      className={`detected-field-badge ${f.isSystemAuto ? 'is-auto' : ''}`}
                    >
                      {f.id}
                      {f.isSystemAuto && <span className="auto-pill">auto</span>}
                      {f.type === 'textarea' && <span className="auto-pill">textarea</span>}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              <Save size={16} />
              {editingTemplate ? 'Salvar Alterações' : 'Criar Modelo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
