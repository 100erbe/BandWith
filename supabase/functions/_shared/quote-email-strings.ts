// Words of the client quote emails (templates "quote-link" and "quote-reply",
// migration 099), in the client's language. The quote page (/quote.html) has
// its own dictionary in src/quote/strings.ts; keep the two in the same tone.
//
// Values are plain text: renderEmail escapes them, and "\n" becomes <br>.

export type QuoteEmailLang = "en" | "it" | "es" | "fr" | "de" | "pt";
export type QuoteEmailKind = "sent" | "updated" | "reminder" | "reply";

interface Strings {
  locale: string;
  greet: string; // "{name}"
  greetNoName: string;
  subject: Record<QuoteEmailKind, string>; // {band} {ref}
  preheader: Record<QuoteEmailKind, string>; // {band} {event}
  kicker: string; // {ref}
  kickerReply: string; // {band}
  headline: Record<QuoteEmailKind, string>;
  intro: Record<QuoteEmailKind, string>; // {band} {event}
  cta: string;
  ctaReply: string;
  event: string;
  date: string;
  total: string;
  pdfTitle: string;
  pdfAttached: string;
  pdfOnPage: string;
  noteTitle: string;
  noteText: string; // {band}
  fallbackTitle: string;
  fallbackText: string;
  footer: string; // {band} {to}
}

export const QUOTE_EMAIL_STRINGS: Record<QuoteEmailLang, Strings> = {
  en: {
    locale: "en-GB",
    greet: "Hi {name},",
    greetNoName: "Hello,",
    subject: {
      sent: "{band} — Quote {ref}",
      updated: "{band} — Updated quote {ref}",
      reminder: "Reminder: quote {ref} from {band}",
      reply: "{band} replied about quote {ref}",
    },
    preheader: {
      sent: "{band} sent you a quote for {event}. Accept it, decline it or ask a question.",
      updated: "{band} updated your quote for {event}.",
      reminder: "Your quote from {band} for {event} is waiting for your answer.",
      reply: "{band} replied to your message about {event}.",
    },
    kicker: "Quote · {ref}",
    kickerReply: "Message from {band}",
    headline: {
      sent: "Your quote\nis ready.",
      updated: "Your quote\nis updated.",
      reminder: "Your quote\nis waiting.",
      reply: "A new\nreply.",
    },
    intro: {
      sent: "{band} sent you a quote for {event}. Open it to see the details, then accept it, decline it or ask a question. No account needed.",
      updated: "{band} updated your quote for {event}. The page always shows the latest version.",
      reminder: "Just a reminder: your quote from {band} for {event} is waiting for your answer.",
      reply: "{band} replied to your message about {event}:",
    },
    cta: "Open the quote",
    ctaReply: "Reply on the quote page",
    event: "Event",
    date: "Date",
    total: "Total",
    pdfTitle: "The PDF",
    pdfAttached: "The quote is attached to this email as a PDF.",
    pdfOnPage: "You can download the PDF from the quote page.",
    noteTitle: "About accepting",
    noteText: "Accepting on the page records your answer with your name and the time. It is not a signature: if a contract is needed, {band} sends it separately.",
    fallbackTitle: "Button not working?",
    fallbackText: "Paste this link into your browser:",
    footer: "You’re getting this because {band} sent a quote to {to} through BandWith. To answer, use the quote page: replies to this email are not read.",
  },
  it: {
    locale: "it-IT",
    greet: "Gentile {name},",
    greetNoName: "Gentile cliente,",
    subject: {
      sent: "{band} — Preventivo {ref}",
      updated: "{band} — Preventivo {ref} aggiornato",
      reminder: "Promemoria: preventivo {ref} di {band}",
      reply: "{band} ha risposto sul preventivo {ref}",
    },
    preheader: {
      sent: "{band} vi ha inviato un preventivo per {event}. Potete accettarlo, rifiutarlo o fare una domanda.",
      updated: "{band} ha aggiornato il preventivo per {event}.",
      reminder: "Il preventivo di {band} per {event} attende la vostra risposta.",
      reply: "{band} ha risposto al vostro messaggio su {event}.",
    },
    kicker: "Preventivo · {ref}",
    kickerReply: "Messaggio da {band}",
    headline: {
      sent: "Il vostro\npreventivo.",
      updated: "Preventivo\naggiornato.",
      reminder: "Il preventivo\nvi aspetta.",
      reply: "Una nuova\nrisposta.",
    },
    intro: {
      sent: "{band} vi ha inviato un preventivo per {event}. Apritelo per vedere i dettagli, poi accettatelo, rifiutatelo o fate una domanda. Non serve un account.",
      updated: "{band} ha aggiornato il preventivo per {event}. La pagina mostra sempre la versione più recente.",
      reminder: "Vi ricordiamo che il preventivo di {band} per {event} attende la vostra risposta.",
      reply: "{band} ha risposto al vostro messaggio su {event}:",
    },
    cta: "Apri il preventivo",
    ctaReply: "Rispondi sulla pagina",
    event: "Evento",
    date: "Data",
    total: "Totale",
    pdfTitle: "Il PDF",
    pdfAttached: "Il preventivo è allegato a questa email in PDF.",
    pdfOnPage: "Potete scaricare il PDF dalla pagina del preventivo.",
    noteTitle: "Sull’accettazione",
    noteText: "Accettando sulla pagina registrate la vostra risposta con nome e orario. Non è una firma: se serve un contratto, {band} lo invia a parte.",
    fallbackTitle: "Il pulsante non funziona?",
    fallbackText: "Incollate questo link nel browser:",
    footer: "Ricevete questa email perché {band} ha inviato un preventivo a {to} tramite BandWith. Per rispondere usate la pagina del preventivo: le risposte a questa email non vengono lette.",
  },
  es: {
    locale: "es-ES",
    greet: "Hola, {name}:",
    greetNoName: "Hola:",
    subject: {
      sent: "{band} — Presupuesto {ref}",
      updated: "{band} — Presupuesto {ref} actualizado",
      reminder: "Recordatorio: presupuesto {ref} de {band}",
      reply: "{band} respondió sobre el presupuesto {ref}",
    },
    preheader: {
      sent: "{band} te ha enviado un presupuesto para {event}. Acéptalo, recházalo o haz una pregunta.",
      updated: "{band} ha actualizado tu presupuesto para {event}.",
      reminder: "Tu presupuesto de {band} para {event} espera tu respuesta.",
      reply: "{band} ha respondido a tu mensaje sobre {event}.",
    },
    kicker: "Presupuesto · {ref}",
    kickerReply: "Mensaje de {band}",
    headline: {
      sent: "Tu presupuesto\nestá listo.",
      updated: "Presupuesto\nactualizado.",
      reminder: "Tu presupuesto\nte espera.",
      reply: "Una nueva\nrespuesta.",
    },
    intro: {
      sent: "{band} te ha enviado un presupuesto para {event}. Ábrelo para ver los detalles y luego acéptalo, recházalo o haz una pregunta. No necesitas cuenta.",
      updated: "{band} ha actualizado tu presupuesto para {event}. La página siempre muestra la versión más reciente.",
      reminder: "Te recordamos que el presupuesto de {band} para {event} está esperando tu respuesta.",
      reply: "{band} ha respondido a tu mensaje sobre {event}:",
    },
    cta: "Abrir el presupuesto",
    ctaReply: "Responder en la página",
    event: "Evento",
    date: "Fecha",
    total: "Total",
    pdfTitle: "El PDF",
    pdfAttached: "El presupuesto va adjunto a este email en PDF.",
    pdfOnPage: "Puedes descargar el PDF desde la página del presupuesto.",
    noteTitle: "Sobre la aceptación",
    noteText: "Al aceptar en la página queda registrada tu respuesta con tu nombre y la hora. No es una firma: si hace falta un contrato, {band} lo envía aparte.",
    fallbackTitle: "¿El botón no funciona?",
    fallbackText: "Pega este enlace en tu navegador:",
    footer: "Recibes este email porque {band} envió un presupuesto a {to} a través de BandWith. Para responder, usa la página del presupuesto: las respuestas a este email no se leen.",
  },
  fr: {
    locale: "fr-FR",
    greet: "Bonjour {name},",
    greetNoName: "Bonjour,",
    subject: {
      sent: "{band} — Devis {ref}",
      updated: "{band} — Devis {ref} mis à jour",
      reminder: "Rappel : devis {ref} de {band}",
      reply: "{band} a répondu au sujet du devis {ref}",
    },
    preheader: {
      sent: "{band} vous a envoyé un devis pour {event}. Acceptez-le, refusez-le ou posez une question.",
      updated: "{band} a mis à jour votre devis pour {event}.",
      reminder: "Votre devis de {band} pour {event} attend votre réponse.",
      reply: "{band} a répondu à votre message au sujet de {event}.",
    },
    kicker: "Devis · {ref}",
    kickerReply: "Message de {band}",
    headline: {
      sent: "Votre devis\nest prêt.",
      updated: "Devis\nmis à jour.",
      reminder: "Votre devis\nvous attend.",
      reply: "Une nouvelle\nréponse.",
    },
    intro: {
      sent: "{band} vous a envoyé un devis pour {event}. Ouvrez-le pour voir le détail, puis acceptez-le, refusez-le ou posez une question. Aucun compte n’est nécessaire.",
      updated: "{band} a mis à jour votre devis pour {event}. La page affiche toujours la dernière version.",
      reminder: "Petit rappel : le devis de {band} pour {event} attend votre réponse.",
      reply: "{band} a répondu à votre message au sujet de {event} :",
    },
    cta: "Ouvrir le devis",
    ctaReply: "Répondre sur la page",
    event: "Événement",
    date: "Date",
    total: "Total",
    pdfTitle: "Le PDF",
    pdfAttached: "Le devis est joint à cet e-mail en PDF.",
    pdfOnPage: "Vous pouvez télécharger le PDF depuis la page du devis.",
    noteTitle: "À propos de l’acceptation",
    noteText: "Accepter sur la page enregistre votre réponse avec votre nom et l’heure. Ce n’est pas une signature : si un contrat est nécessaire, {band} vous l’envoie séparément.",
    fallbackTitle: "Le bouton ne fonctionne pas ?",
    fallbackText: "Collez ce lien dans votre navigateur :",
    footer: "Vous recevez cet e-mail parce que {band} a envoyé un devis à {to} via BandWith. Pour répondre, utilisez la page du devis : les réponses à cet e-mail ne sont pas lues.",
  },
  de: {
    locale: "de-DE",
    greet: "Guten Tag {name},",
    greetNoName: "Guten Tag,",
    subject: {
      sent: "{band} — Angebot {ref}",
      updated: "{band} — Angebot {ref} aktualisiert",
      reminder: "Erinnerung: Angebot {ref} von {band}",
      reply: "{band} hat zum Angebot {ref} geantwortet",
    },
    preheader: {
      sent: "{band} hat Ihnen ein Angebot für {event} gesendet. Nehmen Sie es an, lehnen Sie es ab oder stellen Sie eine Frage.",
      updated: "{band} hat Ihr Angebot für {event} aktualisiert.",
      reminder: "Ihr Angebot von {band} für {event} wartet auf Ihre Antwort.",
      reply: "{band} hat auf Ihre Nachricht zu {event} geantwortet.",
    },
    kicker: "Angebot · {ref}",
    kickerReply: "Nachricht von {band}",
    headline: {
      sent: "Ihr Angebot\nist da.",
      updated: "Angebot\naktualisiert.",
      reminder: "Ihr Angebot\nwartet.",
      reply: "Eine neue\nAntwort.",
    },
    intro: {
      sent: "{band} hat Ihnen ein Angebot für {event} gesendet. Öffnen Sie es, um die Details zu sehen, und nehmen Sie es an, lehnen Sie es ab oder stellen Sie eine Frage. Ein Konto ist nicht nötig.",
      updated: "{band} hat Ihr Angebot für {event} aktualisiert. Die Seite zeigt immer die neueste Version.",
      reminder: "Eine kurze Erinnerung: Das Angebot von {band} für {event} wartet auf Ihre Antwort.",
      reply: "{band} hat auf Ihre Nachricht zu {event} geantwortet:",
    },
    cta: "Angebot öffnen",
    ctaReply: "Auf der Seite antworten",
    event: "Veranstaltung",
    date: "Datum",
    total: "Gesamt",
    pdfTitle: "Das PDF",
    pdfAttached: "Das Angebot ist dieser E-Mail als PDF angehängt.",
    pdfOnPage: "Sie können das PDF auf der Angebotsseite herunterladen.",
    noteTitle: "Zur Annahme",
    noteText: "Wenn Sie auf der Seite annehmen, wird Ihre Antwort mit Name und Uhrzeit erfasst. Das ist keine Unterschrift: Falls ein Vertrag nötig ist, sendet {band} ihn separat.",
    fallbackTitle: "Funktioniert der Button nicht?",
    fallbackText: "Fügen Sie diesen Link in Ihren Browser ein:",
    footer: "Sie erhalten diese E-Mail, weil {band} über BandWith ein Angebot an {to} gesendet hat. Bitte antworten Sie über die Angebotsseite: Antworten auf diese E-Mail werden nicht gelesen.",
  },
  pt: {
    locale: "pt-BR",
    greet: "Olá, {name},",
    greetNoName: "Olá,",
    subject: {
      sent: "{band} — Orçamento {ref}",
      updated: "{band} — Orçamento {ref} atualizado",
      reminder: "Lembrete: orçamento {ref} de {band}",
      reply: "{band} respondeu sobre o orçamento {ref}",
    },
    preheader: {
      sent: "{band} enviou um orçamento para {event}. Aceite, recuse ou faça uma pergunta.",
      updated: "{band} atualizou seu orçamento para {event}.",
      reminder: "Seu orçamento de {band} para {event} está aguardando sua resposta.",
      reply: "{band} respondeu à sua mensagem sobre {event}.",
    },
    kicker: "Orçamento · {ref}",
    kickerReply: "Mensagem de {band}",
    headline: {
      sent: "Seu orçamento\nestá pronto.",
      updated: "Orçamento\natualizado.",
      reminder: "Seu orçamento\nespera você.",
      reply: "Uma nova\nresposta.",
    },
    intro: {
      sent: "{band} enviou um orçamento para {event}. Abra para ver os detalhes e depois aceite, recuse ou faça uma pergunta. Não precisa de conta.",
      updated: "{band} atualizou seu orçamento para {event}. A página sempre mostra a versão mais recente.",
      reminder: "Só um lembrete: o orçamento de {band} para {event} está aguardando sua resposta.",
      reply: "{band} respondeu à sua mensagem sobre {event}:",
    },
    cta: "Abrir o orçamento",
    ctaReply: "Responder na página",
    event: "Evento",
    date: "Data",
    total: "Total",
    pdfTitle: "O PDF",
    pdfAttached: "O orçamento está anexado a este e-mail em PDF.",
    pdfOnPage: "Você pode baixar o PDF na página do orçamento.",
    noteTitle: "Sobre o aceite",
    noteText: "Ao aceitar na página, sua resposta fica registrada com seu nome e o horário. Não é uma assinatura: se for preciso um contrato, {band} envia separadamente.",
    fallbackTitle: "O botão não funciona?",
    fallbackText: "Cole este link no seu navegador:",
    footer: "Você está recebendo este e-mail porque {band} enviou um orçamento para {to} pelo BandWith. Para responder, use a página do orçamento: respostas a este e-mail não são lidas.",
  },
};

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

export const pickQuoteEmailLang = (lang: unknown): QuoteEmailLang =>
  typeof lang === "string" && lang in QUOTE_EMAIL_STRINGS ? (lang as QuoteEmailLang) : "en";

/** "2027-03-20" in the client's language ("20 March 2027"); "" when unknown. */
export function quoteEmailDate(date: unknown, lang: QuoteEmailLang): string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(date)) return "";
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(QUOTE_EMAIL_STRINGS[lang].locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export interface QuoteEmailInput {
  kind: QuoteEmailKind;
  lang: QuoteEmailLang;
  band: string;
  ref: string;
  event: string;
  date: string; // already formatted
  total: string;
  clientName: string; // "" when unknown
  to: string;
  url: string;
  pdfAttached: boolean;
  reply?: string;
}

/** Template variables for "quote-link" / "quote-reply" (raw values). */
export function quoteEmailVars(i: QuoteEmailInput): Record<string, string> {
  const s = QUOTE_EMAIL_STRINGS[i.lang];
  const v = { band: i.band, ref: i.ref, event: i.event, to: i.to };
  const greet = i.clientName ? fill(s.greet, { name: i.clientName }) : s.greetNoName;
  const reply = i.kind === "reply";
  return {
    Subject: fill(s.subject[i.kind], v),
    Preheader: fill(s.preheader[i.kind], v),
    Kicker: reply ? fill(s.kickerReply, v) : fill(s.kicker, v),
    Headline: s.headline[i.kind],
    Intro: `${greet}\n${fill(s.intro[i.kind], v)}`,
    CtaLabel: reply ? s.ctaReply : s.cta,
    QuoteURL: i.url,
    EventLabel: s.event,
    EventName: i.event,
    DateLabel: s.date,
    EventDate: i.date || "—",
    TotalLabel: s.total,
    Total: i.total || "—",
    PdfTitle: s.pdfTitle,
    PdfText: i.pdfAttached ? s.pdfAttached : s.pdfOnPage,
    NoteTitle: s.noteTitle,
    NoteText: fill(s.noteText, v),
    FallbackTitle: s.fallbackTitle,
    FallbackText: s.fallbackText,
    FooterReason: fill(s.footer, v),
    Reply: i.reply ?? "",
    To: i.to,
  };
}
