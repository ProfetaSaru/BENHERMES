import { Task } from '../types/task';
import {
  MarkdownTemplateMeta,
  ParsedMarkdownTemplate,
  SystemAutoSource,
  TemplateField,
  TemplateFieldType,
} from '../types/markdownTemplate';

interface FrontmatterResult {
  metadata: Partial<MarkdownTemplateMeta>;
  body: string;
}

export function parseFrontmatter(rawContent: string): FrontmatterResult {
  const trimmed = rawContent.trimStart();
  if (!trimmed.startsWith('---')) {
    return { metadata: {}, body: rawContent };
  }

  const lines = trimmed.split('\n');
  if (lines[0].trim() !== '---') {
    return { metadata: {}, body: rawContent };
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return { metadata: {}, body: rawContent };
  }

  const frontmatterLines = lines.slice(1, closingIndex);
  const body = lines.slice(closingIndex + 1).join('\n').trimStart();

  const metadata: Partial<MarkdownTemplateMeta> = {};
  let currentListKey: string | null = null;
  const listAccumulator: Record<string, string[]> = {};

  for (const line of frontmatterLines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('- ') && currentListKey) {
      const item = trimmedLine.slice(2).trim().replace(/^['"](.*)['"]$/, '$1');
      if (!listAccumulator[currentListKey]) listAccumulator[currentListKey] = [];
      listAccumulator[currentListKey].push(item);
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim().replace(/^['"](.*)['"]$/, '$1');

    if (key === 'categories') {
      currentListKey = 'categories';
      if (value) {
        if (value.startsWith('[') && value.endsWith(']')) {
          metadata.categories = value
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim().replace(/^['"](.*)['"]$/, '$1'))
            .filter(Boolean);
        } else if (value.includes(',')) {
          metadata.categories = value
            .split(',')
            .map((s) => s.trim().replace(/^['"](.*)['"]$/, '$1'))
            .filter(Boolean);
        } else {
          metadata.categories = [value];
        }
      }
      continue;
    } else {
      currentListKey = null;
    }

    if (key === 'title') metadata.title = value;
    else if (key === 'description') metadata.description = value;
    else if (key === 'expandable') metadata.expandable = value.toLowerCase() === 'true';
    else if (key === 'itemlabel') metadata.itemLabel = value;
    else if (key === 'category') {
      const cat = value.toLowerCase();
      if (
        cat === 'atividades' ||
        cat === 'operacional' ||
        cat === 'comunicados' ||
        cat === 'incidentes' ||
        cat === 'personalizado'
      ) {
        metadata.category = cat;
      }
    } else if (key === 'icon') metadata.icon = value;
  }

  if (listAccumulator['categories'] && listAccumulator['categories'].length > 0) {
    metadata.categories = listAccumulator['categories'];
  }

  return { metadata, body };
}

function humanizeLabel(key: string): string {
  const parts = key.split(/[_\-]/).filter(Boolean);
  return parts
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function extractTemplateFields(body: string): TemplateField[] {
  const regex = /\{\{\s*([a-zA-Z0-9_\-]+)(?::([a-zA-Z]+))?\s*\}\}/g;
  const fieldsMap = new Map<string, TemplateField>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const rawId = match[1].toLowerCase().trim();
    const explicitType = match[2]?.toLowerCase();

    if (fieldsMap.has(rawId)) {
      continue;
    }

    let type: TemplateFieldType = 'text';
    let isSystemAuto = false;
    let systemSource: SystemAutoSource | undefined;

    if (
      rawId === 'tarefas' ||
      rawId === 'bloco_produtividade' ||
      rawId === 'tma' ||
      rawId === 'tma_medio' ||
      rawId === 'total_geral_finalizado' ||
      rawId.startsWith('total_') ||
      rawId.startsWith('itens_') ||
      rawId === 'tentativas_contato'
    ) {
      type = 'tasks';
      isSystemAuto = true;
      systemSource = 'tarefas';
    } else if (rawId === 'tarefas_tabela') {
      type = 'tasks';
      isSystemAuto = true;
      systemSource = 'tarefas_tabela';
    } else if (rawId === 'tarefas_lista') {
      type = 'tasks';
      isSystemAuto = true;
      systemSource = 'tarefas_lista';
    } else if (rawId === 'data_atual' || rawId === 'data') {
      type = 'system';
      isSystemAuto = true;
      systemSource = 'data_atual';
    } else if (rawId === 'hora_atual' || rawId === 'hora') {
      type = 'system';
      isSystemAuto = true;
      systemSource = 'hora_atual';
    } else if (explicitType === 'password') {
      type = 'password';
    } else if (explicitType === 'textarea') {
      type = 'textarea';
    } else if (explicitType === 'text') {
      type = 'text';
    } else if (rawId.includes('senha') || rawId.includes('password')) {
      type = 'password';
    } else if (
      rawId.includes('descricao') ||
      rawId.includes('detalhes') ||
      rawId.includes('observacao') ||
      rawId.includes('mensagem') ||
      rawId.includes('pendencias') ||
      rawId.includes('alertas') ||
      rawId.includes('acoes') ||
      rawId.includes('motivo')
    ) {
      type = 'textarea';
    }

    let placeholder = `Informe ${humanizeLabel(rawId).toLowerCase()}...`;
    let defaultValue: string | undefined;

    if (rawId === 'link_vanguard') {
      defaultValue = 'https://gestao.sistemacorban.com.br/index.php/';
      placeholder = 'https://gestao.sistemacorban.com.br/index.php/';
    } else if (rawId === 'periodo') {
      defaultValue = '08:00 - 17:00';
      placeholder = 'Ex: 08:00 - 17:00';
    }

    fieldsMap.set(rawId, {
      id: rawId,
      label: humanizeLabel(rawId),
      type,
      defaultValue,
      isSystemAuto,
      systemSource,
      placeholder,
    });
  }

  return Array.from(fieldsMap.values());
}

export function formatTasksClassic(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '*(Nenhuma tarefa cadastrada)*';
  }

  return tasks
    .map((task) => {
      const upperTitle = task.title.trim().toUpperCase();
      const title = task.description ? `*${upperTitle}:*` : `*${upperTitle}*`;
      const description = task.description ? ` - ${task.description}` : '';
      return `${task.start} – ${task.end} ${title}${description};`;
    })
    .join('\n');
}

export function formatTasksTable(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '| Horário | Atividade | Detalhes |\n| :--- | :--- | :--- |\n| - | *(Nenhuma tarefa cadastrada)* | - |';
  }

  const header = '| Horário | Atividade | Detalhes |\n| :--- | :--- | :--- |';
  const rows = tasks.map((task) => {
    const cleanDesc = (task.description || '-').replace(/\|/g, '\\|').trim();
    return `| ${task.start} – ${task.end} | **${task.title.trim().toUpperCase()}** | ${cleanDesc} |`;
  });

  return [header, ...rows].join('\n');
}

export function formatTasksList(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '- *(Nenhuma tarefa cadastrada)*';
  }

  return tasks
    .map((task) => {
      const upperTitle = task.title.trim().toUpperCase();
      const details = task.description ? ` — ${task.description.trim()}` : '';
      return `- **${task.start} às ${task.end}**: ${upperTitle}${details}`;
    })
    .join('\n');
}

export function calculateTMA(tasks: Task[]): string {
  const validTasks = tasks.filter((t) => {
    if (!t.start || !t.end) return false;
    const cat = (t.category || '').toLowerCase();
    return !cat.includes('tentativa');
  });

  if (validTasks.length === 0) {
    return '0 min';
  }

  let totalMinutes = 0;
  let count = 0;

  for (const t of validTasks) {
    const [sh, sm] = t.start.split(':').map(Number);
    const [eh, em] = t.end.split(':').map(Number);

    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) continue;

    let startTotal = sh * 60 + sm;
    let endTotal = eh * 60 + em;

    if (endTotal < startTotal) {
      endTotal += 24 * 60;
    }

    totalMinutes += endTotal - startTotal;
    count++;
  }

  if (count === 0) return '0 min';
  return `${Math.round(totalMinutes / count)} min`;
}

export function formatProductivityBlock(tasks: Task[]): string {
  const isCategory = (t: Task, pattern: string) => {
    const cat = (t.category || '').toLowerCase();
    return cat.includes(pattern);
  };

  const desbloqueados = tasks.filter((t) => isCategory(t, 'desbloquead'));
  const formalizados = tasks.filter((t) => isCategory(t, 'formaliza'));
  const anuencia = tasks.filter((t) => isCategory(t, 'anuencia') || isCategory(t, 'anuência'));
  const tentativas = tasks.filter((t) => isCategory(t, 'tentativa'));
  const outros = tasks.filter(
    (t) =>
      !isCategory(t, 'desbloquead') &&
      !isCategory(t, 'formaliza') &&
      !isCategory(t, 'anuencia') &&
      !isCategory(t, 'anuência') &&
      !isCategory(t, 'tentativa')
  );

  const formatItem = (t: Task) => {
    const lines = [`CPF: ${t.title.trim().toUpperCase()}`, `Iniciou: ${t.start}`];
    if (t.end) {
      lines.push(`Finalizou: ${t.end}`);
    }
    return lines.join('\n');
  };

  const formatSectionItems = (items: Task[]) => {
    if (items.length === 0) return '';
    return items.map(formatItem).join('\n\n');
  };

  const formatTentativas = (items: Task[]) => {
    if (items.length === 0) return '';
    return items.map((t) => `${t.title.trim().toUpperCase()} ${t.start}`).join('\n');
  };

  const totalGeralFinalizado = tasks.filter((t) => !isCategory(t, 'tentativa') && !!t.end).length;
  const tma = calculateTMA(tasks);

  const parts: string[] = [];

  // DESBLOQUEADOS
  parts.push('DESBLOQUEADOS\n');
  const dText = formatSectionItems(desbloqueados);
  if (dText) parts.push(dText + '\n');
  parts.push(`TOTAL DESBLOQUEADO: ${desbloqueados.length}`);
  parts.push('------------------------------------------------');

  // FORMALIZAÇÃO
  parts.push('FORMALIZAÇÃO:\n');
  const fText = formatSectionItems(formalizados);
  if (fText) parts.push(fText + '\n');
  parts.push(`TOTAL FORMALIZADO: ${formalizados.length}`);
  parts.push('------------------------------------------------------------------------');

  // ANUENCIA
  parts.push('ANUENCIA:\n');
  const aText = formatSectionItems(anuencia);
  if (aText) parts.push(aText + '\n');
  parts.push(`TOTAL: ${anuencia.length}`);
  parts.push('----------------------------------------------------------------------');

  // TOTAIS GERAIS & TMA
  parts.push(`TOTAL GERAL FINALIZADO: ${totalGeralFinalizado}`);
  parts.push(`TMA: ${tma}`);
  parts.push('=====================================');

  // Tentativas de contato
  parts.push('Tentativas de contato:');
  const tText = formatTentativas(tentativas);
  if (tText) parts.push(tText);

  // Outros (se existirem)
  if (outros.length > 0) {
    parts.push('\nOUTROS:');
    parts.push(formatSectionItems(outros));
  }

  return parts.join('\n');
}

export function getSystemAutoValues(tasks: Task[]): Record<string, string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  const formattedDate = `${dd}/${mm}/${yyyy}`;
  const formattedTime = `${hh}:${min}`;

  const isCategory = (t: Task, pattern: string) => {
    const cat = (t.category || '').toLowerCase();
    return cat.includes(pattern);
  };

  const desbloqueados = tasks.filter((t) => isCategory(t, 'desbloquead'));
  const formalizados = tasks.filter((t) => isCategory(t, 'formaliza'));
  const anuencia = tasks.filter((t) => isCategory(t, 'anuencia') || isCategory(t, 'anuência'));
  const tentativas = tasks.filter((t) => isCategory(t, 'tentativa'));

  const formatItem = (t: Task) => {
    const lines = [`CPF: ${t.title.trim().toUpperCase()}`, `Iniciou: ${t.start}`];
    if (t.end) lines.push(`Finalizou: ${t.end}`);
    return lines.join('\n');
  };

  const totalGeralFinalizado = tasks.filter((t) => !isCategory(t, 'tentativa') && !!t.end).length;
  const tma = calculateTMA(tasks);

  return {
    tarefas: formatTasksClassic(tasks),
    tarefas_tabela: formatTasksTable(tasks),
    tarefas_lista: formatTasksList(tasks),
    data_atual: formattedDate,
    data: formattedDate,
    hora_atual: formattedTime,
    hora: formattedTime,
    bloco_produtividade: formatProductivityBlock(tasks),
    total_desbloqueados: String(desbloqueados.length),
    total_desbloqueado: String(desbloqueados.length),
    itens_desbloqueados: desbloqueados.map(formatItem).join('\n\n'),
    total_formalizados: String(formalizados.length),
    total_formalizado: String(formalizados.length),
    itens_formalizacao: formalizados.map(formatItem).join('\n\n'),
    total_anuencia: String(anuencia.length),
    itens_anuencia: anuencia.map(formatItem).join('\n\n'),
    total_geral_finalizado: String(totalGeralFinalizado),
    tma,
    tma_medio: tma,
    tentativas_contato: tentativas.map((t) => `${t.title.trim().toUpperCase()} ${t.start}`).join('\n'),
  };
}

export function renderTemplate(
  templateBody: string,
  fieldValues: Record<string, string>,
  tasks: Task[]
): string {
  const systemValues = getSystemAutoValues(tasks);

  return templateBody.replace(
    /\{\{\s*([a-zA-Z0-9_\-]+)(?::[a-zA-Z]+)?\s*\}\}/g,
    (_, id: string) => {
      const cleanId = id.toLowerCase().trim();

      // Prioridade 1: Valor informado pelo usuário no form
      if (fieldValues[cleanId] !== undefined && fieldValues[cleanId] !== '') {
        if (cleanId === 'nome_completo' || cleanId === 'nome_colaborador') {
          return fieldValues[cleanId].toUpperCase();
        }
        return fieldValues[cleanId];
      }

      // Prioridade 2: Valor do sistema se for uma tag especial
      if (systemValues[cleanId] !== undefined) {
        return systemValues[cleanId];
      }

      // Prioridade 3: Valores padrão convenientes para novos acessos
      if (cleanId === 'link_vanguard') {
        return 'https://gestao.sistemacorban.com.br/index.php/';
      }
      if (cleanId === 'periodo') {
        return '08:00 - 17:00';
      }

      // Valor não preenchido: retorna a tag amigável ou vazio
      return `[${cleanId.toUpperCase()}]`;
    }
  );
}

export function parseMarkdownTemplate(
  rawContent: string,
  fallbackId = 'template-custom'
): ParsedMarkdownTemplate {
  const { metadata, body } = parseFrontmatter(rawContent);
  const fields = extractTemplateFields(body);

  const title =
    metadata.title ||
    body.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    humanizeLabel(fallbackId);

  const description =
    metadata.description ||
    'Modelo de relatório configurado para preenchimento ágil.';

  const category = metadata.category || 'personalizado';

  const isExplicitExpandable =
    metadata.expandable !== undefined
      ? metadata.expandable
      : fields.some((f) => f.type === 'tasks');

  const meta: MarkdownTemplateMeta = {
    id: fallbackId,
    title,
    description,
    category,
    icon: metadata.icon || 'FileText',
    isBuiltin: false,
    expandable: isExplicitExpandable,
    categories: metadata.categories,
    itemLabel: metadata.itemLabel,
    rawContent,
  };

  return {
    meta,
    fields,
    templateBody: body,
  };
}
