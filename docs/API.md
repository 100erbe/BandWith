# BandWith API Documentation

This document describes the services layer that interfaces with Supabase.

## Table of Contents

- [Authentication](#authentication)
- [Bands Service](#bands-service)
- [Events Service](#events-service)
- [Quotes Service](#quotes-service)
- [Songs Service](#songs-service)
- [Chats Service](#chats-service)
- [Transactions Service](#transactions-service)
- [Rehearsals Service](#rehearsals-service)
- [Notifications Service](#notifications-service)
- [Push Notifications](#push-notifications)

---

## Authentication

Authentication is handled via Supabase Auth in `src/lib/AuthContext.tsx`.

### Available Methods

| Method | Description |
|--------|-------------|
| `signIn(email, password)` | Sign in with email/password |
| `signUp(email, password, metadata)` | Create a new account |
| `signOut()` | Sign out current user |
| `resetPassword(email)` | Send password reset email |
| `refreshProfile()` | Refresh user profile data |

### Usage

```tsx
import { useAuth } from '@/lib/AuthContext';

const { user, profile, signIn, signOut } = useAuth();
```

---

## Bands Service

Location: `src/lib/services/bands.ts`

### Functions

#### `getBands()`
Get all bands for the current user.

```typescript
const { data, error } = await getBands();
// Returns: BandWithMembers[]
```

#### `getBand(bandId: string)`
Get a single band by ID.

```typescript
const { data, error } = await getBand('band-uuid');
// Returns: BandWithMembers
```

#### `createBand(data)`
Create a new band.

```typescript
const { data, error } = await createBand({
  name: 'My Band',
  genre: 'Rock',
  plan: 'free'
});
// Returns: Band
```

#### `updateBand(bandId, updates)`
Update band details.

```typescript
const { data, error } = await updateBand('band-uuid', {
  name: 'New Name',
  description: 'Updated description'
});
```

#### `getBandMembers(bandId)`
Get all members of a band.

```typescript
const { data, error } = await getBandMembers('band-uuid');
// Returns: BandMember[]
```

#### `inviteMember(bandId, email, role)`
Invite a new member to the band.

```typescript
const { data, error } = await inviteMember('band-uuid', 'user@example.com', 'member');
```

#### `removeMember(memberId)`
Remove a member from the band.

```typescript
const { error } = await removeMember('member-uuid');
```

---

## Events Service

Location: `src/lib/services/events.ts`

### Types

```typescript
type EventType = 'gig' | 'rehearsal' | 'wedding' | 'corporate' | 'private' | 'festival' | 'other';
type EventStatus = 'draft' | 'tentative' | 'confirmed' | 'cancelled' | 'completed';
```

### Functions

#### `getEvents(bandId, options?)`
Get events for a band with optional filters.

```typescript
const { data, error } = await getEvents('band-uuid', {
  status: 'confirmed',
  eventType: 'gig',
  fromDate: '2024-01-01',
  toDate: '2024-12-31',
  limit: 10
});
```

#### `getEvent(eventId)`
Get a single event with members.

```typescript
const { data, error } = await getEvent('event-uuid');
// Returns: EventWithMembers
```

#### `createEvent(eventData)`
Create a new event.

```typescript
const { data, error } = await createEvent({
  band_id: 'band-uuid',
  title: 'Jazz Night',
  event_type: 'gig',
  event_date: '2024-06-15',
  status: 'tentative'
});
```

#### `getEventStats(bandId, year?)`
Get event statistics for a band.

```typescript
const { data, error } = await getEventStats('band-uuid', 2024);
// Returns: { totalEvents, confirmedEvents, totalRevenue, upcomingEvents, revenueChange }
```

---

## Quotes Service

Location: `src/lib/services/quotes.ts`

### Functions

#### `getQuotes(bandId, options?)`
Get quotes for a band.

```typescript
const { data, error } = await getQuotes('band-uuid', {
  status: 'sent',
  limit: 20
});
```

#### `createQuote(quoteData)`
Create a new quote.

```typescript
const { data, error } = await createQuote({
  band_id: 'band-uuid',
  client_name: 'John Doe',
  event_type: 'wedding',
  event_date: '2024-08-20',
  total_amount: 2500
});
```

#### `updateQuoteStatus(quoteId, status)`
Update quote status.

```typescript
const { data, error } = await updateQuoteStatus('quote-uuid', 'accepted');
```

#### `convertQuoteToEvent(quoteId)`
Convert an accepted quote to an event.

```typescript
const { data, error } = await convertQuoteToEvent('quote-uuid');
// Returns: Event
```

---

## Songs Service

Location: `src/lib/services/songs.ts`

### Functions

#### `getSongs(bandId)`
Get all songs for a band.

```typescript
const { data, error } = await getSongs('band-uuid');
// Returns: Song[]
```

#### `createSong(songData)`
Add a new song to the repertoire.

```typescript
const { data, error } = await createSong({
  band_id: 'band-uuid',
  title: 'Superstition',
  artist: 'Stevie Wonder',
  bpm: 95,
  key: 'Eb minor'
});
```

#### `getSetlists(bandId)`
Get all setlists for a band.

```typescript
const { data, error } = await getSetlists('band-uuid');
// Returns: Setlist[]
```

---

## Chats Service

Location: `src/lib/services/chats.ts`

### Types

```typescript
type ChatType = 'direct' | 'group' | 'band' | 'event';
```

### Functions

#### `getChats(bandId?)`
Get all chats for the user.

```typescript
const { data, error } = await getChats('band-uuid');
// Returns: ChatWithDetails[]
```

#### `getMessages(chatId, options?)`
Get messages for a chat.

```typescript
const { data, error } = await getMessages('chat-uuid', {
  limit: 50,
  before: '2024-01-01T00:00:00Z'
});
```

#### `sendMessage(chatId, content)`
Send a message to a chat.

```typescript
const { data, error } = await sendMessage('chat-uuid', 'Hello!');
```

#### `subscribeToChat(chatId, onMessage)`
Subscribe to real-time messages.

```typescript
const unsubscribe = subscribeToChat('chat-uuid', (message) => {
  console.log('New message:', message);
});

// Later: unsubscribe();
```

---

## Transactions Service

Location: `src/lib/services/transactions.ts`

### Functions

#### `getTransactions(bandId, options?)`
Get transactions for a band.

```typescript
const { data, error } = await getTransactions('band-uuid', {
  type: 'income',
  fromDate: '2024-01-01',
  limit: 50
});
```

#### `createTransaction(data)`
Create a new transaction.

```typescript
const { data, error } = await createTransaction({
  band_id: 'band-uuid',
  title: 'Gig Payment',
  amount: 500,
  type: 'income',
  category: 'GIG',
  date: '2024-06-15'
});
```

#### `getFinancialStats(bandId, year?)`
Get financial statistics.

```typescript
const { data, error } = await getFinancialStats('band-uuid', 2024);
// Returns: { totalIncome, totalExpenses, netProfit }
```

---

## Rehearsals Service

Location: `src/lib/services/rehearsals.ts`

### Functions

#### `getRehearsalTasks(eventId)`
Get tasks for a rehearsal.

```typescript
const { data, error } = await getRehearsalTasks('event-uuid');
// Returns: RehearsalTask[]
```

#### `createRehearsalTask(task)`
Create a rehearsal task.

```typescript
const { data, error } = await createRehearsalTask({
  event_id: 'event-uuid',
  title: 'Bring chart for Spain',
  assigned_to: 'user-uuid',
  is_completed: false
});
```

#### `getSongProposals(eventId)`
Get song proposals for a rehearsal.

```typescript
const { data, error } = await getSongProposals('event-uuid');
// Returns: SongProposal[]
```

#### `getRehearsalSetlist(eventId)`
Get the setlist for a rehearsal.

```typescript
const { data, error } = await getRehearsalSetlist('event-uuid');
// Returns: RehearsalSetlistItem[]
```

---

## Notifications Service

Location: `src/lib/services/notifications.ts`

### Functions

#### `getNotifications(options?)`
Get notifications for the user.

```typescript
const { data, error } = await getNotifications({
  unreadOnly: true,
  limit: 20
});
```

#### `markAsRead(notificationId)`
Mark a notification as read.

```typescript
const { error } = await markAsRead('notification-uuid');
```

#### `markAllAsRead()`
Mark all notifications as read.

```typescript
const { error } = await markAllAsRead();
```

---

## Push Notifications

Location: `src/lib/services/pushNotifications.ts`

### Functions

#### `initializePushNotifications(listeners)`
Initialize push notifications on mobile.

```typescript
const success = await initializePushNotifications({
  onRegistration: (token) => console.log('Token:', token.value),
  onPushReceived: (notification) => console.log('Push:', notification),
  onPushActionPerformed: (action) => console.log('Action:', action)
});
```

#### `checkPushPermissions()`
Check current permission status.

```typescript
const status = await checkPushPermissions();
// Returns: 'granted' | 'denied' | 'prompt' | 'unavailable'
```

#### `requestPushPermissions()`
Request push notification permissions.

```typescript
const granted = await requestPushPermissions();
```

### React Hook

```typescript
import { usePushNotifications } from '@/app/hooks/usePushNotifications';

const {
  isSupported,
  permissionStatus,
  token,
  lastNotification,
  initialize
} = usePushNotifications();
```

---

## Error Handling

All service functions return an object with `data` and `error`:

```typescript
const { data, error } = await someServiceFunction();

if (error) {
  console.error('Error:', error.message);
  return;
}

// Use data safely
console.log('Success:', data);
```

---

## Real-time Subscriptions

Several services support real-time updates via Supabase Realtime:

- `subscribeToChat(chatId, onMessage)` - Chat messages
- `subscribeToRehearsalTasks(eventId, onUpdate)` - Rehearsal tasks
- `subscribeToSongProposals(eventId, onUpdate)` - Song proposals

Always unsubscribe when the component unmounts:

```typescript
useEffect(() => {
  const unsubscribe = subscribeToChat(chatId, handleNewMessage);
  return () => unsubscribe();
}, [chatId]);
```
