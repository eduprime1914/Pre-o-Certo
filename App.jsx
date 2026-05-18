import React, { useState, useEffect, useRef, useCallback } from "react";

/* ─── Config ──────────────────────────────────────────────────── */
const SUPA_URL = "https://tvtdsgowyfzhiwynzifs.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dGRzZ293eWZ6aGl3eW56aWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2ODczNDUsImV4cCI6MjA5MzI2MzM0NX0.5jazFARzWPnpQUHp95PsXy3vMjYIwKtEa7h_bTwDEs8";
const H = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" };
const ADMIN_SENHA = "precocerto2025"; // ← troque para sua senha

/* ─── API Supabase ────────────────────────────────────────────── */
async function buscarPrecos(query) {
  const res = await fetch(`${SUPA_URL}/rest/v1/precos?produto=ilike.*${encodeURIComponent(query)}*&order=preco.asc`, { headers: H });
  if (!res.ok) throw new Error("Erro ao buscar");
  return res.json();
}
async function buscarRecentes() {
  const res = await fetch(`${SUPA_URL}/rest/v1/precos?order=atualizado_em.desc&limit=8`, { headers: H });
  if (!res.ok) return [];
  return res.json();
}
async function salvarPreco(entry) {
  const res = await fetch(`${SUPA_URL}/rest/v1/precos`, {
    method: "POST",
    headers: { ...H, Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify({ ...entry, atualizado_em: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(await res.text());
}
async function contarStats() {
  const res = await fetch(`${SUPA_URL}/rest/v1/precos?select=id,loja`, { headers: H });
  if (!res.ok) return { total: 0, lojas: 0 };
  const data = await res.json();
  return { total: data.length, lojas: new Set(data.map(x => x.loja)).size };
}

/* ─── Claude API ──────────────────────────────────────────────── */
async function extrairComIA(conteudo, tipo, nome) {
  const isImg = tipo.startsWith("image/");
  const prompt = `Extraia TODOS os produtos e preços deste arquivo de supermercado. Responda APENAS JSON sem markdown:
{"loja":"nome da loja ou null","produtos":[{"nome":"produto","preco":0.00,"unidade":"kg/un/L"}]}
Arquivo: ${nome}`;
  const content = isImg
    ? [{ type: "image", source: { type: "base64", media_type: tipo, data: conteudo } }, { type: "text", text: prompt }]
    : [{ type: "text", text: prompt + "\n\nConteúdo:\n" + conteudo }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 3000, messages: [{ role: "user", content }] }),
  });
  const data = await res.json();
  const txt = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(txt.replace(/```json|```/g, "").trim());
}

/* ─── Helpers ─────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return "";
  const d = (Date.now() - new Date(ts)) / 1000;
  if (d < 60) return "agora";
  if (d < 3600) return `${Math.floor(d / 60)}min`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}
function fresco(ts) {
  if (!ts) return false;
  return (Date.now() - new Date(ts)) / (1000 * 60 * 60 * 24) <= 7;
}
function cap(s) {
  return s.trim().toLowerCase().replace(/(?:^|\s)\S/g, l => l.toUpperCase());
}
function lerArquivo(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = e => res({ conteudo: e.target.result.split(",")[1], tipo: file.type, nome: file.name });
      reader.readAsDataURL(file);
    } else {
      reader.onload = e => res({ conteudo: e.target.result, tipo: "text/plain", nome: file.name });
      reader.readAsText(file, "UTF-8");
    }
    reader.onerror = rej;
  });
}

/* ══════════════════════════════════════════════════════════════
   TELA PITCH — apresentação para mercados
══════════════════════════════════════════════════════════════ */
function TelaPitch({ onEntrar }) {
  const [slide, setSlide] = useState(0);
  const slides = [
    { icon: "🛒", titulo: "PrecoCerto", sub: "Itapira · SP", desc: "O app gratuito onde moradores de Itapira encontram os melhores preços da cidade.", destaque: null },
    { icon: "📊", titulo: "O problema", sub: "Todo mundo quer economizar", desc: "Mas os moradores não sabem onde o produto está mais barato sem visitar cada mercado.", destaque: "Tempo perdido. Dinheiro desperdiçado." },
    { icon: "⚡", titulo: "A solução", sub: "Busca instantânea", desc: "O cliente pesquisa o produto e vê onde está mais barato em Itapira — em segundos, no celular.", destaque: null },
    { icon: "📁", titulo: "Como funciona", sub: "Simples para o mercado", desc: "Manda a lista de preços por email ou WhatsApp — no formato que já usa. O sistema lê automaticamente.", destaque: "Planilha · Foto · PDF · Texto — qualquer formato" },
    { icon: "🎯", titulo: "O que vocês ganham", sub: "Visibilidade gratuita", desc: "Seu mercado aparece para todos os moradores que estão decidindo onde comprar hoje.", destaque: "Sem custo · Sem contrato · Sem burocracia" },
    { icon: "🤝", titulo: "Vamos começar?", sub: "Me manda a lista e aparece em 24h", desc: "Só preciso da sua lista de preços. Pode ser foto do folheto, planilha ou texto no WhatsApp.", destaque: "Eduardo de Souza · (19) seu número" },
  ];
  const atual = slides[slide];

  return (
    <div style={pt.root}>
      <div style={pt.card}>
        <div style={pt.slideIcon}>{atual.icon}</div>
        <div style={pt.titulo}>{atual.titulo}</div>
        <div style={pt.sub}>{atual.sub}</div>
        <div style={pt.desc}>{atual.desc}</div>
        {atual.destaque && <div style={pt.destaque}>{atual.destaque}</div>}
        <div style={pt.dots}>
          {slides.map((_, i) => (
            <div key={i} style={{ ...pt.dot, ...(i === slide ? pt.dotOn : {}) }} onClick={() => setSlide(i)} />
          ))}
        </div>
        <div style={pt.btns}>
          {slide > 0 && <button style={pt.btnSec} onClick={() => setSlide(s => s - 1)}>← Voltar</button>}
          {slide < slides.length - 1
            ? <button style={pt.btn} onClick={() => setSlide(s => s + 1)}>Próximo →</button>
            : <button style={pt.btn} onClick={onEntrar}>Ver o app ao vivo →</button>
          }
        </div>
      </div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APP DO CLIENTE — busca + cadastro colaborativo
══════════════════════════════════════════════════════════════ */
function AppCliente() {
  const [aba, setAba] = useState("buscar");
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [recentes, setRecentes] = useState([]);
  const [stats, setStats] = useState({ total: 0, lojas: 0 });
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [form, setForm] = useState({ produto: "", loja: "", bairro: "", preco: "" });
  const [formMsg, setFormMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    buscarRecentes().then(setRecentes).catch(() => {});
    contarStats().then(setStats).catch(() => {});
  }, []);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setBuscou(false); setResultados([]);
    try {
      const data = await buscarPrecos(query.trim());
      setResultados(data); setBuscou(true);
    } catch { alert("Erro ao buscar. Verifique sua conexão."); }
    setLoading(false);
  }, [query]);

  const handleCadastro = useCallback(async () => {
    const { produto, loja, preco } = form;
    if (!produto.trim() || !loja.trim() || !preco) {
      setFormMsg({ ok: false, txt: "Preencha produto, loja e preço." }); return;
    }
    const precoNum = parseFloat(String(preco).replace(",", "."));
    if (isNaN(precoNum) || precoNum <= 0) {
      setFormMsg({ ok: false, txt: "Preço inválido." }); return;
    }
    setSalvando(true); setFormMsg(null);
    try {
      await salvarPreco({ produto: cap(produto), loja: cap(loja), bairro: form.bairro ? cap(form.bairro) : "-", preco: precoNum });
      setForm({ produto: "", loja: "", bairro: "", preco: "" });
      setFormMsg({ ok: true, txt: "✓ Obrigado! Preço cadastrado com sucesso." });
      buscarRecentes().then(setRecentes);
      contarStats().then(setStats);
      setTimeout(() => setFormMsg(null), 3500);
    } catch (e) { setFormMsg({ ok: false, txt: "Erro ao salvar." }); }
    setSalvando(false);
  }, [form]);

  const best = resultados[0];
  const worst = resultados[resultados.length - 1];
  const saving = best && worst && resultados.length > 1 ? (worst.preco - best.preco).toFixed(2) : null;

  return (
    <div style={c.root}>
      <header style={c.header}>
        <div style={c.brand}>
          <div style={c.brandMark}>P</div>
          <div>
            <div style={c.brandName}>PrecoCerto</div>
            <div style={c.brandCity}>Itapira · SP</div>
          </div>
        </div>
        {stats.total > 0 && (
          <div style={c.chip}>{stats.total} preços · {stats.lojas} lojas</div>
        )}
      </header>

      <main style={c.main}>

        {/* BUSCAR */}
        {aba === "buscar" && (
          <div style={c.sec}>
            <div style={c.searchRow}>
              <input style={c.searchInput}
                placeholder="Ex: Arroz Camil 5kg, Leite Ninho..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch()}
                autoFocus />
              <button style={c.searchBtn} onClick={doSearch} disabled={loading}>
                {loading ? <span style={c.spin} /> : "🔍"}
              </button>
            </div>

            {buscou && resultados.length === 0 && (
              <div style={c.empty}>
                <div style={c.emptyIcon}>🤷</div>
                <div style={c.emptyTxt}>Nenhum preço encontrado para "{query}"</div>
                <div style={c.emptySub}>Sabe o preço? Cadastre e ajude a comunidade!</div>
                <button style={c.emptyBtn} onClick={() => { setForm(f => ({ ...f, produto: query })); setAba("cadastrar"); }}>
                  + Cadastrar preço
                </button>
              </div>
            )}

            {buscou && resultados.length > 0 && (
              <>
                <div style={c.resultHeader}>
                  <span style={c.resultCount}>{resultados.length} resultado{resultados.length !== 1 ? "s" : ""}</span>
                  {saving > 0 && <span style={c.savePill}>💰 economize até R$ {saving}</span>}
                </div>
                {resultados.map((r, i) => (
                  <div key={r.id} style={{ ...c.card, ...(i === 0 ? c.cardBest : {}) }}>
                    <div style={c.cardRank}>
                      {i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                    </div>
                    <div style={c.cardBody}>
                      <div style={{ ...c.cardProd, ...(i === 0 ? { color: "#fff" } : {}) }}>{r.produto}</div>
                      <div style={c.cardMeta}>
                        <span style={{ ...c.cardLoja, ...(i === 0 ? { color: "#aaa" } : {}) }}>{r.loja}</span>
                        {r.bairro && r.bairro !== "-" && <span style={c.cardBairro}> · {r.bairro}</span>}
                      </div>
                      <div style={c.cardAge}>
                        {fresco(r.atualizado_em)
                          ? <span style={{ color: "#4ade80" }}>✓ atualizado {timeAgo(r.atualizado_em)} atrás</span>
                          : <span style={{ color: "#f59e0b" }}>⚠️ pode estar desatualizado</span>}
                      </div>
                    </div>
                    <div style={c.cardRight}>
                      <span style={{ ...c.cardPreco, ...(i === 0 ? { color: "#fbbf24" } : {}) }}>
                        R${Number(r.preco).toFixed(2).replace(".", ",")}
                      </span>
                      {i === 0 && <span style={c.menorTag}>MENOR</span>}
                    </div>
                  </div>
                ))}
                <button style={c.addMoreBtn} onClick={() => { setForm(f => ({ ...f, produto: query })); setAba("cadastrar"); }}>
                  + Cadastrar novo preço para este produto
                </button>
              </>
            )}

            {!buscou && (
              <>
                {stats.total > 0 && (
                  <div style={c.statsRow}>
                    <div style={c.statBox}>
                      <span style={c.statN}>{stats.total}</span>
                      <span style={c.statL}>preços</span>
                    </div>
                    <div style={c.statBox}>
                      <span style={c.statN}>{stats.lojas}</span>
                      <span style={c.statL}>lojas</span>
                    </div>
                  </div>
                )}
                {recentes.length > 0 && (
                  <div style={c.recentWrap}>
                    <div style={c.recentLabel}>ATUALIZADOS RECENTEMENTE</div>
                    {recentes.map((r, i) => (
                      <div key={i} style={c.recentRow}
                        onClick={() => { setQuery(r.produto); setTimeout(doSearch, 80); }}>
                        <div style={c.recentLeft}>
                          <div style={c.recentProd}>{r.produto}</div>
                          <div style={c.recentLoja}>{r.loja}{r.bairro && r.bairro !== "-" ? ` · ${r.bairro}` : ""}</div>
                        </div>
                        <div style={c.recentRight}>
                          <div style={c.recentPreco}>R$ {Number(r.preco).toFixed(2).replace(".", ",")}</div>
                          <div style={c.recentAge}>{timeAgo(r.atualizado_em)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {recentes.length === 0 && (
                  <div style={c.welcome}>
                    <div style={c.welcomeEmoji}>🛒</div>
                    <div style={c.welcomeTxt}>Encontre os melhores preços de Itapira em segundos.</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* CADASTRAR */}
        {aba === "cadastrar" && (
          <div style={c.sec}>
            <div style={c.formTitulo}>Cadastrar Preço</div>
            <div style={c.formSub}>Viu um preço na loja? Compartilhe com a comunidade de Itapira. 📍</div>
            <label style={c.label}>PRODUTO *</label>
            <input style={c.input} placeholder="Ex: Arroz Camil 5kg"
              value={form.produto} onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} />
            <label style={c.label}>LOJA *</label>
            <input style={c.input} placeholder="Ex: Delalana, Mercadão..."
              value={form.loja} onChange={e => setForm(f => ({ ...f, loja: e.target.value }))} />
            <label style={c.label}>BAIRRO</label>
            <input style={c.input} placeholder="Ex: Centro, Vila Nova..."
              value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
            <label style={c.label}>PREÇO (R$) *</label>
            <input style={{ ...c.input, fontFamily: "monospace", fontSize: 22, fontWeight: 700 }}
              placeholder="0,00" type="number" step="0.01" min="0"
              value={form.preco} onChange={e => setForm(f => ({ ...f, preco: e.target.value }))} />
            {formMsg && (
              <div style={{ ...c.msg, ...(formMsg.ok ? c.msgOk : c.msgErr) }}>{formMsg.txt}</div>
            )}
            <button style={{ ...c.submitBtn, opacity: salvando ? 0.6 : 1 }}
              onClick={handleCadastro} disabled={salvando}>
              {salvando ? "Salvando..." : "✓ Cadastrar Preço"}
            </button>
          </div>
        )}
      </main>

      <nav style={c.nav}>
        {[
          { id: "buscar", icon: "🔍", label: "Buscar" },
          { id: "cadastrar", icon: "➕", label: "Cadastrar" },
        ].map(({ id, icon, label }) => (
          <button key={id} style={{ ...c.navBtn, ...(aba === id ? c.navActive : {}) }}
            onClick={() => setAba(id)}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
        body { background:#080c14; }
        input:focus { outline:none; border-color:#6366f1 !important; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAINEL ADMIN — importação protegida por senha
══════════════════════════════════════════════════════════════ */
function PainelAdmin({ onSair }) {
  const [autenticado, setAutenticado] = useState(false);
  const [senhaInput, setSenhaInput] = useState("");
  const [senhaErro, setSenhaErro] = useState(false);
  const [modoImport, setModoImport] = useState("arquivo");
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [textoImport, setTextoImport] = useState("");
  const [historico, setHistorico] = useState([]);
  const fileRef = useRef();

  const entrar = () => {
    if (senhaInput === ADMIN_SENHA) { setAutenticado(true); setSenhaErro(false); }
    else { setSenhaErro(true); setSenhaInput(""); }
  };

  const processarArquivo = useCallback(async (file) => {
    setImportando(true); setImportResult(null);
    try {
      const { conteudo, tipo, nome } = await lerArquivo(file);
      const dados = await extrairComIA(conteudo, tipo, nome);
      if (!dados.produtos?.length) throw new Error("Nenhum produto encontrado.");
      const loja = dados.loja || "Loja Importada";
      let salvos = 0;
      for (const p of dados.produtos) {
        if (!p.nome || !p.preco) continue;
        try {
          await salvarPreco({ produto: cap(p.nome), loja: cap(loja), bairro: "-", preco: parseFloat(p.preco) });
          salvos++;
        } catch {}
      }
      const result = { loja, total: dados.produtos.length, salvos, arquivo: nome, hora: new Date().toLocaleTimeString("pt-BR") };
      setImportResult(result);
      setHistorico(h => [result, ...h].slice(0, 10));
    } catch (e) { setImportResult({ erro: e.message }); }
    setImportando(false);
  }, []);

  const processarTexto = useCallback(async () => {
    if (!textoImport.trim()) return;
    setImportando(true); setImportResult(null);
    try {
      const dados = await extrairComIA(textoImport, "text/plain", "lista.txt");
      if (!dados.produtos?.length) throw new Error("Nenhum produto encontrado.");
      const loja = dados.loja || "Loja Importada";
      let salvos = 0;
      for (const p of dados.produtos) {
        if (!p.nome || !p.preco) continue;
        try {
          await salvarPreco({ produto: cap(p.nome), loja: cap(loja), bairro: "-", preco: parseFloat(p.preco) });
          salvos++;
        } catch {}
      }
      const result = { loja, total: dados.produtos.length, salvos, arquivo: "Texto colado", hora: new Date().toLocaleTimeString("pt-BR") };
      setImportResult(result);
      setHistorico(h => [result, ...h].slice(0, 10));
      setTextoImport("");
    } catch (e) { setImportResult({ erro: e.message }); }
    setImportando(false);
  }, [textoImport]);

  // Tela de login
  if (!autenticado) return (
    <div style={a.loginRoot}>
      <div style={a.loginCard}>
        <div style={a.loginIcon}>🔐</div>
        <div style={a.loginTitulo}>Painel Administrativo</div>
        <div style={a.loginSub}>PrecoCerto · Itapira</div>
        <input style={{ ...a.loginInput, ...(senhaErro ? { borderColor: "#f87171" } : {}) }}
          type="password" placeholder="Senha de acesso"
          value={senhaInput}
          onChange={e => { setSenhaInput(e.target.value); setSenhaErro(false); }}
          onKeyDown={e => e.key === "Enter" && entrar()} />
        {senhaErro && <div style={a.loginErro}>Senha incorreta</div>}
        <button style={a.loginBtn} onClick={entrar}>Entrar →</button>
        <button style={a.loginVoltarBtn} onClick={onSair}>← Voltar ao app</button>
      </div>
    </div>
  );

  // Painel principal
  return (
    <div style={a.root}>
      <header style={a.header}>
        <div style={a.headerLeft}>
          <div style={a.headerIcon}>⚙️</div>
          <div>
            <div style={a.headerTitulo}>Painel Admin</div>
            <div style={a.headerSub}>Importar preços dos mercados</div>
          </div>
        </div>
        <button style={a.sairBtn} onClick={onSair}>← Sair</button>
      </header>

      <div style={a.main}>
        {/* Abas de modo */}
        <div style={a.abas}>
          <button style={{ ...a.aba, ...(modoImport === "arquivo" ? a.abaOn : {}) }}
            onClick={() => { setModoImport("arquivo"); setImportResult(null); }}>
            📁 Arquivo
          </button>
          <button style={{ ...a.aba, ...(modoImport === "texto" ? a.abaOn : {}) }}
            onClick={() => { setModoImport("texto"); setImportResult(null); }}>
            📋 Colar texto
          </button>
        </div>

        {/* Upload arquivo */}
        {modoImport === "arquivo" && !importando && !importResult && (
          <div style={a.dropzone} onClick={() => fileRef.current.click()}
            onDrop={e => { e.preventDefault(); processarArquivo(e.dataTransfer.files[0]); }}
            onDragOver={e => e.preventDefault()}>
            <input ref={fileRef} type="file"
              accept=".xlsx,.xls,.csv,.txt,.pdf,.jpg,.jpeg,.png,.webp"
              style={{ display: "none" }}
              onChange={e => e.target.files[0] && processarArquivo(e.target.files[0])} />
            <div style={a.dropIcon}>⬆</div>
            <div style={a.dropTitulo}>Arraste o arquivo aqui</div>
            <div style={a.dropSub}>ou clique para selecionar</div>
            <div style={a.formatos}>
              {["Excel", "CSV", "PDF", "Foto", "TXT"].map(f => (
                <span key={f} style={a.formatoTag}>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Colar texto */}
        {modoImport === "texto" && !importando && !importResult && (
          <div>
            <div style={a.textoLabel}>Cole aqui a lista enviada pelo mercado:</div>
            <textarea style={a.textarea}
              placeholder={"Arroz Camil 5kg - R$ 24,90\nFeijão Carioca 1kg R$ 8,50\nÓleo de Soja 900ml: 5,99\n..."}
              value={textoImport}
              onChange={e => setTextoImport(e.target.value)} />
            <button style={{ ...a.processarBtn, opacity: textoImport.trim() ? 1 : 0.4 }}
              onClick={processarTexto} disabled={!textoImport.trim()}>
              Extrair e salvar preços →
            </button>
          </div>
        )}

        {/* Processando */}
        {importando && (
          <div style={a.loadingWrap}>
            <div style={a.bigSpin} />
            <div style={a.loadingTxt}>IA lendo o arquivo...</div>
            <div style={a.loadingSub}>Extraindo produtos e preços automaticamente</div>
          </div>
        )}

        {/* Resultado sucesso */}
        {importResult && !importResult.erro && (
          <div style={a.resultCard}>
            <div style={a.resultIcon}>✅</div>
            <div style={a.resultTitulo}>Importação concluída!</div>
            <div style={a.resultStats}>
              <div style={a.resultStat}>
                <span style={a.resultStatN}>{importResult.salvos}</span>
                <span style={a.resultStatL}>salvos</span>
              </div>
              <div style={a.resultStatDiv} />
              <div style={a.resultStat}>
                <span style={a.resultStatN}>{importResult.total}</span>
                <span style={a.resultStatL}>encontrados</span>
              </div>
            </div>
            <div style={a.resultInfo}>🏪 {importResult.loja}</div>
            <div style={a.resultInfo}>📎 {importResult.arquivo}</div>
            <div style={a.resultInfo}>🕐 {importResult.hora}</div>
            <button style={a.novoBtn}
              onClick={() => { setImportResult(null); setTextoImport(""); }}>
              Importar outro arquivo
            </button>
          </div>
        )}

        {/* Resultado erro */}
        {importResult?.erro && (
          <div style={a.erroCard}>
            <div style={a.erroIcon}>⚠️</div>
            <div style={a.erroTxt}>{importResult.erro}</div>
            <button style={a.novoBtn} onClick={() => setImportResult(null)}>Tentar novamente</button>
          </div>
        )}

        {/* Histórico */}
        {historico.length > 0 && (
          <div style={a.historicoWrap}>
            <div style={a.historicoTitulo}>HISTÓRICO DESTA SESSÃO</div>
            {historico.map((h, i) => (
              <div key={i} style={a.historicoRow}>
                <div style={a.historicoLeft}>
                  <div style={a.historicoLoja}>{h.loja}</div>
                  <div style={a.historicoArquivo}>{h.arquivo} · {h.hora}</div>
                </div>
                <div style={a.historicoBadge}>{h.salvos} produtos</div>
              </div>
            ))}
          </div>
        )}

        {/* Dica */}
        <div style={a.dica}>
          <div style={a.dicaTitulo}>💡 Como usar na reunião com o mercado</div>
          <div style={a.dicaTxt}>Peça para o dono te mandar qualquer lista de preços — foto, planilha, PDF ou texto no WhatsApp. Importe aqui na frente dele e mostre os produtos aparecendo no app em segundos.</div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#080c14; }
        input:focus,textarea:focus { outline:none; }
        input[type=password]:focus { border-color:#6366f1 !important; }
        @keyframes spin2 { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT — roteador entre telas
══════════════════════════════════════════════════════════════ */
export default function Root() {
  const [tela, setTela] = useState("pitch"); // pitch | cliente | admin

  // Detecta URL /admin
  useEffect(() => {
    if (window.location.hash === "#admin") setTela("admin");
  }, []);

  if (tela === "pitch") return <TelaPitch onEntrar={() => setTela("cliente")} />;
  if (tela === "admin") return <PainelAdmin onSair={() => { setTela("cliente"); window.location.hash = ""; }} />;
  return (
    <div>
      <AppCliente />
      {/* Botão secreto no rodapé — só você sabe que existe */}
      <div style={{ textAlign: "center", padding: "8px 0 80px" }}>
        <span style={{ fontSize: 10, color: "#1e2d45", cursor: "pointer", userSelect: "none" }}
          onClick={() => setTela("admin")}>
          ·
        </span>
      </div>
    </div>
  );
}

/* ─── Estilos App Cliente ─────────────────────────────────────── */
const c = {
  root: { minHeight: "100vh", background: "#080c14", fontFamily: "'Sora',sans-serif", color: "#e2e8f0", paddingBottom: 72 },
  header: { background: "#0d1117", borderBottom: "1px solid #1e2d45", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandMark: { width: 38, height: 38, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, color: "#fff" },
  brandName: { fontWeight: 800, fontSize: 17, color: "#fff" },
  brandCity: { fontSize: 11, color: "#4b5563", fontWeight: 600 },
  chip: { background: "#1e2d45", borderRadius: 20, padding: "5px 12px", fontSize: 11, color: "#94a3b8", fontWeight: 600 },
  main: { maxWidth: 480, margin: "0 auto" },
  sec: { padding: "20px 16px", animation: "fadeUp .3s ease" },
  searchRow: { display: "flex", marginBottom: 20 },
  searchInput: { flex: 1, background: "#111827", border: "2px solid #1e2d45", borderRight: "none", padding: "14px 16px", fontSize: 14, color: "#e2e8f0", fontFamily: "'Sora',sans-serif", borderRadius: "10px 0 0 10px" },
  searchBtn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", padding: "0 20px", fontSize: 18, cursor: "pointer", borderRadius: "0 10px 10px 0", minWidth: 56, display: "flex", alignItems: "center", justifyContent: "center" },
  spin: { width: 18, height: 18, border: "2.5px solid #ffffff44", borderTop: "2.5px solid #fff", borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" },
  empty: { textAlign: "center", padding: "48px 20px" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTxt: { fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 },
  emptySub: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  emptyBtn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora',sans-serif" },
  resultHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  resultCount: { fontSize: 11, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 },
  savePill: { background: "#1e2d45", color: "#818cf8", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700 },
  card: { background: "#111827", border: "1.5px solid #1e2d45", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 },
  cardBest: { background: "#1e1b4b", border: "1.5px solid #4338ca" },
  cardRank: { fontSize: 20, flexShrink: 0, width: 28, textAlign: "center" },
  cardBody: { flex: 1, minWidth: 0 },
  cardProd: { fontWeight: 700, fontSize: 14, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 },
  cardMeta: { display: "flex", alignItems: "center", marginBottom: 3 },
  cardLoja: { fontSize: 12, fontWeight: 600, color: "#6b7280" },
  cardBairro: { fontSize: 12, color: "#4b5563" },
  cardAge: { fontSize: 11 },
  cardRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 },
  cardPreco: { fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 18, color: "#94a3b8" },
  menorTag: { background: "#6366f1", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4 },
  addMoreBtn: { width: "100%", background: "transparent", border: "1.5px dashed #1e2d45", color: "#4b5563", padding: "12px", fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: 10, fontFamily: "'Sora',sans-serif", marginTop: 4 },
  statsRow: { display: "flex", gap: 12, marginBottom: 20 },
  statBox: { flex: 1, background: "#111827", border: "1px solid #1e2d45", borderRadius: 12, padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  statN: { fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 26, color: "#818cf8" },
  statL: { fontSize: 10, color: "#4b5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 },
  recentWrap: {},
  recentLabel: { fontSize: 10, fontWeight: 800, letterSpacing: 2, color: "#4b5563", marginBottom: 10 },
  recentRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1e2d45", cursor: "pointer" },
  recentLeft: { flex: 1, minWidth: 0, marginRight: 12 },
  recentProd: { fontSize: 13, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  recentLoja: { fontSize: 11, color: "#4b5563", marginTop: 2 },
  recentRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 },
  recentPreco: { fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 14, color: "#e2e8f0" },
  recentAge: { fontSize: 10, color: "#4b5563" },
  welcome: { textAlign: "center", padding: "48px 20px" },
  welcomeEmoji: { fontSize: 52, marginBottom: 16 },
  welcomeTxt: { fontSize: 15, color: "#6b7280", lineHeight: 1.7 },
  formTitulo: { fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 6 },
  formSub: { fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 },
  label: { display: "block", fontSize: 10, fontWeight: 800, letterSpacing: 2, color: "#4b5563", marginBottom: 6, marginTop: 16 },
  input: { width: "100%", background: "#111827", border: "1.5px solid #1e2d45", borderRadius: 10, padding: "13px 14px", fontSize: 14, color: "#e2e8f0", fontFamily: "'Sora',sans-serif" },
  msg: { borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 600, marginTop: 16 },
  msgOk: { background: "#0d1f14", border: "1px solid #166534", color: "#4ade80" },
  msgErr: { background: "#160a0a", border: "1px solid #7f1d1d", color: "#f87171" },
  submitBtn: { width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", padding: "15px", fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "'Sora',sans-serif", borderRadius: 12, marginTop: 20 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#080c14", borderTop: "1px solid #1e2d45", display: "flex", zIndex: 100 },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0 8px", background: "transparent", border: "none", color: "#4b5563", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'Sora',sans-serif" },
  navActive: { color: "#818cf8" },
};

/* ─── Estilos Admin ───────────────────────────────────────────── */
const a = {
  loginRoot: { minHeight: "100vh", background: "#080c14", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Sora',sans-serif" },
  loginCard: { width: "100%", maxWidth: 360, background: "#0d1117", border: "1px solid #1e2d45", borderRadius: 20, padding: "40px 28px", textAlign: "center" },
  loginIcon: { fontSize: 48, marginBottom: 16 },
  loginTitulo: { fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 4 },
  loginSub: { fontSize: 12, color: "#4b5563", marginBottom: 28 },
  loginInput: { width: "100%", background: "#111827", border: "1.5px solid #1e2d45", borderRadius: 10, padding: "14px 16px", fontSize: 15, color: "#e2e8f0", fontFamily: "'Sora',sans-serif", textAlign: "center", letterSpacing: 4, marginBottom: 8 },
  loginErro: { color: "#f87171", fontSize: 12, marginBottom: 12 },
  loginBtn: { width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Sora',sans-serif", marginBottom: 12 },
  loginVoltarBtn: { width: "100%", background: "transparent", border: "none", color: "#4b5563", fontSize: 13, cursor: "pointer", fontFamily: "'Sora',sans-serif" },
  root: { minHeight: "100vh", background: "#080c14", fontFamily: "'Sora',sans-serif", color: "#e2e8f0", paddingBottom: 40 },
  header: { background: "#0d1117", borderBottom: "1px solid #1e2d45", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerIcon: { fontSize: 28 },
  headerTitulo: { fontWeight: 800, fontSize: 16, color: "#fff" },
  headerSub: { fontSize: 11, color: "#4b5563" },
  sairBtn: { background: "transparent", border: "1px solid #1e2d45", color: "#6b7280", padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "'Sora',sans-serif" },
  main: { maxWidth: 560, margin: "0 auto", padding: "24px 16px" },
  abas: { display: "flex", gap: 4, background: "#111827", borderRadius: 10, padding: 4, marginBottom: 20 },
  aba: { flex: 1, background: "transparent", border: "none", padding: "10px", fontSize: 13, fontWeight: 600, color: "#6b7280", cursor: "pointer", borderRadius: 7, fontFamily: "'Sora',sans-serif" },
  abaOn: { background: "#1e2d45", color: "#e2e8f0" },
  dropzone: { border: "2px dashed #1e2d45", borderRadius: 16, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: "#0d1117", marginBottom: 20 },
  dropIcon: { fontSize: 36, color: "#6366f1", marginBottom: 12 },
  dropTitulo: { fontWeight: 700, fontSize: 18, color: "#e2e8f0", marginBottom: 8 },
  dropSub: { fontSize: 13, color: "#4b5563", marginBottom: 16 },
  formatos: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  formatoTag: { background: "#111827", border: "1px solid #1e2d45", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#6b7280", fontWeight: 600 },
  textoLabel: { fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: 600 },
  textarea: { width: "100%", height: 200, background: "#111827", border: "1.5px solid #1e2d45", borderRadius: 10, padding: "14px", fontSize: 13, color: "#e2e8f0", fontFamily: "monospace", resize: "vertical", lineHeight: 1.7, marginBottom: 16 },
  processarBtn: { width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "14px", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Sora',sans-serif" },
  loadingWrap: { textAlign: "center", padding: "48px 20px" },
  bigSpin: { width: 48, height: 48, border: "4px solid #1e2d45", borderTop: "4px solid #6366f1", borderRadius: "50%", animation: "spin2 .8s linear infinite", margin: "0 auto 20px" },
  loadingTxt: { fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 8 },
  loadingSub: { fontSize: 13, color: "#6b7280" },
  resultCard: { background: "#0d1117", border: "1px solid #166534", borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 20 },
  resultIcon: { fontSize: 48, marginBottom: 16 },
  resultTitulo: { fontWeight: 800, fontSize: 20, color: "#4ade80", marginBottom: 20 },
  resultStats: { display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 16 },
  resultStat: { display: "flex", flexDirection: "column", gap: 2 },
  resultStatN: { fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 32, color: "#818cf8" },
  resultStatL: { fontSize: 11, color: "#4b5563", fontWeight: 700, textTransform: "uppercase" },
  resultStatDiv: { width: 1, height: 40, background: "#1e2d45" },
  resultInfo: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  novoBtn: { width: "100%", background: "transparent", border: "1.5px solid #1e2d45", color: "#6b7280", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora',sans-serif", marginTop: 16 },
  erroCard: { background: "#160a0a", border: "1px solid #7f1d1d", borderRadius: 14, padding: "24px", textAlign: "center", marginBottom: 20 },
  erroIcon: { fontSize: 40, marginBottom: 12 },
  erroTxt: { color: "#f87171", fontSize: 14, marginBottom: 16 },
  historicoWrap: { background: "#0d1117", border: "1px solid #1e2d45", borderRadius: 14, padding: "16px", marginBottom: 20 },
  historicoTitulo: { fontSize: 10, fontWeight: 800, letterSpacing: 2, color: "#4b5563", marginBottom: 12 },
  historicoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e2d45" },
  historicoLeft: {},
  historicoLoja: { fontSize: 13, fontWeight: 700, color: "#e2e8f0" },
  historicoArquivo: { fontSize: 11, color: "#4b5563", marginTop: 2 },
  historicoBadge: { background: "#1e2d45", color: "#818cf8", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700 },
  dica: { background: "#0d1117", border: "1px solid #1e2d45", borderRadius: 14, padding: "20px" },
  dicaTitulo: { fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginBottom: 8 },
  dicaTxt: { fontSize: 13, color: "#6b7280", lineHeight: 1.6 },
};

/* ─── Estilos Pitch ───────────────────────────────────────────── */
const pt = {
  root: { minHeight: "100vh", background: "linear-gradient(135deg,#080c14,#0f1623)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Sora',sans-serif" },
  card: { maxWidth: 440, width: "100%", background: "#0d1117", border: "1px solid #1e2d45", borderRadius: 24, padding: "48px 32px 36px", textAlign: "center", boxShadow: "0 40px 100px #00000088", animation: "fadeUp .4s ease" },
  slideIcon: { fontSize: 64, marginBottom: 24 },
  titulo: { fontWeight: 800, fontSize: 30, color: "#fff", letterSpacing: "-0.5px", marginBottom: 8 },
  sub: { fontWeight: 600, fontSize: 13, color: "#6366f1", marginBottom: 20, letterSpacing: 0.5, textTransform: "uppercase" },
  desc: { fontSize: 15, color: "#94a3b8", lineHeight: 1.8, marginBottom: 24 },
  destaque: { background: "#1e1b4b", border: "1px solid #4338ca", borderRadius: 12, padding: "12px 20px", fontSize: 13, color: "#818cf8", fontWeight: 700, marginBottom: 24 },
  dots: { display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#1e2d45", cursor: "pointer", transition: "all .2s" },
  dotOn: { background: "#6366f1", transform: "scale(1.4)" },
  btns: { display: "flex", gap: 10, justifyContent: "center" },
  btn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "#fff", padding: "14px 28px", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Sora',sans-serif" },
  btnSec: { background: "transparent", border: "1.5px solid #1e2d45", color: "#6b7280", padding: "14px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Sora',sans-serif" },
};
