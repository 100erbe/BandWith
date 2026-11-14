/**
 * Pushes and in-app notifications carry a short English label as subtitle
 * ("Private Message", "Gig Alert · Summer Fest"). The title and body are
 * translated by the database (migrations 088-090, profiles.preferred_language);
 * the label is translated here, per recipient, by send-push, and by the app
 * when it shows the subtitle. Only the known label at the start is
 * translated; the rest (an event title, a band name) stays as it is.
 * Plain TypeScript with no imports: the web app (src/lib/pushLabels.ts) and
 * Deno share this file.
 */

export type PushLang = 'it' | 'es' | 'fr' | 'de' | 'pt';

const LANGS: readonly string[] = ['it', 'es', 'fr', 'de', 'pt'];

/** profiles.preferred_language → a translated language, or null (English / other). */
export const pushLanguage = (pref: string | null | undefined): PushLang | null => {
  const l = String(pref || '').trim().slice(0, 2).toLowerCase();
  return LANGS.includes(l) ? (l as PushLang) : null;
};

const LABELS: Record<string, Record<PushLang, string>> = {
  'Private Message': { it: 'Messaggio privato', es: 'Mensaje privado', fr: 'Message privé', de: 'Private Nachricht', pt: 'Mensagem privada' },
  'Band Chat': { it: 'Chat della band', es: 'Chat de la banda', fr: 'Discussion du groupe', de: 'Band-Chat', pt: 'Conversa da banda' },
  'Gig Alert': { it: 'Avviso gig', es: 'Aviso de concierto', fr: 'Alerte concert', de: 'Gig-Hinweis', pt: 'Alerta de show' },
  'Gig RSVP': { it: 'Risposta gig', es: 'Respuesta al concierto', fr: 'Réponse concert', de: 'Gig-Zusage', pt: 'Resposta ao show' },
  'Gig Invitation': { it: 'Invito al gig', es: 'Invitación a concierto', fr: 'Invitation à un concert', de: 'Gig-Einladung', pt: 'Convite para show' },
  'New Gig': { it: 'Nuovo gig', es: 'Nuevo concierto', fr: 'Nouveau concert', de: 'Neuer Gig', pt: 'Novo show' },
  'Event Update': { it: 'Aggiornamento evento', es: 'Actualización del evento', fr: 'Mise à jour de l’événement', de: 'Event-Update', pt: 'Atualização do evento' },
  'Upcoming Gig': { it: 'Prossimo gig', es: 'Próximo concierto', fr: 'Prochain concert', de: 'Nächster Gig', pt: 'Próximo show' },
  'Finance': { it: 'Finanze', es: 'Finanzas', fr: 'Finances', de: 'Finanzen', pt: 'Finanças' },
  'New Band': { it: 'Nuova band', es: 'Nueva banda', fr: 'Nouveau groupe', de: 'Neue Band', pt: 'Nova banda' },
  'Rehearsal': { it: 'Prova', es: 'Ensayo', fr: 'Répétition', de: 'Probe', pt: 'Ensaio' },
  'Gig': { it: 'Gig', es: 'Concierto', fr: 'Concert', de: 'Gig', pt: 'Show' },
  'Wedding Gig': { it: 'Matrimonio', es: 'Boda', fr: 'Mariage', de: 'Hochzeit', pt: 'Casamento' },
  'Corporate Event': { it: 'Evento aziendale', es: 'Evento corporativo', fr: 'Événement d’entreprise', de: 'Firmenevent', pt: 'Evento corporativo' },
  'Private Event': { it: 'Evento privato', es: 'Evento privado', fr: 'Événement privé', de: 'Privates Event', pt: 'Evento privado' },
  'Festival': { it: 'Festival', es: 'Festival', fr: 'Festival', de: 'Festival', pt: 'Festival' },
  'Event': { it: 'Evento', es: 'Evento', fr: 'Événement', de: 'Event', pt: 'Evento' },
};

const SEP = ' · ';

/**
 * "Gig Alert · Summer Fest" → "Avviso gig · Summer Fest" for an Italian
 * reader. Anything that does not start with a known label is returned as is.
 */
export const localizePushLabel = (subtitle: string | null | undefined, lang: PushLang | null): string | undefined => {
  if (!subtitle) return subtitle ?? undefined;
  if (!lang) return subtitle;
  const i = subtitle.indexOf(SEP);
  const head = i === -1 ? subtitle : subtitle.slice(0, i);
  const translated = LABELS[head]?.[lang];
  if (!translated) return subtitle;
  return i === -1 ? translated : translated + subtitle.slice(i);
};

/**
 * Collapse id for APNs / tag for Android: a newer push with the same id
 * replaces the older one. Only duplicate invites to the same event collapse;
 * chat messages and alerts (two dropouts, two DMs) each stay visible.
 */
export const pushCollapseId = (type: string | null | undefined, data?: Record<string, unknown> | null): string | undefined => {
  const eventId = data?.event_id ?? data?.eventId;
  if (type === 'event_invite' && eventId) return `invite:${String(eventId)}`.slice(0, 64);
  return undefined;
};

/** iOS groups notifications with the same thread id (one stack per chat / event). */
export const pushThreadId = (data?: Record<string, unknown> | null): string | undefined => {
  const chatId = data?.chat_id ?? data?.chatId;
  if (chatId) return `chat:${String(chatId)}`;
  const eventId = data?.event_id ?? data?.eventId;
  return eventId ? `event:${String(eventId)}` : undefined;
};
