const FOUNDER_PROFILE = `
PROFILO FOUNDER:
- Background: Tech/Dev + Giornalismo/Media + 15+ anni workflow broadcaster TV
- Solo, nessun dev, budget €5k iniziale, AI agents al 95%, 5% lavoro manuale
- Obiettivo: lifestyle business, no investitori, no scala enterprise
- Mercati: Francia (TF1, M6, France TV, Arte, Canal+), Italia (RAI, Mediaset), Europa
- Clienti target: Creator, Freelancer video, Consumer B2C
`;

export async function POST(req) {
  try {
    const { idea, analysis, history, question } = await req.json();

    const isChat = !!question;

    let messages;
    if (isChat) {
      const systemContext = `Sei un esperto di market validation e go-to-market per startup AI-first solo-founder.\n${FOUNDER_PROFILE}\nL'utente ha già ricevuto questa analisi di mercato:\n${analysis}\nRispondi in modo conciso e pratico alle domande di follow-up.`;
      messages = [
        { role: "user", content: systemContext },
        { role: "assistant", content: "Perfetto, sono pronto a rispondere alle tue domande sull'analisi di mercato." },
        ...(history || []),
        { role: "user", content: question },
      ];
    } else {
      const prompt = `Sei un esperto di market validation, ricerca di mercato e go-to-market per startup AI-first solo-founder.

${FOUNDER_PROFILE}

Analizza questa idea di startup dal punto di vista della VALIDAZIONE DI MERCATO:

IDEA + ANALISI TECNICA:
${idea}

Produci un'analisi strutturata in questo formato ESATTO (rispetta tutti i label):

SEMAFORO_MERCATO: [GO / ATTENZIONE / NO-GO]
MOTIVAZIONE_SEMAFORO: [2-3 frasi che spiegano il verdetto di mercato]

ICP_PRIMARIO:
- Ruolo: [es. Responsabile acquisizione contenuti broadcaster]
- Azienda: [es. Broadcaster TV mid-size, 50-500 dipendenti]
- Problema: [problema principale che risolvi]
- Budget: [budget tipico disponibile]
- Trigger: [evento che lo spinge a cercare una soluzione]

ICP_SECONDARIO:
- Ruolo: [secondo profilo cliente]
- Azienda: [tipo azienda]
- Problema: [problema che risolvi]
- Budget: [budget tipico]
- Trigger: [trigger d'acquisto]

TAM: [Mercato totale globale in €/$ con fonte o ragionamento]
SAM: [Mercato raggiungibile nei mercati target Francia+Italia+Europa in €/$]
SOM: [Mercato ottenibile realisticamente anno 1-2 in €/$]

COMPETITOR_DIRETTI:
- [Nome] | [Prezzo] | [Gap che tu colmi]
- [ripeti per ogni competitor diretto]

COMPETITOR_INDIRETTI:
- [Nome] | [Prezzo] | [Perché è alternativa indiretta]
- [ripeti per ogni competitor indiretto]

VANTAGGIO_COMPETITIVO: [2-3 frasi sul vantaggio difendibile dato dal profilo founder]

DOMANDA_REALE:
- [Segnale concreto di domanda esistente, es. community, ricerche, trend]
- [ripeti per ogni segnale]

WILLINGNESS_TO_PAY:
- Segmento: [nome segmento] | WTP: [range €/mese o €/progetto] | Modello: [subscription/one-shot/usage]
- [ripeti per ogni segmento]

CANALI_ACQUISIZIONE:
- [Canale] | [Tattica specifica] | [Costo stimato per lead]
- [ripeti per ogni canale]

RISCHI_MERCATO:
- [Rischio concreto di mercato]
- [ripeti per ogni rischio]

VALIDAZIONE_RAPIDA: [3-5 azioni concrete da fare questa settimana per validare senza costruire nulla, con stima tempo/costo]

Sii specifico e realistico. No ottimismo, no vaghezze. Usa dati reali dove possibile.`;

      messages = [{ role: "user", content: prompt }];
    }

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        stream: true,
        messages,
      }),
    });

    if (!anthropicResp.ok) {
      const err = await anthropicResp.text();
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(anthropicResp.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
