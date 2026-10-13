import { useState, useEffect, useMemo, useCallback } from 'react';
import { MarkdownTemplateMeta, ParsedMarkdownTemplate } from '../types/markdownTemplate';
import { BUILTIN_TEMPLATES } from '../templates/reports';
import { parseMarkdownTemplate } from '../utils/markdownTemplateParser';
import { downloadMarkdownFile, DEFAULT_EXAMPLE_TEMPLATE_MD } from '../utils/aiPromptTemplate';

const STORAGE_KEY = 'benhermes_custom_markdown_templates';

function loadStoredCustomTemplates(): MarkdownTemplateMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Erro ao salvar modelos customizados no localStorage:', err);
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
    return BUILTIN_TEMPLATES[0]?.id || 'atividades-padrao';
  });

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Salvar no localStorage sempre que customTemplates mudar
  useEffect(() => {
    saveCustomTemplates(customTemplates);
  }, [customTemplates]);

  const activeTemplate = useMemo(() => {
    return allTemplates.find((t) => t.id === activeTemplateId) || allTemplates[0] || BUILTIN_TEMPLATES[0];
  }, [allTemplates, activeTemplateId]);

  const parsedActiveTemplate = useMemo<ParsedMarkdownTemplate>(() => {
    if (!activeTemplate) {
      return parseMarkdownTemplate('', 'vazio');
    }
    return parseMarkdownTemplate(activeTemplate.rawContent, activeTemplate.id);
  }, [activeTemplate]);

  const handleSelectTemplate = useCallback((id: string) => {
    setActiveTemplateId(id);
    setFieldValues({});
  }, []);

  const handleSetFieldValue = useCallback((fieldId: string, value: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  }, []);

  const handleResetFieldValues = useCallback(() => {
    setFieldValues({});
  }, []);

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
    setFieldValues({});
    return newId;
  }, []);

  const handleUpdateCustomTemplate = useCallback((id: string, title: string, rawContent: string) => {
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
  }, []);

  const handleDeleteCustomTemplate = useCallback((id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    setActiveTemplateId((prevId) => {
      if (prevId === id) {
        return BUILTIN_TEMPLATES[0]?.id || 'atividades-padrao';
      }
      return prevId;
    });
    setFieldValues({});
  }, []);

  const handleImportFromFile = useCallback(async (file: File): Promise<string> => {
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
  }, [handleAddCustomTemplate]);

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
    addCustomTemplate: handleAddCustomTemplate,
    updateCustomTemplate: handleUpdateCustomTemplate,
    deleteCustomTemplate: handleDeleteCustomTemplate,
    importTemplateFromFile: handleImportFromFile,
    exportTemplateToFile: handleExportTemplate,
    downloadExampleBase: handleDownloadExampleBase,
  };
}
