import React, { useEffect, useRef, useState } from 'react';
import { Settings2, Upload, FileDown, Save, AlertTriangle, Bot } from 'lucide-react';
import { ConfigRanking, MetasGrupo, StatusIa } from '../../types/ranking';
import { validarConfig } from '../../../server/ranking/config';

interface RankingConfiguracaoProps {
  config: ConfigRanking | null;
  statusIa: StatusIa | null;
  /** Devolve '' quando salvou ou a mensagem de erro */
  onSalvar: (config: ConfigRanking) => Promise<string>;
  onAviso: (texto: string, tipo: 'success' | 'error') => void;
}

const CAMPOS: { chave: keyof MetasGrupo; titulo: string }[] = [
  { chave: 'meta_vendedor', titulo: 'Meta do vendedor' },
  { chave: 'meta_bonus_vendedor', titulo: 'Bônus do vendedor a partir de' },
  { chave: 'meta_supervisor', titulo: 'Meta do supervisor' },
  { chave: 'meta_bonus_supervisor', titulo: 'Bônus do supervisor a partir de' },
  { chave: 'meta_cartao', titulo: 'Meta de cartão' },
];

interface Formulario {
  metas: Record<'clt' | 'estagio', Record<keyof MetasGrupo, string>>;
  meta_geral: string;
  emoji_destaque: string;
  feriados: string;
  vendedores_clt: string;
  supervisores_clt: string;
  funcionarios_ativos: string;
  incluir_sempre: string;
  vinculos: string;
  argus_em: string | null;
  renomear: string;
  usar_chatgpt: boolean;
  usar_claude: boolean;
}

const grupoParaTexto = (g?: MetasGrupo) =>
  Object.fromEntries(CAMPOS.map(({ chave }) => [chave, g ? String(g[chave]) : ''])) as Record<keyof MetasGrupo, string>;

const paraFormulario = (c: ConfigRanking | null): Formulario => ({
  metas: { clt: grupoParaTexto(c?.metas.clt), estagio: grupoParaTexto(c?.metas.estagio) },
  meta_geral: c ? String(c.metas.meta_geral) : '',
  emoji_destaque: c?.emoji_destaque ?? '🏆',
  feriados: (c?.feriados ?? []).join('\n'),
  vendedores_clt: (c?.vendedores_clt ?? []).join('\n'),
  supervisores_clt: (c?.supervisores_clt ?? []).join('\n'),
  funcionarios_ativos: (c?.funcionarios_ativos ?? []).join('\n'),
  incluir_sempre: (c?.incluir_sempre ?? []).join('\n'),
  vinculos: Object.entries(c?.vinculos_argus ?? {})
    .map(([de, para]) => `${de} = ${para}`)
    .join('\n'),
  argus_em: c?.argus_em ?? null,
  renomear: Object.entries(c?.renomear_supervisores ?? {})
    .map(([de, para]) => `${de} = ${para}`)
    .join('\n'),
  usar_chatgpt: c?.ia.usar_chatgpt ?? true,
  usar_claude: c?.ia.usar_claude ?? true,
});

const linhas = (texto: string) =>
  texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

/** Aceita "1.234,56", "1234.56" ou "450000" */
const numero = (texto: string): number => {
  const t = texto.trim().replace(/\s|R\$/g, '');
  if (t === '') return NaN;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
};

const doFormulario = (f: Formulario) => ({
  metas: {
    clt: Object.fromEntries(CAMPOS.map(({ chave }) => [chave, numero(f.metas.clt[chave])])),
    estagio: Object.fromEntries(CAMPOS.map(({ chave }) => [chave, numero(f.metas.estagio[chave])])),
    meta_geral: numero(f.meta_geral),
  },
  emoji_destaque: f.emoji_destaque.trim() || '🏆',
  feriados: linhas(f.feriados),
  vendedores_clt: linhas(f.vendedores_clt),
  supervisores_clt: linhas(f.supervisores_clt),
  funcionarios_ativos: linhas(f.funcionarios_ativos),
  incluir_sempre: linhas(f.incluir_sempre),
  // "ESTEIRA = ARGUS"; lado direito vazio = não é a mesma pessoa
  vinculos_argus: Object.fromEntries(
    linhas(f.vinculos)
      .map((l) => l.split('='))
      .filter((p) => p.length === 2 && p[0].trim())
      .map(([de, para]) => [de.trim(), para.trim()])
  ),
  argus_em: f.argus_em,
  renomear_supervisores: Object.fromEntries(
    linhas(f.renomear)
      .map((l) => l.split('='))
      .filter((p) => p.length === 2 && p[0].trim() && p[1].trim())
      .map(([de, para]) => [de.trim(), para.trim()])
  ),
  ia: { usar_chatgpt: f.usar_chatgpt, usar_claude: f.usar_claude },
});

/** Mensagem amigável trocando o nome técnico do campo pelo nome da tela */
const traduzirErro = (erro: string) =>
  erro
    .replace('metas.clt.', 'Metas CLT › ')
    .replace('metas.estagio.', 'Metas Estágio › ')
    .replace(/meta_bonus_vendedor/, 'bônus do vendedor')
    .replace(/meta_bonus_supervisor/, 'bônus do supervisor')
    .replace(/meta_vendedor/, 'meta do vendedor')
    .replace(/meta_supervisor/, 'meta do supervisor')
    .replace(/meta_cartao/, 'meta de cartão')
    .replace('metas.meta_geral', 'Meta geral')
    .replace('feriados', 'Feriados');

export const RankingConfiguracao: React.FC<RankingConfiguracaoProps> = ({ config, statusIa, onSalvar, onAviso }) => {
  const [form, setForm] = useState<Formulario>(() => paraFormulario(config));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => setForm(paraFormulario(config)), [config]);

  const alterar = <K extends keyof Formulario>(chave: K, valor: Formulario[K]) => setForm((f) => ({ ...f, [chave]: valor }));
  const alterarMeta = (grupo: 'clt' | 'estagio', chave: keyof MetasGrupo, valor: string) =>
    setForm((f) => ({ ...f, metas: { ...f.metas, [grupo]: { ...f.metas[grupo], [chave]: valor } } }));

  const salvar = async (bruto: unknown, origem: 'tela' | 'arquivo') => {
    const r = validarConfig(bruto);
    if ('erro' in r) {
      setErro(traduzirErro(r.erro));
      onAviso(`Configuração não salva: ${traduzirErro(r.erro)}`, 'error');
      return;
    }
    setSalvando(true);
    const falha = await onSalvar(r.config);
    setSalvando(false);
    if (falha) {
      setErro(`Não salvou no servidor: ${falha}. O que está na tela não foi perdido; tente de novo.`);
      onAviso(`Configuração não salva: ${falha}`, 'error');
      return;
    }
    setErro('');
    onAviso(origem === 'arquivo' ? 'config.json importado e salvo no servidor.' : 'Configuração salva no servidor.', 'success');
  };

  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (arquivoRef.current) arquivoRef.current.value = '';
    if (!arquivo) return;
    try {
      const json = JSON.parse(await arquivo.text());
      // O config.json do pacote não tem a escolha das IAs nem as ligações com a Argus: mantém as que estão salvas.
      // A lista de ativos importada vale até o próximo ranking, quando a Argus a substitui.
      if (json && typeof json === 'object' && config) {
        for (const campo of ['ia', 'incluir_sempre', 'vinculos_argus'] as const) if (json[campo] === undefined) json[campo] = config[campo];
      }
      await salvar(json, 'arquivo');
    } catch {
      setErro('O arquivo não é um JSON válido.');
      onAviso('O arquivo não é um JSON válido.', 'error');
    }
  };

  const exportar = () => {
    if (!config) return;
    // JSON puro (sem BOM), para servir também ao pacote em Python
    const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'config.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const lista = ({ chave, titulo, ajuda }: { chave: 'vendedores_clt' | 'supervisores_clt' | 'funcionarios_ativos' | 'incluir_sempre' | 'feriados'; titulo: string; ajuda: string }) => (
    <div className="formatter-mapping-field mapped">
      <label htmlFor={`ranking-${chave}`} className="formatter-field-label">
        {titulo} <span className="badge badge-muted">{linhas(form[chave]).length}</span>
      </label>
      <textarea
        id={`ranking-${chave}`}
        className="formatter-select escala-textarea"
        value={form[chave]}
        onChange={(e) => alterar(chave, e.target.value)}
        spellCheck={false}
      />
      <div className="formatter-field-sample">{ajuda}</div>
    </div>
  );

  const statusDaChave = (tem: boolean | undefined) => (
    <span className={`ranking-chave ${tem ? 'ok' : 'falta'}`}>{tem === undefined ? '…' : tem ? 'chave instalada' : 'sem chave'}</span>
  );

  return (
    <div className="formatter-card">
      <div className="formatter-card-header">
        <h2 className="formatter-card-title">
          <Settings2 size={20} />
          Configuração do ranking
        </h2>
        <div className="formatter-actions-buttons escala-acoes">
          <input ref={arquivoRef} type="file" accept=".json,application/json" onChange={importar} style={{ display: 'none' }} />
          <button type="button" className="btn btn-secondary" onClick={() => arquivoRef.current?.click()}>
            <Upload size={16} />
            Importar config.json
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportar} disabled={!config}>
            <FileDown size={16} />
            Exportar
          </button>
        </div>
      </div>

      <div className="ranking-metas">
        {(['clt', 'estagio'] as const).map((grupo) => (
          <fieldset key={grupo} className="ranking-grupo">
            <legend>{grupo === 'clt' ? 'Metas CLT' : 'Metas Estágio'}</legend>
            {CAMPOS.map(({ chave, titulo }) => (
              <label key={chave} className="ranking-campo">
                <span>{titulo}</span>
                <input
                  className="formatter-select"
                  inputMode="decimal"
                  value={form.metas[grupo][chave]}
                  onChange={(e) => alterarMeta(grupo, chave, e.target.value)}
                />
              </label>
            ))}
          </fieldset>
        ))}
        <fieldset className="ranking-grupo">
          <legend>Geral</legend>
          <label className="ranking-campo">
            <span>Meta geral</span>
            <input className="formatter-select" inputMode="decimal" value={form.meta_geral} onChange={(e) => alterar('meta_geral', e.target.value)} />
          </label>
          <label className="ranking-campo">
            <span>Emoji do destaque (≥ 133%)</span>
            <input className="formatter-select" value={form.emoji_destaque} onChange={(e) => alterar('emoji_destaque', e.target.value)} />
          </label>
          <div className="ranking-campo">
            <span>
              <Bot size={14} /> Comentários por IA
            </span>
            <label className="ranking-ia">
              <input type="checkbox" checked={form.usar_chatgpt} onChange={(e) => alterar('usar_chatgpt', e.target.checked)} />
              Usar o ChatGPT {statusDaChave(statusIa?.chatgpt.chave)}
            </label>
            <label className="ranking-ia">
              <input type="checkbox" checked={form.usar_claude} onChange={(e) => alterar('usar_claude', e.target.checked)} />
              Usar o Claude (reserva) {statusDaChave(statusIa?.claude.chave)}
            </label>
          </div>
        </fieldset>
      </div>

      <div className="ranking-listas">
        {lista({
          chave: 'funcionarios_ativos',
          titulo: 'Operadores ativos (Argus)',
          ajuda: form.argus_em
            ? `Atualizada sozinha pela Argus a cada ranking (última: ${new Date(form.argus_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}). Só é usada se a Argus não responder.`
            : 'Vem da Argus no próximo ranking. Até lá, vale esta lista (a do config.json).',
        })}
        {lista({ chave: 'incluir_sempre', titulo: 'Incluir sempre', ajuda: 'Entram mesmo sem estar ativos na Argus (nome como na esteira).' })}
        {lista({ chave: 'vendedores_clt', titulo: 'Vendedores CLT', ajuda: 'Um por linha. Quem não está aqui usa as metas de estágio.' })}
        {lista({ chave: 'supervisores_clt', titulo: 'Supervisores CLT', ajuda: 'Um por linha.' })}
        {lista({ chave: 'feriados', titulo: 'Feriados', ajuda: 'Um por linha, no formato AAAA-MM-DD.' })}
        <div className="formatter-mapping-field mapped">
          <label htmlFor="ranking-renomear" className="formatter-field-label">
            Renomear supervisores <span className="badge badge-muted">{linhas(form.renomear).length}</span>
          </label>
          <textarea
            id="ranking-renomear"
            className="formatter-select escala-textarea"
            value={form.renomear}
            onChange={(e) => alterar('renomear', e.target.value)}
            spellCheck={false}
          />
          <div className="formatter-field-sample">Um por linha: COMO VEM NA ESTEIRA = COMO APARECE NO RANKING.</div>
        </div>
        <div className="formatter-mapping-field mapped">
          <label htmlFor="ranking-vinculos" className="formatter-field-label">
            Ligações de nomes (Argus) <span className="badge badge-muted">{linhas(form.vinculos).length}</span>
          </label>
          <textarea
            id="ranking-vinculos"
            className="formatter-select escala-textarea"
            value={form.vinculos}
            onChange={(e) => alterar('vinculos', e.target.value)}
            spellCheck={false}
          />
          <div className="formatter-field-sample">
            Um por linha: NOME NA ESTEIRA = NOME NA ARGUS. Com o lado direito vazio, a pessoa não é ligada automaticamente.
            Preenchidas pela conferência depois de gerar.
          </div>
        </div>
      </div>

      {erro && (
        <div className="escala-aviso" role="alert">
          <AlertTriangle size={16} />
          {erro}
        </div>
      )}

      <div className="formatter-actions-buttons escala-acoes ranking-salvar">
        <button type="button" className="btn btn-primary" onClick={() => salvar(doFormulario(form), 'tela')} disabled={salvando}>
          <Save size={16} />
          {salvando ? 'Salvando...' : 'Salvar configuração'}
        </button>
      </div>
      <p className="ura-ajuda">
        As chaves das IAs ficam só no servidor (OPENAI_API_KEY e ANTHROPIC_API_KEY). Para tirar uma IA de vez, apague a chave
        do servidor ou desmarque aqui. Sem nenhuma, os comentários saem das frases prontas.
      </p>
    </div>
  );
};
