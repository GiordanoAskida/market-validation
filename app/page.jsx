"use client";
import { useState, useRef, useEffect } from "react";

async function streamFromRoute(url, body, onChunk) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text);
  }

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") continue;
      try {
        const d = JSON.parse(raw);
        if (d.type === "content_block_delta" && d.delta?.type === "text_delta" && d.delta?.text) {
          onChunk(d.delta.text);
        }
      } catch {}
    }
  }
  if (buffer.startsWith("data: ")) {
    const raw = buffer.slice(6).trim();
    if (raw && raw !== "[DONE]") {
      try {
        const d = JSON.parse(raw);
        if (d.type === "content_block_delta" && d.delta?.type === "text_delta" && d.delta?.text) {
          onChunk(d.delta.text);
        }
      } catch {}
    }
  }
}

function parseAnalysis(text) {
  const get = (label) => {
    const re = new RegExp(`${label}:[\\s]*([\\s\\S]+?)(?=\\n[A-Z_]+:|$)`, "i");
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  const getList = (label) => {
    const re = new RegExp(`${label}:[\\s]*\\n((?:[-•]\\s*.+\\n?)+)`, "i");
    const m = text.match(re);
    if (!m) return [];
    return m[1].split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  };
  const getBlock = (label) => {
    const re = new RegExp(`${label}:[\\s]*\\n((?:[-•]\\s*.+\\n?)+)`, "i");
    const m = text.match(re);
    if (!m) return [];
    return m[1].split("\n").map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  };

  return {
    semaforo: get("SEMAFORO_MERCATO")?.trim().toUpperCase().replace(/[^A-Z\-]/g, ""),
    motivazione: get("MOTIVAZIONE_SEMAFORO"),
    icpPrimario: getBlock("ICP_PRIMARIO"),
    icpSecondario: getBlock("ICP_SECONDARIO"),
    tam: get("TAM"),
    sam: get("SAM"),
    som: get("SOM"),
    competitorDiretti: getList("COMPETITOR_DIRETTI"),
    competitorIndiretti: getList("COMPETITOR_INDIRETTI"),
    vantaggioCompetitivo: get("VANTAGGIO_COMPETITIVO"),
    domandaReale: getList("DOMANDA_REALE"),
    wtp: getBlock("WILLINGNESS_TO_PAY"),
    canali: getList("CANALI_ACQUISIZIONE"),
    rischi: getList("RISCHI_MERCATO"),
    validazioneRapida: get("VALIDAZIONE_RAPIDA"),
  };
}

const SEMAFORO_CONFIG = {
  "GO": { color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", emoji: "🟢" },
  "ATTENZIONE": { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", emoji: "🟡" },
  "NO-GO": { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", emoji: "🔴" },
};

const Section = ({ title, accent, children }) => (
  <div style={{ marginBottom: "28px" }}>
    <div style={{ fontSize: "9px", fontFamily: "monospace", color: accent, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "12px" }}>{title}</div>
    {children}
  </div>
);

const BulletItem = ({ text, accent }) => (
  <div style={{ display: "flex", gap: "10px", marginBottom: "6px", alignItems: "flex-start" }}>
    <span style={{ color: accent, fontSize: "10px", marginTop: "4px", flexShrink: 0 }}>▸</span>
    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: "1.6" }}>{text}</span>
  </div>
);

const CompetitorItem = ({ text }) => {
  const parts = text.split("|");
  const name = parts[0]?.trim();
  const price = parts[1]?.trim();
  const gap = parts[2]?.trim();
  return (
    <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: gap ? "6px" : 0, gap: "12px" }}>
        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{name}</span>
        {price && <span style={{ fontSize: "11px", color: "#f59e0b", fontFamily: "monospace", background: "rgba(245,158,11,0.08)", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(245,158,11,0.2)", whiteSpace: "nowrap" }}>{price}</span>}
      </div>
      {gap && <div style={{ fontSize: "12px", color: "rgba(99,202,183,0.7)", lineHeight: "1.5" }}>{gap}</div>}
    </div>
  );
};

const ICPItem = ({ text }) => {
  const colonIdx = text.indexOf(":");
  const label = colonIdx > -1 ? text.slice(0, colonIdx).trim() : null;
  const value = colonIdx > -1 ? text.slice(colonIdx + 1).trim() : text;
  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "8px", alignItems: "flex-start" }}>
      {label && <span style={{ fontSize: "10px", fontFamily: "monospace", color: "rgba(168,85,247,0.6)", background: "rgba(168,85,247,0.08)", padding: "2px 8px", borderRadius: "4px", flexShrink: 0, marginTop: "2px", whiteSpace: "nowrap" }}>{label}</span>}
      <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: "1.6" }}>{value}</span>
    </div>
  );
};

function Chat({ idea, analysis }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [currentReply, setCurrentReply] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, currentReply]);

  const send = async () => {
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");
    setStreaming(true);
    setCurrentReply("");
    const newHistory = [...history, { role: "user", content: question }];
    setHistory(newHistory);
    let reply = "";
    try {
      await streamFromRoute("/api/market", { idea, analysis, history, question }, chunk => {
        reply += chunk;
        setCurrentReply(reply);
      });
      setHistory([...newHistory, { role: "assistant", content: reply }]);
    } catch (e) {
      setHistory([...newHistory, { role: "assistant", content: "Errore: " + e.message }]);
    } finally {
      setStreaming(false);
      setCurrentReply("");
    }
  };

  return (
    <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(168,85,247,0.5)", letterSpacing: "0.14em", marginBottom: "14px" }}>💬 DOMANDE SULL'ANALISI DI MERCATO</div>
      {history.length > 0 && (
        <div style={{ marginBottom: "14px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
          {history.map((m, i) => (
            <div key={i} style={{ padding: "10px 14px", borderRadius: "8px", background: m.role === "user" ? "rgba(234,179,8,0.06)" : "rgba(255,255,255,0.03)", border: m.role === "user" ? "1px solid rgba(234,179,8,0.15)" : "1px solid rgba(255,255,255,0.05)", alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%" }}>
              <div style={{ fontSize: "9px", fontFamily: "monospace", color: m.role === "user" ? "rgba(234,179,8,0.5)" : "rgba(168,85,247,0.5)", marginBottom: "4px" }}>{m.role === "user" ? "TU" : "MARKET AI"}</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))}
          {streaming && currentReply && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", alignSelf: "flex-start", maxWidth: "90%" }}>
              <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(168,85,247,0.5)", marginBottom: "4px" }}>MARKET AI</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{currentReply}<span style={{ opacity: 0.5 }}>▌</span></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Es: Come raggiungo i broadcaster francesi? Quale prezzo per il mercato italiano?"
          disabled={streaming}
          style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "#f5f0e8", fontSize: "13px", outline: "none" }}
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          style={{ padding: "10px 18px", borderRadius: "8px", border: "none", background: streaming || !input.trim() ? "rgba(168,85,247,0.2)" : "rgba(168,85,247,0.85)", color: streaming || !input.trim() ? "rgba(0,0,0,0.3)" : "#fff", fontSize: "13px", fontFamily: "monospace", fontWeight: 700, cursor: streaming || !input.trim() ? "not-allowed" : "pointer" }}>
          {streaming ? "…" : "→"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const [rawAnalysis, setRawAnalysis] = useState("");
  const [parsed, setParsed] = useState(null);

  const validate = async () => {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setStreamPreview("");
    setRawAnalysis("");
    setParsed(null);
    let full = "";
    try {
      await streamFromRoute("/api/market", { idea }, chunk => {
        full += chunk;
        setStreamPreview(full);
      });
      setRawAnalysis(full);
      setParsed(parseAnalysis(full));
    } catch (e) {
      alert("Errore: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const semaforoConf = parsed?.semaforo ? SEMAFORO_CONFIG[parsed.semaforo] || null : null;

  return (
    <div style={{ minHeight: "100vh", background: "#060608", color: "#f5f0e8" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} } @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>

      <div style={{ position: "fixed", top: "-100px", left: "-100px", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "780px", margin: "0 auto", padding: "48px 24px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(234,179,8,0.4)", letterSpacing: "0.2em" }}>APP 1</div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)" }}>→</div>
            <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(99,202,183,0.4)", letterSpacing: "0.2em" }}>APP 2</div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)" }}>→</div>
            <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(168,85,247,0.8)", letterSpacing: "0.2em", background: "rgba(168,85,247,0.08)", padding: "3px 10px", borderRadius: "4px", border: "1px solid rgba(168,85,247,0.2)" }}>APP 3 — VALIDAZIONE DI MERCATO</div>
          </div>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, lineHeight: "1.1", color: "#f5f0e8", letterSpacing: "-0.02em", marginBottom: "12px" }}>
            C'è un mercato<br /><span style={{ color: "rgba(255,255,255,0.25)" }}>reale?</span>
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", fontFamily: "monospace", lineHeight: "1.6" }}>
            Incolla l'idea + analisi tecnica dall'App 2. Ottieni ICP, competitor, TAM/SAM/SOM, willingness to pay e verdetto di mercato.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(255,255,255,0.2)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "10px" }}>Incolla idea + analisi tecnica dall'App 2</div>
          <textarea
            value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder={`Incolla qui l'idea e l'analisi tecnica completa dall'App 2...\n\nEs:\nNome: BroadcastBridge\nTagline: Trasforma contenuti YouTube in pacchetti pronti per broadcaster TV\n...\n[+ output analisi tecnica App 2]`}
            rows={10}
            style={{ width: "100%", padding: "16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "#f5f0e8", fontSize: "13px", lineHeight: "1.7", outline: "none", resize: "vertical" }}
          />
        </div>

        <button
          onClick={validate}
          disabled={loading || !idea.trim()}
          style={{ padding: "13px 32px", borderRadius: "8px", border: "none", background: loading || !idea.trim() ? "rgba(168,85,247,0.2)" : "rgba(168,85,247,0.85)", color: loading || !idea.trim() ? "rgba(255,255,255,0.3)" : "#fff", fontSize: "14px", fontFamily: "monospace", fontWeight: 700, cursor: loading || !idea.trim() ? "not-allowed" : "pointer", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "8px", marginBottom: "40px" }}
        >
          {loading ? <><span style={{ animation: "blink 0.6s infinite" }}>▌</span> ANALISI IN CORSO…</> : "🔍 VALIDA IL MERCATO"}
        </button>

        {/* Stream preview */}
        {loading && streamPreview && (
          <div style={{ marginBottom: "28px", padding: "14px 18px", borderRadius: "8px", border: "1px solid rgba(168,85,247,0.1)", background: "rgba(168,85,247,0.02)" }}>
            <div style={{ fontSize: "9px", fontFamily: "monospace", color: "rgba(168,85,247,0.4)", marginBottom: "6px", letterSpacing: "0.15em" }}>ANALISI IN CORSO ▶</div>
            <p style={{ fontSize: "11px", fontFamily: "monospace", color: "rgba(255,255,255,0.2)", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>{streamPreview}<span style={{ animation: "blink 0.5s infinite" }}>▌</span></p>
          </div>
        )}

        {/* Results */}
        {parsed && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>

            {/* Semaforo */}
            {semaforoConf && (
              <div style={{ marginBottom: "32px", padding: "24px 28px", borderRadius: "12px", background: semaforoConf.bg, border: `1px solid ${semaforoConf.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: parsed.motivazione ? "12px" : 0 }}>
                  <span style={{ fontSize: "32px" }}>{semaforoConf.emoji}</span>
                  <div>
                    <div style={{ fontSize: "9px", fontFamily: "monospace", color: semaforoConf.color, letterSpacing: "0.16em", marginBottom: "4px" }}>VERDETTO DI MERCATO</div>
                    <div style={{ fontSize: "22px", fontWeight: 700, color: semaforoConf.color }}>{parsed.semaforo}</div>
                  </div>
                </div>
                {parsed.motivazione && <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)", lineHeight: "1.6", margin: 0 }}>{parsed.motivazione}</p>}
              </div>
            )}

            {/* TAM SAM SOM */}
            {(parsed.tam || parsed.sam || parsed.som) && (
              <div style={{ marginBottom: "32px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {[
                  { label: "TAM — Mercato totale", value: parsed.tam, color: "#a5b4fc", bg: "rgba(99,102,241,0.06)", border: "rgba(99,102,241,0.2)" },
                  { label: "SAM — Raggiungibile", value: parsed.sam, color: "#67e8f9", bg: "rgba(6,182,212,0.06)", border: "rgba(6,182,212,0.2)" },
                  { label: "SOM — Anno 1-2", value: parsed.som, color: "#86efac", bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.2)" },
                ].map(({ label, value, color, bg, border }) => value && (
                  <div key={label} style={{ padding: "14px", borderRadius: "10px", background: bg, border: `1px solid ${border}` }}>
                    <div style={{ fontSize: "8px", fontFamily: "monospace", color, letterSpacing: "0.12em", marginBottom: "8px", textTransform: "uppercase" }}>{label}</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color, lineHeight: "1.4" }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ICP Primario */}
            {parsed.icpPrimario?.length > 0 && (
              <Section title="🎯 Cliente ideale primario (ICP)" accent="rgba(168,85,247,0.7)">
                <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.12)" }}>
                  {parsed.icpPrimario.map((item, i) => <ICPItem key={i} text={item} />)}
                </div>
              </Section>
            )}

            {/* ICP Secondario */}
            {parsed.icpSecondario?.length > 0 && (
              <Section title="🎯 Cliente ideale secondario" accent="rgba(168,85,247,0.4)">
                <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(168,85,247,0.02)", border: "1px solid rgba(168,85,247,0.08)" }}>
                  {parsed.icpSecondario.map((item, i) => <ICPItem key={i} text={item} />)}
                </div>
              </Section>
            )}

            {/* Competitor diretti */}
            {parsed.competitorDiretti?.length > 0 && (
              <Section title="🥊 Competitor diretti" accent="rgba(239,68,68,0.7)">
                {parsed.competitorDiretti.map((c, i) => <CompetitorItem key={i} text={c} />)}
              </Section>
            )}

            {/* Competitor indiretti */}
            {parsed.competitorIndiretti?.length > 0 && (
              <Section title="🥊 Competitor indiretti" accent="rgba(239,68,68,0.4)">
                {parsed.competitorIndiretti.map((c, i) => <CompetitorItem key={i} text={c} />)}
              </Section>
            )}

            {/* Vantaggio competitivo */}
            {parsed.vantaggioCompetitivo && (
              <Section title="⚡ Il tuo vantaggio competitivo" accent="rgba(234,179,8,0.7)">
                <div style={{ padding: "16px 20px", borderRadius: "10px", background: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.12)" }}>
                  <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", lineHeight: "1.8", margin: 0 }}>{parsed.vantaggioCompetitivo}</p>
                </div>
              </Section>
            )}

            {/* Domanda reale */}
            {parsed.domandaReale?.length > 0 && (
              <Section title="📣 Segnali di domanda reale" accent="rgba(34,197,94,0.7)">
                {parsed.domandaReale.map((d, i) => <BulletItem key={i} text={d} accent="rgba(34,197,94,0.6)" />)}
              </Section>
            )}

            {/* WTP */}
            {parsed.wtp?.length > 0 && (
              <Section title="💰 Willingness to pay" accent="rgba(99,202,183,0.7)">
                <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(99,202,183,0.04)", border: "1px solid rgba(99,202,183,0.12)" }}>
                  {parsed.wtp.map((item, i) => <ICPItem key={i} text={item} />)}
                </div>
              </Section>
            )}

            {/* Canali */}
            {parsed.canali?.length > 0 && (
              <Section title="📡 Canali di acquisizione" accent="rgba(56,189,248,0.7)">
                {parsed.canali.map((c, i) => <CompetitorItem key={i} text={c} />)}
              </Section>
            )}

            {/* Rischi */}
            {parsed.rischi?.length > 0 && (
              <Section title="⚠️ Rischi di mercato" accent="rgba(251,146,60,0.7)">
                {parsed.rischi.map((r, i) => <BulletItem key={i} text={r} accent="rgba(251,146,60,0.6)" />)}
              </Section>
            )}

            {/* Validazione rapida */}
            {parsed.validazioneRapida && (
              <Section title="🚀 Valida questa settimana — senza costruire nulla" accent="rgba(99,202,183,0.9)">
                <div style={{ padding: "18px 20px", borderRadius: "10px", background: "rgba(99,202,183,0.05)", border: "1px solid rgba(99,202,183,0.2)" }}>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: "1.8", whiteSpace: "pre-wrap", margin: 0 }}>{parsed.validazioneRapida}</p>
                </div>
              </Section>
            )}

            <Chat idea={idea} analysis={rawAnalysis} />
          </div>
        )}
      </div>
    </div>
  );
}
