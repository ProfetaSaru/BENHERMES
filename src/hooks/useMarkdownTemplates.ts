import { useState, useMemo, useCallback } from 'react';
import { MarkdownTemplateMeta, ParsedMarkdownTemplate } from '../types/markdownTemplate';
import { BUILTIN_TEMPLATES } from '../templates/reports';
import { extractTemplateFields } from '../utils/markdownTemplateParser';

const DEFAULT_TEMPLATE_ID = BUILTIN_TEMPLATES[0]?.id || 'atividades-padrao';

export function useMarkdownTemplates() {
  const [activeTemplateId, setActiveTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});

  const fieldValues = useMemo<Record<string, string>>(() => {
    return drafts[activeTemplateId] || {};
  }, [drafts, activeTemplateId]);

  const activeTemplate = useMemo<MarkdownTemplateMeta>(() => {
    return (
      BUILTIN_TEMPLATES.find((t) => t.id === activeTemplateId) ||
      BUILTIN_TEMPLATES[0]
    );
  }, [activeTemplateId]);

  const parsedActiveTemplate = useMemo<ParsedMarkdownTemplate>(() => {
    const templateBody = activeTemplate.templateBody || activeTemplate.rawContent || '';
    const fields =
      activeTemplate.fields && activeTemplate.fields.length > 0
        ? activeTemplate.fields
        : extractTemplateFields(templateBody);

    return {
      meta: activeTemplate,
      fields,
      templateBody,
    };
  }, [activeTemplate]);

  const handleSelectTemplate = useCallback((id: string) => {
    if (BUILTIN_TEMPLATES.some((t) => t.id === id)) {
      setActiveTemplateId(id);
    }
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

  const restoreTemplateState = useCallback(
    (templateId: string, restoredFields: Record<string, string>) => {
      const validId = BUILTIN_TEMPLATES.some((t) => t.id === templateId)
        ? templateId
        : DEFAULT_TEMPLATE_ID;
      setActiveTemplateId(validId);
      setDrafts((prev) => ({
        ...prev,
        [validId]: { ...restoredFields },
      }));
    },
    []
  );

  const hydrateDrafts = useCallback(
    (
      nextActiveTemplateId?: string,
      nextFieldsByTemplate?: Record<string, Record<string, string>>
    ) => {
      const validId =
        nextActiveTemplateId && BUILTIN_TEMPLATES.some((t) => t.id === nextActiveTemplateId)
          ? nextActiveTemplateId
          : DEFAULT_TEMPLATE_ID;
      setActiveTemplateId(validId);
      setDrafts(
        nextFieldsByTemplate && typeof nextFieldsByTemplate === 'object'
          ? nextFieldsByTemplate
          : {}
      );
    },
    []
  );

  const resetAllDrafts = useCallback(() => {
    setActiveTemplateId(DEFAULT_TEMPLATE_ID);
    setDrafts({});
  }, []);

  return {
    templates: BUILTIN_TEMPLATES,
    builtinTemplates: BUILTIN_TEMPLATES,
    activeTemplateId,
    activeTemplate,
    parsedActiveTemplate,
    fieldValues,
    fieldsByTemplate: drafts,
    setFieldValue: handleSetFieldValue,
    resetFieldValues: handleResetFieldValues,
    selectTemplate: handleSelectTemplate,
    restoreTemplateState,
    hydrateDrafts,
    resetAllDrafts,
  };
}
