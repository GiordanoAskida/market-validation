const FOUNDER_PROFILE = `
PROFILO FOUNDER:
- Background: Tech/Dev + Giornalismo/Media + 15+ anni workflow broadcaster TV
- Solo, nessun dev, budget €5k iniziale, AI agents al 95%, 5% lavoro manuale
- Obiettivo: lifestyle business, no investitori, no scala enterprise
- Mercati prioritari: Francia (TF1, M6, France TV, Arte, Canal+), Italia (RAI, Mediaset), Europa
- Clienti target: Creator, Freelancer video, Consumer B2C, Broadcaster TV
`;

export async function POST(req) {
  try {
    const { idea, analysis, history, question } = await req.json();

    const isChat = !!question;

    let messages;

    if (isChat) {
      const systemContext = `Sei un esperto di market validation e go-to-market per startup AI-first in Europa.\n${FOUNDER_PROFILE}\nL'utente ha già ricevuto questa analisi di mercato:\n${analysis}\nRispondi in modo conciso e pratico alle domande di follow-up.`;
      messages = [
        { role: "user", content: systemContext },
        { role: "assistant", content: "Perfetto, sono pronto a rispondere alle tue domande sull'analisi di mercato." },
        ...(history || []),
        { role: "user", content: question },
      ];
    } else {
      const prompt = `Sei un esperto di market validation, ricerca di mercato e go-to-market per startup AI-first in Europa.

${FOUNDER_PROFILE}

Analizza questa idea di startup dal punto di vista della VALIDAZIONE DI MERCATO:

IDEA + ANALISI TECNICA:
${idea}

Produci un'analisi strutturata in questo formato ESATTO (rispetta tutti i label):

SEMAFORO_MERCATO: [GO / ATTENZIONE / NO-GO]
MOTIVAZIONE_SEMAFORO: [1-2 frasi che spiegano il verdetto di mercato]

ICP_PRIMARIO:
- Ruolo/Tipo: [Chi è esattamente — es. "Video editor freelance 30-45 anni"]
- Paese: [Mercato principale con motivazione]
- Pain point principale: [Problema specifico che l'idea risolve]
- Frequenza del problema: [Quanto spesso lo vive — es. "ogni settimana nella post-produzione"]
- Budget disponibile: [Quanto spende già per soluzioni simili]
- Dove si trova online: [Community, forum, social, eventi]

ICP_SECONDARIO:
- Ruolo/Tipo: [Secondo profilo cliente]
- Paese: [Mercato]
- Pain point principale: [Problema]
- Budget disponibile: [Budget]

TAM: [Mercato totale indirizzabile in €/anno con fonte o metodologia di calcolo]
SAM: [Mercato raggiungibile per questo founder in €/anno]
SOM: [Obiettivo realistico anno 1-2 in €/anno]

COMPETITOR_DIRETTI:
- [Nome]: [Cosa fa] | Prezzo: [€/mese] | Punto debole: [Gap che puoi sfruttare]
- [ripeti per ogni competitor diretto, max 4]

COMPETITOR_INDIRETTI:
- [Nome o categoria]: [Perché è alternativa indiretta] | Gap: [Opportunità]
- [ripeti per ogni competitor indiretto, max 3]

VANTAGGIO_COMPETITIVO: [In 2-3 frasi, quale posizionamento unico può avere questa idea rispetto ai competitor, considerando il profilo del founder]

DOMANDA_REALE:
- [Segnale concreto di domanda esistente — es. community, ricerche Google, thread Reddit, job posting, ecc.]
- [ripeti per ogni segnale, min 3]

WILLINGNESS_TO_PAY:
- Modello consigliato: [SaaS mensile / One-shot / Freemium+Pro / Pay-per-use / B2B annuale]
- Prezzo MVP realistico: [€XX/mese o €XX/uso con motivazione]
- Prezzo a regime: [€XX/mese con motivazione]
- Benchmark: [Prodotto simile che il cliente già paga a prezzo simile]

CANALI_ACQUISIZIONE:
- [Canale]: [Tattica specifica per raggiungere l'ICP] | Costo stimato: [€/mese o gratuito]
- [ripeti per ogni canale, max 4]

RISCHI_MERCATO:
- [Rischio concreto di mercato — es. stagionalità, dipendenza da piattaforma, regulatory, ecc.]
- [ripeti per ogni rischio]

VALIDAZIONE_RAPIDA: [3 azioni concrete che il founder può fare QUESTA SETTIMANA per validare la domanda reale, senza costruire nulla — es. landing page, interviste, gruppo LinkedIn, ecc.]

Sii specifico, usa dati reali dove possibile, calibra tutto sul mercato europeo (Francia + Italia prioritari). No ottimismo, no vaghezze.`;

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
        max_tokens: 2500,
        stream: true,
        messages,
      }),
    });

    if (!anthropicResp.ok) {
      const err = await anthropicResp.text();
      return new Response(JSON.stringify({ error: err }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(anthropicResp.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
