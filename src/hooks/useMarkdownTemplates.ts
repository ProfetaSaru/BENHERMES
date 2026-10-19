import { useState, useEffect, useMemo, useCallback } from 'react';
import { MarkdownTemplateMeta, ParsedMarkdownTemplate } from '../types/markdownTemplate';
import { BUILTIN_TEMPLATES } from '../templates/reports';
import { parseMarkdownTemplate } from '../utils/markdownTemplateParser';
import { downloadMarkdownFile, DEFAULT_EXAMPLE_TEMPLATE_MD } from '../utils/aiPromptTemplate';

const STORAGE_CUSTOM_TEMPLATES_KEY = 'benhermes_custom_markdown_templates';
const STORAGE_ACTIVE_TEMPLATE_KEY = 'benhermes_active_template_id';
const STORAGE_DRAFTS_KEY = 'benhermes_draft_template_fields';

function loadStoredCustomTemplates(): MarkdownTemplateMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        ...item,
        isBuiltin: false,
      }));
    }
    return [];
  } catch (err) {
    console.error('Erro ao ler modelos customizados do localStorage:', err);
    return [];
  }
}

function saveCustomTemplates(templates: MarkdownTemplateMeta[]): void {
  try {
    localStorage.setItem(STORAGE_CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Erro ao salvar modelos customizados no localStorage:', err);
  }
}

function loadStoredActiveTemplateId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_ACTIVE_TEMPLATE_KEY);
    if (saved) return saved;
  } catch {
    // Ignore error
  }
  return BUILTIN_TEMPLATES[0]?.id || 'atividades-padrao';
}

function saveStoredActiveTemplateId(id: string): void {
  try {
    localStorage.setItem(STORAGE_ACTIVE_TEMPLATE_KEY, id);
  } catch {
    // Ignore error
  }
}

function loadStoredDrafts(): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredDrafts(drafts: Record<string, Record<string, string>>): void {
  try {
    localStorage.setItem(STORAGE_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Ignore error
  }
}

export function useMarkdownTemplates() {
  const [customTemplates, setCustomTemplates] = useState<MarkdownTemplateMeta[]>(() =>
    loadStoredCustomTemplates()
  );

  const allTemplates = useMemo<MarkdownTemplateMeta[]>(() => {
    return [...BUILTIN_TEMPLATES, ...customTemplates];
  }, [customTemplates]);

  const [activeTemplateId, setActiveTemplateId] = useState<string>(() => {
    const savedId = loadStoredActiveTemplateId();
    // Verifica se o ID salvo existe nos modelos conhecidos
    const exists =
      BUILTIN_TEMPLATES.some((t) => t.id === savedId) ||
      loadStoredCustomTemplates().some((t) => t.id === savedId);
    return exists ? savedId : BUILTIN_TEMPLATES[0]?.id || 'atividades-padrao';
  });

  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>(() =>
    loadStoredDrafts()
  );

  // Valores de campo do modelo atualmente ativo
  const fieldValues = useMemo<Record<string, string>>(() => {
    return drafts[activeTemplateId] || {};
  }, [drafts, activeTemplateId]);

  // Persistir modelos customizados
  useEffect(() => {
    saveCustomTemplates(customTemplates);
  }, [customTemplates]);

  // Persistir rascunhos temporários
  useEffect(() => {
    saveStoredDrafts(drafts);
  }, [drafts]);

  // Persistir ID do modelo ativo
  useEffect(() => {
    saveStoredActiveTemplateId(activeTemplateId);
  }, [activeTemplateId]);

  const activeTemplate = useMemo(() => {
    return (
      allTemplates.find((t) => t.id === activeTemplateId) ||
      allTemplates[0] ||
      BUILTIN_TEMPLATES[0]
    );
  }, [allTemplates, activeTemplateId]);

  const parsedActiveTemplate = useMemo<ParsedMarkdownTemplate>(() => {
    if (!activeTemplate) {
      return parseMarkdownTemplate('', 'vazio');
    }
    return parseMarkdownTemplate(activeTemplate.rawContent, activeTemplate.id);
  }, [activeTemplate]);

  const handleSelectTemplate = useCallback((id: string) => {
    setActiveTemplateId(id);
    saveStoredActiveTemplateId(id);
  }, []);

  const handleSetFieldValue = useCallback(
    (fieldId: string, value: string) => {
      setDrafts((prev) => {
        const currentTemplateDraft = prev[activeTemplateId] || {};
        return {
          ...prev,
          [activeTemplateId]: {
            ...currentTemplateDraft,
            [fieldId]: value,
          },
        };
      });
    },
    [activeTemplateId]
  );

  const handleResetFieldValues = useCallback(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[activeTemplateId];
      return next;
    });
  }, [activeTemplateId]);

  /**
   * Restaura o modelo e seus campos (usado pelo histórico).
   */
  const restoreTemplateState = useCallback(
    (templateId: string, restoredFields: Record<string, string>) => {
      setActiveTemplateId(templateId);
      saveStoredActiveTemplateId(templateId);
      setDrafts((prev) => ({
        ...prev,
        [templateId]: { ...restoredFields },
      }));
    },
    []
  );

  const handleAddCustomTemplate = useCallback((title: string, rawContent: string): string => {
    const parsed = parseMarkdownTemplate(rawContent);
    const newId = `custom-${Date.now()}`;
    const newTemplate: MarkdownTemplateMeta = {
      ...parsed.meta,
      id: newId,
      title: title.trim() || parsed.meta.title,
      isBuiltin: false,
      createdAt: new Date().toISOString(),
      rawContent,
    };

    setCustomTemplates((prev) => [newTemplate, ...prev]);
    setActiveTemplateId(newId);
    saveStoredActiveTemplateId(newId);
    return newId;
  }, []);

  const handleUpdateCustomTemplate = useCallback(
    (id: string, title: string, rawContent: string) => {
      const parsed = parseMarkdownTemplate(rawContent);
      setCustomTemplates((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            return {
              ...parsed.meta,
              id,
              title: title.trim() || parsed.meta.title,
              isBuiltin: false,
              rawContent,
            };
          }
          return t;
        })
      );
    },
    []
  );

  const handleDeleteCustomTemplate = useCallback((id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    setActiveTemplateId((prevId) => {
      if (prevId === id) {
        const nextId = BUILTIN_TEMPLATES[0]?.id || 'atividades-padrao';
        saveStoredActiveTemplateId(nextId);
        return nextId;
      }
      return prevId;
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleImportFromFile = useCallback(
    async (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            if (!content) {
              throw new Error('Arquivo vazio');
            }
            const baseName = file.name.replace(/\.md$/i, '');
            const newId = handleAddCustomTemplate(baseName, content);
            resolve(newId);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(new Error('Erro na leitura do arquivo'));
        reader.readAsText(file);
      });
    },
    [handleAddCustomTemplate]
  );

  const handleExportTemplate = useCallback((template: MarkdownTemplateMeta) => {
    downloadMarkdownFile(template.title.toLowerCase().replace(/\s+/g, '-'), template.rawContent);
  }, []);

  const handleDownloadExampleBase = useCallback(() => {
    downloadMarkdownFile('modelo-exemplo-benhermes', DEFAULT_EXAMPLE_TEMPLATE_MD);
  }, []);

  return {
    templates: allTemplates,
    builtinTemplates: BUILTIN_TEMPLATES,
    customTemplates,
    activeTemplateId,
    activeTemplate,
    parsedActiveTemplate,
    fieldValues,
    setFieldValue: handleSetFieldValue,
    resetFieldValues: handleResetFieldValues,
    selectTemplate: handleSelectTemplate,
    restoreTemplateState,
    addCustomTemplate: handleAddCustomTemplate,
    updateCustomTemplate: handleUpdateCustomTemplate,
    deleteCustomTemplate: handleDeleteCustomTemplate,
    importTemplateFromFile: handleImportFromFile,
    exportTemplateToFile: handleExportTemplate,
    downloadExampleBase: handleDownloadExampleBase,
  };
}
