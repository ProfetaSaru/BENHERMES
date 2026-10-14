import atividadesPadraoRaw from './atividades-padrao.md?raw';
import atividadesTabelaRaw from './atividades-tabela.md?raw';
import passagemPlantaoRaw from './passagem-plantao.md?raw';
import comunicadoGeralRaw from './comunicado-geral.md?raw';
import relatorioIncidenteRaw from './relatorio-incidente.md?raw';
import novoColaboradorRaw from './novo-colaborador.md?raw';
import { MarkdownTemplateMeta } from '../../types/markdownTemplate';
import { parseMarkdownTemplate } from '../../utils/markdownTemplateParser';

export const BUILTIN_TEMPLATES: MarkdownTemplateMeta[] = [
  { ...parseMarkdownTemplate(atividadesPadraoRaw, 'atividades-padrao').meta, isBuiltin: true },
  { ...parseMarkdownTemplate(atividadesTabelaRaw, 'atividades-tabela').meta, isBuiltin: true },
  { ...parseMarkdownTemplate(passagemPlantaoRaw, 'passagem-plantao').meta, isBuiltin: true },
  { ...parseMarkdownTemplate(novoColaboradorRaw, 'novo-colaborador').meta, isBuiltin: true },
  { ...parseMarkdownTemplate(comunicadoGeralRaw, 'comunicado-geral').meta, isBuiltin: true },
  { ...parseMarkdownTemplate(relatorioIncidenteRaw, 'relatorio-incidente').meta, isBuiltin: true },
];

