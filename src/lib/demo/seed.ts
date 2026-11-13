/**
 * Demo data for development. Dates are relative to "today" so the demo always
 * has a gig today (Stage mode), rehearsals this week and past gigs for finance.
 */
export type Row = Record<string, any>;
export type DemoDB = Record<string, Row[]>;

// Unique first segment too, so demo ids look like real, distinct UUIDs.
const id = (n: number) => `${(0x10000000 + n).toString(16)}-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const IDS = {
  me: id(1),
  marta: id(2),
  jonah: id(3),
  lena: id(4),
  sam: id(5),
  band: id(100),
} as const;

export const DEMO_USER = {
  id: IDS.me,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@bandwith.app',
  email_confirmed_at: '2026-01-10T10:00:00.000Z',
  phone: '',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Alex Rivera' } as Record<string, any>,
  identities: [],
  created_at: '2026-01-10T10:00:00.000Z',
  updated_at: '2026-01-10T10:00:00.000Z',
};

const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar date, offset by `days` from today, as YYYY-MM-DD. */
const day = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** ISO timestamp `minutes` ago. */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const buildSeed = (): DemoDB => {
  const created = ago(60 * 24 * 120);

  const profiles: Row[] = [
    { id: IDS.me, email: 'demo@bandwith.app', full_name: 'Alex Rivera', avatar_url: null, role: 'admin', instrument: 'Vocals', phone: '+39 333 000 0001', bio: 'Lead vocals and band leader.', location: 'Milano', timezone: 'Europe/Rome', preferred_language: 'en', sub_tier: 'unlimited', user_mode: 'band', notification_preferences: {} },
    { id: IDS.marta, email: 'marta@example.com', full_name: 'Marta Conti', avatar_url: null, role: 'member', instrument: 'Drums', phone: null, sub_tier: 'free_member', user_mode: 'member' },
    { id: IDS.jonah, email: 'jonah@example.com', full_name: 'Jonah Reyes', avatar_url: null, role: 'member', instrument: 'Bass', phone: null, sub_tier: 'free_member', user_mode: 'member' },
    { id: IDS.lena, email: 'lena@example.com', full_name: 'Lena Park', avatar_url: null, role: 'member', instrument: 'Keys', phone: null, sub_tier: 'free_member', user_mode: 'member' },
    { id: IDS.sam, email: 'sam@example.com', full_name: 'Sam Okafor', avatar_url: null, role: 'member', instrument: 'Guitar', phone: null, sub_tier: 'free_member', user_mode: 'member' },
  ].map((p) => ({ created_at: created, updated_at: created, ...p }));

  const bands: Row[] = [
    {
      id: IDS.band, name: 'Velvet Static', slug: 'velvet-static', logo_url: null, cover_url: null,
      description: 'Five-piece soul & funk cover band for weddings, clubs and corporate nights.',
      genre: 'Soul / Funk', location: 'Milano', plan: 'unlimited', created_by: IDS.me,
      created_at: created, updated_at: created, standard_lineup_size: 5,
      core_musician_fee: 250, additional_musician_fee: 200, ceremony_musician_fee: 150, cocktail_musician_fee: 120,
      dj_hourly_rate: 80, production_standard_fee: 400, production_pro_fee: 900, production_extra_location_fee: 150,
      travel_rate_per_km: 0.45, home_base_address: 'Via Tortona 27, Milano', home_base_latitude: 45.4518, home_base_longitude: 9.1661,
      pricing_currency: 'EUR', pricing_rules: {}, extra_services: [], contact_email: 'booking@velvetstatic.example',
      signer_name: 'Alex Rivera', signer_role: 'Band leader', default_payment_terms: '30% deposit, balance on the day',
    },
  ];

  const members = [
    { u: IDS.me, role: 'admin', instrument: 'Vocals', fee: 300 },
    { u: IDS.marta, role: 'member', instrument: 'Drums', fee: 250 },
    { u: IDS.jonah, role: 'member', instrument: 'Bass', fee: 250 },
    { u: IDS.lena, role: 'member', instrument: 'Keys', fee: 250 },
    { u: IDS.sam, role: 'member', instrument: 'Guitar', fee: 250 },
  ];
  const band_members: Row[] = members.map((m, i) => ({
    id: id(200 + i), band_id: IDS.band, user_id: m.u, role: m.role, instrument: m.instrument,
    stage_name: null, default_fee: m.fee, is_active: true, joined_at: created, created_at: created,
  }));

  const songList: [string, string, number, number, string][] = [
    ['Superstition', 'Stevie Wonder', 245, 100, 'Ebm'],
    ['September', 'Earth, Wind & Fire', 215, 126, 'Ab'],
    ['Valerie', 'Amy Winehouse', 233, 112, 'Eb'],
    ['Uptown Funk', 'Mark Ronson ft. Bruno Mars', 270, 115, 'Dm'],
    ['Signed, Sealed, Delivered', 'Stevie Wonder', 160, 108, 'F'],
    ["Ain't No Mountain High Enough", 'Marvin Gaye & Tammi Terrell', 152, 130, 'Eb'],
    ['Get Lucky', 'Daft Punk', 248, 116, 'Bm'],
    ['Respect', 'Aretha Franklin', 148, 115, 'C'],
    ['Treasure', 'Bruno Mars', 178, 116, 'F'],
    ['Le Freak', 'Chic', 215, 120, 'Am'],
    ['I Wish', 'Stevie Wonder', 252, 106, 'Ebm'],
    ['Crazy in Love', 'Beyoncé', 236, 99, 'Dm'],
    ['Rehab', 'Amy Winehouse', 214, 144, 'C'],
    ['Long Train Runnin\'', 'The Doobie Brothers', 210, 115, 'Gm'],
  ];
  const songs: Row[] = songList.map(([title, artist, duration_seconds, bpm, key], i) => ({
    id: id(300 + i), band_id: IDS.band, title, artist, duration_seconds, bpm, key, genre: 'Soul / Funk',
    category: 'repertoire', status: 'ready', priority: 'normal', times_played: 12 - (i % 6), added_by: IDS.me,
    created_at: created, updated_at: created,
  }));

  const setlists: Row[] = [
    { id: id(400), band_id: IDS.band, name: 'Rooftop set', description: 'Two sets, dance-heavy second half', is_template: false, song_count: 10, total_duration_seconds: 2150, created_by: IDS.me, created_at: created, updated_at: created },
    { id: id(401), band_id: IDS.band, name: 'Wedding — dinner + party', description: null, is_template: true, song_count: 8, total_duration_seconds: 1700, created_by: IDS.me, created_at: created, updated_at: created },
  ];
  const setlist_songs: Row[] = [
    ...songs.slice(0, 10).map((s, i) => ({ id: id(500 + i), setlist_id: id(400), song_id: s.id, position: i + 1, set_number: i < 5 ? 1 : 2, notes: null, created_at: created })),
    ...songs.slice(4, 12).map((s, i) => ({ id: id(520 + i), setlist_id: id(401), song_id: s.id, position: i + 1, set_number: 1, notes: null, created_at: created })),
  ];

  const ev = (n: number, e: Row): Row => ({
    id: id(600 + n), band_id: IDS.band, status: 'confirmed', currency: 'EUR', venue_country: 'Italy',
    created_by: IDS.me, created_at: created, updated_at: created, payment_status: 'pending',
    deposit_paid: false, attachments: [], is_recurring: false, ...e,
  });
  const events: Row[] = [
    ev(0, { title: 'Rooftop Session', event_type: 'gig', event_date: day(0), load_in_time: '17:00', soundcheck_time: '18:30', start_time: '21:00', end_time: '23:30', venue_name: 'Terrazza Aurora', venue_address: 'Via Mazzini 12', venue_city: 'Milano', fee: 1800, setlist_id: id(400), dress_code: 'All black', client_name: 'Aurora Events', client_email: 'events@aurora.example', notes: 'Parking in the back courtyard. Ask for Paolo at the door.' }),
    ev(1, { title: 'Weekly rehearsal', event_type: 'rehearsal', event_date: day(1), start_time: '19:00', end_time: '22:00', venue_name: 'Blackbox Studios', venue_address: 'Via Ventura 4', venue_city: 'Milano', fee: null }),
    ev(2, { title: 'Giulia & Marco — Wedding', event_type: 'gig', event_date: day(5), load_in_time: '15:00', soundcheck_time: '16:30', start_time: '20:30', end_time: '00:30', venue_name: 'Villa Necchi', venue_address: 'Via Mozart 14', venue_city: 'Milano', fee: 3200, setlist_id: id(401), dress_code: 'Suits', client_name: 'Giulia Bianchi', deposit_amount: 960, deposit_paid: true, payment_status: 'partial' }),
    ev(3, { title: 'New songs rehearsal', event_type: 'rehearsal', event_date: day(8), start_time: '18:30', end_time: '21:30', venue_name: 'Blackbox Studios', venue_city: 'Milano', fee: null }),
    ev(4, { title: 'Jazz Club Night', event_type: 'gig', status: 'tentative', event_date: day(14), load_in_time: '19:00', soundcheck_time: '20:00', start_time: '22:00', end_time: '01:00', venue_name: 'Blue Note', venue_address: 'Via Borsieri 37', venue_city: 'Milano', fee: 1400 }),
    ev(5, { title: 'Tech Summit Afterparty', event_type: 'gig', event_date: day(27), load_in_time: '16:00', soundcheck_time: '17:30', start_time: '21:00', end_time: '23:00', venue_name: 'Superstudio Più', venue_city: 'Milano', fee: 4500, client_name: 'Northwind Conferences', client_company: 'Northwind' }),
    ev(6, { title: 'Summer Fest Opening', event_type: 'gig', status: 'completed', event_date: day(-6), start_time: '20:00', end_time: '22:00', venue_name: 'Parco Sempione', venue_city: 'Milano', fee: 1500, payment_status: 'paid', deposit_paid: true }),
    ev(7, { title: 'Private party — Lake Como', event_type: 'gig', status: 'completed', event_date: day(-19), start_time: '21:00', end_time: '00:00', venue_name: 'Villa Erba', venue_city: 'Cernobbio', fee: 2200, payment_status: 'paid', deposit_paid: true }),
    ev(8, { band_id: null, title: 'Vocal lesson', event_type: 'other', event_date: day(3), start_time: '11:00', end_time: '12:00', venue_name: 'Studio Lirico', venue_city: 'Milano', fee: null }),
  ];

  const event_members: Row[] = [];
  let em = 0;
  for (const e of events) {
    if (!e.band_id) continue;
    for (const m of members) {
      const pendingForMe = e.id === id(604) && m.u === IDS.me;
      const declined = e.id === id(604) && m.u === IDS.lena;
      event_members.push({
        id: id(700 + em++), event_id: e.id, user_id: m.u,
        status: pendingForMe ? 'pending' : declined ? 'declined' : 'confirmed',
        fee: e.event_type === 'gig' ? m.fee : null, role: m.instrument, notes: null,
        responded_at: pendingForMe ? null : created, created_at: created,
        // Lake Como is settled; Summer Fest still shows "Payouts due" on Home.
        paid_at: e.id === id(607) ? created : null,
      });
    }
  }

  const rehearsal_setlist: Row[] = songs.slice(10, 14).map((s, i) => ({
    id: id(800 + i), event_id: id(601), song_id: s.id, title: s.title, artist: s.artist, position: i + 1,
    notes: i === 0 ? 'Work on the bridge harmonies' : null, bpm: s.bpm, key: s.key, duration_seconds: s.duration_seconds, created_at: created,
  }));
  const rehearsal_tasks: Row[] = [
    { id: id(820), event_id: id(601), title: 'Learn horn lines for "I Wish"', description: null, task_type: 'practice', assigned_to: IDS.lena, status: 'pending', is_completed: false, created_by: IDS.me, created_at: created, updated_at: created },
    { id: id(821), event_id: id(601), title: 'Bring the new in-ear mixer', description: null, task_type: 'gear', assigned_to: IDS.me, status: 'pending', is_completed: false, due_date: day(1), created_by: IDS.me, created_at: created, updated_at: created },
  ];
  const song_proposals: Row[] = [
    { id: id(840), band_id: IDS.band, event_id: null, title: 'Feel It Still', artist: 'Portugal. The Man', proposed_by: IDS.jonah, reason: 'Great for the cocktail hour', status: 'pending', votes_up: 3, votes_down: 0, votes_yes: 3, votes_no: 0, created_at: ago(60 * 30), updated_at: ago(60 * 30) },
    { id: id(841), band_id: IDS.band, event_id: null, title: 'Golden', artist: 'Harry Styles', proposed_by: IDS.lena, reason: null, status: 'pending', votes_up: 1, votes_down: 1, votes_yes: 1, votes_no: 1, created_at: ago(60 * 50), updated_at: ago(60 * 50) },
  ];

  const q = (n: number, x: Row): Row => {
    const subtotal = x.base_fee + (x.travel_fee || 0) + (x.sound_fee || 0);
    const vat = Math.round(subtotal * 0.22);
    return {
      id: id(900 + n), band_id: IDS.band, quote_number: `Q-2026-${String(n + 12).padStart(4, '0')}`, currency: 'EUR',
      performance_type: 'full_band', set_duration_minutes: 45, number_of_sets: 3, break_duration_minutes: 15,
      genres: ['Soul', 'Funk'], vat_rate: 22, vat_exempt: false, reverse_charge: false, discount_type: null, discount_value: 0,
      discount_amount: 0, subtotal, net_amount: subtotal, vat_amount: vat, total: subtotal + vat,
      deposit_required: true, deposit_percentage: 30, payment_methods: ['bank_transfer'], custom_items: [],
      created_by: IDS.me, created_at: ago(60 * 24 * (10 - n)), updated_at: ago(60 * 24 * (10 - n)), ...x,
    };
  };
  const quotes: Row[] = [
    q(0, { status: 'draft', client_name: 'Federica Russo', client_email: 'federica@example.com', event_name: 'Russo 40th birthday', event_type: 'private_party', event_date: day(40), venue_name: 'Cascina Cuccagna', venue_city: 'Milano', guest_count: 80, base_fee: 1600, travel_fee: 0, sound_included: true, sound_fee: 300, valid_until: day(20) }),
    q(1, { status: 'sent', client_name: 'Northwind Conferences', client_email: 'ops@northwind.example', client_company: 'Northwind', event_name: 'Year-end gala', event_type: 'corporate', event_date: day(52), venue_name: 'Palazzo Clerici', venue_city: 'Milano', guest_count: 300, base_fee: 3800, travel_fee: 0, sound_included: true, sound_fee: 900, sent_at: ago(60 * 24 * 3), valid_until: day(14) }),
    q(2, { status: 'accepted', client_name: 'Giulia Bianchi', client_email: 'giulia@example.com', event_name: 'Giulia & Marco — Wedding', event_type: 'wedding', event_date: day(5), venue_name: 'Villa Necchi', venue_city: 'Milano', guest_count: 140, base_fee: 3200, travel_fee: 0, sound_fee: 0, sent_at: ago(60 * 24 * 40), responded_at: ago(60 * 24 * 35), response_type: 'accepted', converted_to_event_id: id(602) }),
  ];

  const transactions: Row[] = [
    { id: id(1000), band_id: IDS.band, title: 'Summer Fest Opening', amount: 1500, type: 'income', category: 'gig', event_id: id(606), date: day(-5), created_by: IDS.me },
    { id: id(1001), band_id: IDS.band, title: 'Lake Como party', amount: 2200, type: 'income', category: 'gig', event_id: id(607), date: day(-18), created_by: IDS.me },
    { id: id(1002), band_id: IDS.band, title: 'Wedding deposit', amount: 960, type: 'income', category: 'deposit', event_id: id(602), date: day(-30), created_by: IDS.me },
    { id: id(1003), band_id: IDS.band, title: 'Rehearsal room (monthly)', amount: 320, type: 'expense', category: 'rehearsal', date: day(-12), created_by: IDS.me },
    { id: id(1004), band_id: IDS.band, title: 'Van rental', amount: 180, type: 'expense', category: 'travel', event_id: id(607), date: day(-19), created_by: IDS.me },
  ].map((t) => ({ created_at: created, updated_at: created, description: null, ...t }));

  const chats: Row[] = [
    { id: id(1100), band_id: IDS.band, event_id: null, type: 'band', name: 'Velvet Static', created_by: IDS.me, created_at: created, updated_at: ago(12) },
    { id: id(1101), band_id: IDS.band, event_id: id(600), type: 'event', name: 'Rooftop Session', created_by: IDS.me, created_at: created, updated_at: ago(45) },
    { id: id(1102), band_id: IDS.band, event_id: null, type: 'direct', name: null, created_by: IDS.marta, created_at: created, updated_at: ago(60 * 4) },
  ];
  const chat_participants: Row[] = [
    ...members.map((m, i) => ({ id: id(1200 + i), chat_id: id(1100), user_id: m.u, last_read_at: m.u === IDS.me ? ago(60) : ago(5), muted: false, joined_at: created })),
    ...members.map((m, i) => ({ id: id(1210 + i), chat_id: id(1101), user_id: m.u, last_read_at: ago(30), muted: false, joined_at: created })),
    { id: id(1220), chat_id: id(1102), user_id: IDS.me, last_read_at: ago(60 * 4), last_delivered_at: ago(60 * 4), muted: false, joined_at: created },
    // Marta's phone got the reply (✓✓ grey) but she hasn't opened it yet.
    { id: id(1221), chat_id: id(1102), user_id: IDS.marta, last_read_at: ago(60 * 5), last_delivered_at: ago(60 * 3), muted: false, joined_at: created },
  ];
  const msg = (n: number, chat: string, sender: string, content: string, minutesAgo: number): Row => ({
    id: id(1300 + n), chat_id: chat, band_id: IDS.band, sender_id: sender, content, message_type: 'text',
    attachments: [], metadata: {}, edited: false, deleted: false, created_at: ago(minutesAgo),
  });
  const messages: Row[] = [
    msg(0, id(1100), IDS.jonah, 'Load-in is at 17:00 today, right?', 180),
    msg(1, id(1100), IDS.me, 'Yes, 17:00 sharp. Soundcheck at 18:30.', 170),
    msg(2, id(1100), IDS.lena, 'I\'ll bring the Nord and the spare stand.', 95),
    msg(3, id(1100), IDS.sam, 'Can we open with Superstition tonight?', 40),
    msg(4, id(1100), IDS.marta, '+1, then straight into September 🔥', 12),
    msg(5, id(1101), IDS.me, 'Setlist is attached to the event, check the second set order.', 45),
    msg(6, id(1102), IDS.marta, 'Do you have the click track for the new arrangement?', 60 * 5),
    msg(7, id(1102), IDS.me, 'Yes, sending it tonight with the stems.', 60 * 4),
  ];

  const notifications: Row[] = [
    { id: id(1400), user_id: IDS.me, band_id: IDS.band, type: 'event_invite', title: 'New gig: Jazz Club Night', body: 'You have been added to Jazz Club Night. Confirm your availability.', data: { event_id: id(604) }, read: false, priority: 'high', reference_id: id(604), reference_type: 'event', created_at: ago(60 * 2) },
    { id: id(1401), user_id: IDS.me, band_id: IDS.band, type: 'chat_message', title: 'Marta Conti', body: '+1, then straight into September 🔥', data: { chat_id: id(1100) }, read: false, priority: 'normal', reference_id: id(1100), reference_type: 'chat', created_at: ago(12) },
    { id: id(1402), user_id: IDS.me, band_id: IDS.band, type: 'rehearsal_poll', title: 'Vote on rehearsal dates', body: 'Jonah proposed 3 dates for next week.', data: { poll_id: id(1500) }, read: false, priority: 'normal', reference_id: id(1500), reference_type: 'rehearsal_poll', created_at: ago(60 * 20) },
    { id: id(1403), user_id: IDS.me, band_id: IDS.band, type: 'quote_accepted', title: 'Quote accepted', body: 'Giulia Bianchi accepted Q-2026-0014.', data: { quote_id: id(902) }, read: true, priority: 'normal', reference_id: id(902), reference_type: 'quote', created_at: ago(60 * 24 * 35) },
  ].map((n) => ({ archived: false, read_at: null, ...n }));

  const rehearsal_polls: Row[] = [
    { id: id(1500), band_id: IDS.band, created_by: IDS.jonah, creator_role: 'member', title: 'Extra rehearsal next week', notes: 'Need to tighten the wedding set.', status: 'polling', confirmed_event_id: null, created_at: ago(60 * 20), updated_at: ago(60 * 20) },
  ];
  const rehearsal_poll_options: Row[] = [
    { id: id(1510), poll_id: id(1500), proposed_date: day(9), start_time: '19:00', end_time: '22:00', created_at: ago(60 * 20) },
    { id: id(1511), poll_id: id(1500), proposed_date: day(10), start_time: '19:00', end_time: '22:00', created_at: ago(60 * 20) },
    { id: id(1512), poll_id: id(1500), proposed_date: day(12), start_time: '15:00', end_time: '18:00', created_at: ago(60 * 20) },
  ];
  const rehearsal_poll_votes: Row[] = [
    { id: id(1520), poll_id: id(1500), option_id: id(1510), user_id: IDS.jonah, created_at: ago(60 * 19) },
    { id: id(1521), poll_id: id(1500), option_id: id(1510), user_id: IDS.marta, created_at: ago(60 * 10) },
    { id: id(1522), poll_id: id(1500), option_id: id(1511), user_id: IDS.lena, created_at: ago(60 * 8) },
  ];

  const task_templates: Row[] = [
    { id: id(1600), band_id: IDS.band, name: 'Wedding day checklist', description: 'Contract, deposit, first-dance file, load-in', category: 'wedding', tasks: [{ id: 't1', title: 'Contract signed', dueOffset: -30, required: true }, { id: 't2', title: 'Deposit received', dueOffset: -30, required: true }, { id: 't3', title: 'First-dance file from the couple', dueOffset: -14, required: true }, { id: 't4', title: 'Confirm load-in time', dueOffset: -3, required: true }, { id: 't5', title: 'Charge in-ears', dueOffset: -1, required: true }, { id: 't6', title: 'Send final invoice', dueOffset: 1, required: false }], is_default: true, created_by: IDS.me, created_at: created, updated_at: created },
    { id: id(1601), band_id: IDS.band, name: 'Corporate event prep', description: 'Invoice details, AV check, dress code', category: 'corporate', tasks: [{ id: 't1', title: 'Collect invoice details', dueOffset: -14, required: true }, { id: 't2', title: 'AV check with the venue', dueOffset: -5, required: true }, { id: 't3', title: 'Confirm dress code', dueOffset: -3, required: false }], is_default: false, created_by: IDS.me, created_at: created, updated_at: created },
    { id: id(1602), band_id: IDS.band, name: 'Before every rehearsal', description: 'Charts, click tracks, room booking', category: 'rehearsal', tasks: [{ id: 't1', title: 'Book the room', dueOffset: -7, required: true }, { id: 't2', title: 'Share charts', dueOffset: -2, required: true }, { id: 't3', title: 'Update click tracks', dueOffset: -1, required: false }], is_default: true, created_by: IDS.me, created_at: created, updated_at: created },
    { id: id(1603), band_id: IDS.band, name: 'Festival day', description: 'Backline, passes, stage plot', category: 'festival', tasks: [{ id: 't1', title: 'Send stage plot', dueOffset: -14, required: true }, { id: 't2', title: 'Confirm backline', dueOffset: -7, required: true }, { id: 't3', title: 'Collect artist passes', dueOffset: 0, required: true }], is_default: false, created_by: IDS.me, created_at: created, updated_at: created },
  ];
  const contracts: Row[] = [
    { id: id(1700), band_id: IDS.band, event_id: id(602), title: 'Wedding performance agreement', type: 'performance', status: 'signed', event_name: 'Giulia & Marco — Wedding', event_date: day(5), client_name: 'Giulia Bianchi', client_email: 'giulia@example.com', signed_at: ago(60 * 24 * 34), created_by: IDS.me, created_at: created, updated_at: created },
    { id: id(1701), band_id: IDS.band, event_id: null, title: 'Year-end gala agreement', type: 'performance', status: 'sent', event_name: 'Year-end gala', event_date: day(52), client_name: 'Northwind Conferences', client_email: 'ops@northwind.example', signed_at: null, created_by: IDS.me, created_at: created, updated_at: created },
  ];
  const inventory: Row[] = [
    { id: id(1800), band_id: IDS.band, name: 'Nord Stage 4', category: 'keys', quantity: 1, status: 'available', location: 'Lena', created_at: created, updated_at: created },
    { id: id(1801), band_id: IDS.band, name: 'Shure SM58', category: 'microphones', quantity: 4, status: 'available', location: 'Rehearsal room', created_at: created, updated_at: created },
    { id: id(1802), band_id: IDS.band, name: 'In-ear mixer (Behringer P16)', category: 'monitoring', quantity: 1, status: 'in_use', location: 'Alex', created_at: created, updated_at: created },
    { id: id(1803), band_id: IDS.band, name: 'DI boxes', category: 'cables', quantity: 6, status: 'maintenance', location: 'Rehearsal room', created_at: created, updated_at: created },
    ...([
      [1804, 'PA tops 12"', 'Other', 2, 'available', 'Case A'],
      [1805, 'Sub 18"', 'Other', 1, 'available', 'Case B'],
      [1806, 'XR18 mixer', 'Other', 1, 'available', 'Case C'],
      [1807, 'Mic stands', 'Stands', 5, 'available', 'Case D'],
      [1808, 'XLR 10 m', 'Cables', 12, 'available', 'Cable bag'],
      [1809, 'Power strips', 'Cables', 4, 'available', 'Cable bag'],
      [1810, 'LED PAR 54×3W', 'Lighting', 4, 'in_use', 'Alex'],
      [1811, 'Speaker cases', 'Cases', 2, 'available', 'Van'],
      [1812, 'Mic case', 'Cases', 1, 'available', 'Van'],
      [1813, 'Cable bag', 'Cases', 1, 'available', 'Van'],
      [1814, 'Acoustic guitar', 'Instruments', 1, 'available', 'Leo'],
      [1815, 'Cajón', 'Instruments', 1, 'available', 'Marta'],
    ] as const).map(([n, name, category, quantity, status, location]) => ({ id: id(n), band_id: IDS.band, name, category, quantity, status, location, created_at: created, updated_at: created })),
  ];
  // Gear kits (094): a full PA for clubs and weddings, a small acoustic set.
  const gear_kits: Row[] = [
    { id: id(1850), band_id: IDS.band, name: 'Club · full PA', notes: 'Loads in the van in this order: cases, sub, tops.', created_by: IDS.me, created_at: created, updated_at: created },
    { id: id(1851), band_id: IDS.band, name: 'Acoustic duo', notes: null, created_by: IDS.me, created_at: created, updated_at: created },
  ];
  const kitLinks = (kit: number, items: number[]): Row[] =>
    items.map((n, position) => ({ kit_id: id(kit), inventory_id: id(n), band_id: IDS.band, position, created_at: created }));
  const gear_kit_items: Row[] = [
    ...kitLinks(1850, [1804, 1805, 1806, 1802, 1801, 1803, 1807, 1808, 1809, 1810, 1811, 1812, 1813]),
    ...kitLinks(1851, [1814, 1815, 1801, 1807, 1808, 1809, 1812]),
  ];
  const event_gear_kits: Row[] = [
    { event_id: id(602), kit_id: id(1850), band_id: IDS.band, assigned_by: IDS.me, created_at: created },
    { event_id: id(605), kit_id: id(1850), band_id: IDS.band, assigned_by: IDS.me, created_at: created },
  ];
  const onboarding_progress: Row[] = [
    { id: id(1900), user_id: IDS.me, path: 'creator', current_step: 6, completed_steps: ['account', 'profile', 'band', 'members', 'songs', 'done'], skipped_steps: [], checklist_dismissed: true, started_at: created, completed_at: created, duration_seconds: 240 },
  ];

  // Fictional session players (no real people or numbers).
  const band_deputies: Row[] = [
    // On BandWith (086): asked in the app.
    { id: id(2000), band_id: IDS.band, name: 'Sam Keller', instrument: 'Bass', phone: '+10000000001', email: 'sam@example.com', notes: 'Reads charts', default_fee: 180, user_id: id(2090), created_by: IDS.me, created_at: created, updated_at: created },
    { id: id(2001), band_id: IDS.band, name: 'Noa Brandt', instrument: 'Drums', phone: '+10000000002', email: null, notes: null, default_fee: 200, created_by: IDS.me, created_at: created, updated_at: created },
    { id: id(2002), band_id: IDS.band, name: 'Ivo Marsh', instrument: 'Keys', phone: null, email: 'ivo@example.com', notes: 'Own rig', default_fee: null, created_by: IDS.me, created_at: created, updated_at: created },
  ];

  // The demo user plays as a deputy for another (fictional) band: what
  // bw_my_deputy_gigs returns (086). Address kept, shown after a yes.
  const demo_deputy_gigs: Row[] = [
    {
      id: id(2100), token: 'd'.repeat(64), status: 'pending', deputy_name: 'Alex Rivera', role: 'Vocals', fee: 150, currency: 'EUR',
      reply_note: null, responded_at: null, band_name: 'The Late Shift', event_title: 'Jazz Brunch', event_type: 'gig',
      event_date: day(9), start_time: '12:00:00', end_time: '15:00:00', load_in_time: '10:30:00', soundcheck_time: null,
      venue_name: 'Hotel Bristol', venue_city: 'Torino', venue_address: 'Via XX Settembre 48', event_cancelled: false,
      changes: [], before: {}, closed: false,
    },
    {
      id: id(2101), token: 'e'.repeat(64), status: 'available', deputy_name: 'Alex Rivera', role: 'Vocals', fee: 220, currency: 'EUR',
      reply_note: 'I can bring my own mic', responded_at: ago(60 * 24 * 3), band_name: 'The Late Shift', event_title: 'Summer Wedding', event_type: 'gig',
      event_date: day(23), start_time: '19:30:00', end_time: '23:30:00', load_in_time: '16:00:00', soundcheck_time: '17:30:00',
      venue_name: 'Villa Arconati', venue_city: 'Bollate', venue_address: 'Via Madonna Fametta 1', event_cancelled: false,
      changes: ['start'], before: { start: '20:00' }, closed: false,
    },
  ];

  // Other calendars of the band members (their other bands, personal plans):
  // only the free-slot heatmap (095) reads these, as counts.
  const demo_member_busy: Row[] = [
    { user_id: IDS.marta, event_date: day(2), start_time: '20:00', end_time: '23:00' },
    { user_id: IDS.jonah, event_date: day(2), start_time: '18:00', end_time: '22:00' },
    { user_id: IDS.lena, event_date: day(3), start_time: null, end_time: null },
    { user_id: IDS.sam, event_date: day(4), start_time: '21:00', end_time: '23:30' },
    { user_id: IDS.marta, event_date: day(6), start_time: '19:00', end_time: '22:00' },
    { user_id: IDS.jonah, event_date: day(6), start_time: '20:30', end_time: '23:30' },
    { user_id: IDS.lena, event_date: day(6), start_time: '21:00', end_time: '00:00' },
    { user_id: IDS.sam, event_date: day(9), start_time: '12:00', end_time: '16:00' },
    { user_id: IDS.lena, event_date: day(10), start_time: '20:00', end_time: '23:00' },
    { user_id: IDS.marta, event_date: day(11), start_time: null, end_time: null },
    { user_id: IDS.jonah, event_date: day(11), start_time: null, end_time: null },
    { user_id: IDS.sam, event_date: day(13), start_time: '20:00', end_time: '22:00' },
    { user_id: IDS.marta, event_date: day(16), start_time: '21:00', end_time: '23:00' },
    { user_id: IDS.lena, event_date: day(18), start_time: null, end_time: null },
    { user_id: IDS.jonah, event_date: day(20), start_time: '19:00', end_time: '23:00' },
    { user_id: IDS.sam, event_date: day(20), start_time: '19:00', end_time: '23:00' },
    { user_id: IDS.marta, event_date: day(24), start_time: null, end_time: null },
    { user_id: IDS.lena, event_date: day(30), start_time: '20:00', end_time: '22:00' },
  ];

  return {
    band_deputies, event_drafts: [], demo_deputy_gigs, demo_member_busy,
    profiles, bands, band_members, songs, song_folders: [], setlists, setlist_songs, events, event_members,
    rehearsal_setlist, rehearsal_tasks, song_proposals, proposal_votes: [], quotes, quote_musicians: [],
    transactions, chats, chat_participants, messages, notifications, rehearsal_polls, rehearsal_poll_options,
    rehearsal_poll_votes, task_templates, contracts, inventory, gear_kits, gear_kit_items, event_gear_kits, onboarding_progress, member_invites: [],
    push_tokens: [], avatars: [],
  };
};
