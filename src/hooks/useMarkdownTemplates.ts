import { useState, useMemo, useCallback, useEffect } from 'react';
import { MarkdownTemplateMeta, ParsedMarkdownTemplate } from '../types/markdownTemplate';
import { BUILTIN_TEMPLATES } from '../templates/reports';
import { extractTemplateFields } from '../utils/markdownTemplateParser';
import { UserRole, isTemplateAllowedForRole } from '../types/auth';

const DEFAULT_TEMPLATE_ID = BUILTIN_TEMPLATES[0]?.id || 'atividades-padrao';

export function useMarkdownTemplates(userRole?: UserRole) {
  const allowedTemplates = useMemo(() => {
    return BUILTIN_TEMPLATES.filter((t) => isTemplateAllowedForRole(userRole, t.id));
  }, [userRole]);

  const [activeTemplateId, setActiveTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});

  // Garante que, se o perfil do usuário for operador e o template ativo não for permitido, volte ao padrão
  useEffect(() => {
    if (userRole === 'operador' && !isTemplateAllowedForRole('operador', activeTemplateId)) {
      setActiveTemplateId(DEFAULT_TEMPLATE_ID);
    }
  }, [userRole, activeTemplateId]);

  const fieldValues = useMemo<Record<string, string>>(() => {
    return drafts[activeTemplateId] || {};
  }, [drafts, activeTemplateId]);

  const activeTemplate = useMemo<MarkdownTemplateMeta>(() => {
    return (
      allowedTemplates.find((t) => t.id === activeTemplateId) ||
      allowedTemplates[0] ||
      BUILTIN_TEMPLATES[0]
    );
  }, [allowedTemplates, activeTemplateId]);

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
    if (allowedTemplates.some((t) => t.id === id)) {
      setActiveTemplateId(id);
    }
  }, [allowedTemplates]);

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
      const validId = allowedTemplates.some((t) => t.id === templateId)
        ? templateId
        : DEFAULT_TEMPLATE_ID;
      setActiveTemplateId(validId);
      setDrafts((prev) => ({
        ...prev,
        [validId]: { ...restoredFields },
      }));
    },
    [allowedTemplates]
  );

  const hydrateDrafts = useCallback(
    (
      nextActiveTemplateId?: string,
      nextFieldsByTemplate?: Record<string, Record<string, string>>
    ) => {
      const validId =
        nextActiveTemplateId && allowedTemplates.some((t) => t.id === nextActiveTemplateId)
          ? nextActiveTemplateId
          : DEFAULT_TEMPLATE_ID;
      setActiveTemplateId(validId);
      setDrafts(
        nextFieldsByTemplate && typeof nextFieldsByTemplate === 'object'
          ? nextFieldsByTemplate
          : {}
      );
    },
    [allowedTemplates]
  );

  const resetAllDrafts = useCallback(() => {
    setActiveTemplateId(DEFAULT_TEMPLATE_ID);
    setDrafts({});
  }, []);

  return {
    templates: allowedTemplates,
    builtinTemplates: allowedTemplates,
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
