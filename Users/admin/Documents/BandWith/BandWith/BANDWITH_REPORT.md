# BandWith — AI Handover Report

## Overview

BandWith is a **full-stack mobile-first web application** for band management. It helps musicians and band managers handle scheduling, finances, communication, repertoire, inventory, quotes/contracts, rehearsals, and onboarding — all within a single app. It uses **React (Vite) + TypeScript** frontend with **Supabase** as the backend (PostgreSQL database + Auth + Realtime).

---

## 🏗 Architecture

### Frontend
- **Framework:** React 18 + TypeScript
- **Build tool:** Vite 6
- **Routing:** None (SPA with view switching via state in `AuthenticatedApp.tsx`)
- **Animations:** `motion/react` (Framer Motion v11)
- **UI Library:** Tailwind CSS + shadcn/ui components
- **State Management:** React Context (AuthContext, BandContext, OnboardingContext)
- **Font:** Inter (via @fontsource/inter)

### Backend
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Auth (email/password + magic link)
- **Realtime:** Supabase Realtime (for chat)
- **Push:** Capacitor Push Notifications (native)
- **File Storage:** Not yet implemented (avatar URLs stored but no upload flow)

### Project Structure
```
src/
├── app/
│   ├── App.tsx                  # Root wrapper
│   ├── AuthenticatedApp.tsx     # Main app shell (7000+ lines, the central hub)
│   ├── components/
│   │   ├── dashboard/           # Event cards, create event modal, event detail
│   │   │   └── expanded/        # Expanded dashboard cards (finance, pending, quotes, etc.)
│   │   ├── chat/                # Chat components (NewChatModal)
│   │   ├── layout/              # Bottom nav, header, identity hub, control deck
│   │   ├── navigation/          # NavButton
│   │   ├── notifications/       # Notification detail modal, RSVP sheet
│   │   ├── onboarding/          # Full onboarding flow (sign up, create band, invite)
│   │   ├── profile/             # Edit profile, create band modals
│   │   ├── quotes/              # Quote creation wizard, detail modal
│   │   ├── rehearsal/           # Full rehearsal management (creation wizard, live view, proposals, tasks, setlist)
│   │   └── ui/                  # ~50 shadcn/ui components + custom (BrandLogo, Logo, etc.)
│   ├── data/                    # Static/mock data and TypeScript interfaces
│   ├── hooks/                   # Custom hooks (useCardExpand, useData, usePushNotifications, etc.)
│   ├── types/                   # Shared app types (TabName, ExpandedCardType, CreateEventType)
│   └── views/                   # Page-level components (Home, Events, Chat, Analytics, etc.)
├── lib/
│   ├── AuthContext.tsx          # Auth state management
│   ├── BandContext.tsx          # Band selection + role management
│   ├── OnboardingContext.tsx    # Onboarding flow state
│   ├── supabase.ts             # Supabase client initialization
│   └── services/                # Data service layer (CRUD operations)
│       ├── bands.ts             # Bands CRUD + member management
│       ├── events.ts            # Events CRUD + dashboard stats
│       ├── chats.ts             # Chats + messages CRUD + search
│       ├── songs.ts             # Songs + setlists CRUD
│       ├── quotes.ts            # Quotes CRUD
│       ├── notifications.ts     # Notifications CRUD
│       ├── transactions.ts      # Financial transactions CRUD
│       ├── rehearsals.ts        # Rehearsal CRUD
│       └── pushNotifications.ts # Capacitor push notification setup
├── db/
│   └── master_schema.sql        # Full database schema (18 tables)
├── styles/                      # Global styles, motion variants
└── main.tsx                     # Entry point
```

---

## 📋 Features

### 1. Authentication & Onboarding
- **Sign in / Sign up** via email/password
- **Forgot password** flow
- **Magic link** support
- **Full onboarding flow:** Account creation → Profile setup → Create/Join band → Add songs → Invite members
- **Invitation system:** Users can be invited by email, accept via token link
- **Session management** via Supabase Auth

### 2. Band Management
- **Multiple bands** per user with identity switching
- **Role-based access:** `admin` vs `member`
  - Admins can edit/delete bands, manage members, delete events
  - Members can view and create content but not delete critical data
- **Band member list** with profiles, roles, instruments
- **Band switching** via Identity Hub (slide-up panel)

### 3. Dashboard (Home)
- **Stats grid:** Gigs confirmed, upcoming rehearsals, pending quotes, estimated revenue
- **Event cards:** color-coded by type (rehearsal = yellow/green, quote = brown, draft = dark, confirmed = green)
- **Expanded cards:** Tappable cards that expand full-screen with detailed views:
  - Finance (transactions overview)
  - Pending items
  - Quotes pipeline
  - Confirmed gigs
  - Rehearsals
  - Fee tracking

### 4. Events
- **Create/edit events** with full detail form
- **Event types:** gig, rehearsal, quote, draft
- **Event detail view** with sections by type
- **Member assignment** with fees and RSVP status
- **Event filtering** (All, Gigs, Rehearsals, Quotes, Draft)
- **Setlist assignment** per event

### 5. Quotes
- **Full quote creation wizard** with multiple steps:
  1. Client info + event details
  2. Location (venue)
  3. Performance type + duration + musicians
  4. Billing & VAT (with European VAT handling)
  5. Pricing (base fee, travel, accommodation, meals, sound)
  6. Line items + custom fees
  7. Preview & send
- **Quote status pipeline:** Draft → Sent → Accepted/Negotiating → Declined/Expired/Archived
- **Quote detail modal** with mini calendar, discount display

### 6. Rehearsals
- **Full rehearsal creation wizard:**
  1. Type (single/recurring) + date/time
  2. Location
  3. Member availability
  4. Song proposals
  5. Task assignments
  6. Setlist building
  7. Cost tracking
  8. Review & confirm
- **Live rehearsal mode** with song playback tracking (played/playing/pending/skipped)
- **Post-rehearsal notes**
- **Recurring rehearsal support** with cadence (daily/weekly/biweekly/monthly)

### 7. Chat & Communication
- **Real-time chat** via Supabase Realtime
- **Chat types:** direct, band, event
- **Message search** across all chats
- **Unread count** tracking
- **Chat creation** with member selection
- **Push notifications** for new messages

### 8. Notifications
- **System notifications** for events, invites, etc.
- **Notification detail modal** with contextual actions
- **Event RSVP** sheet (accept/decline/tentative)
- **Calendar integration** (add to device calendar)

### 9. Music Library (Repertoire)
- **Song management** with title, artist, duration, BPM, key, genre, category
- **Status tracking:** learning → ready → archived
- **Priority levels:** high, medium, low
- **Spotify/Apple Music/YouTube links**
- **Times played** tracking

### 10. Setlists
- **Create setlists** with ordered songs
- **Assign setlists to events/rehearsals**
- **Setlist templates** for reuse

### 11. Inventory
- **Item management** with name, quantity, status (available/in_use/maintenance/lost), notes, category
- **Search & filter**
- **CRUD operations**

### 12. Financial Tracking
- **Transactions** (income/expense) with categories (GIG, ROYALTY, GEAR, RENT, TRAVEL, OTHER)
- **Revenue analytics** with change percentage
- **Member fee tracking** per event
- **Quote-to-revenue pipeline**

### 13. Contracts & Documents
- **Contract storage** per band
- **Task templates** with categories (gig, rehearsal, meeting, other)

### 14. Settings
- **Profile editing**
- **Notification preferences**
- **Appearance settings**
- **Language selection**
- **Privacy settings**
- **Account deletion**

### 15. UI/UX Features
- **Custom animations** throughout (motion/react)
- **Safe area handling** for mobile notches
- **Pull-to-refresh**
- **Infinite scroll pagination**
- **Role-based theme colors** (admin = yellow, member = neutral)
- **Connection status indicators**
- **Control Deck** (quick actions panel from bottom)
- **Identity Hub** (slide-up band/notification center)

---

## 🗄 Database Schema (18 Tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profiles linked to auth.users | id, email, full_name, avatar_url, role, instrument |
| `bands` | Band entities | id, name, slug, logo_url, description, created_by |
| `band_members` | User-band membership with roles | band_id, user_id, role (admin/member), instrument, default_fee |
| `invitations` | Pending member invitations | band_id, email, role, status, token |
| `events` | Gigs, rehearsals, drafts | band_id, title, event_type, status, date, venue, fee |
| `event_members` | Member-event assignments | event_id, user_id, role, fee, status (confirmed/pending) |
| `songs` | Music library | band_id, title, artist, duration, bpm, key, status, priority |
| `setlists` | Ordered song lists | band_id, name, event_id, is_template |
| `setlist_songs` | Song-to-setlist mapping | setlist_id, song_id, position, notes |
| `quotes` | Client quotes | band_id, client info, event details, pricing, VAT |
| `contracts` | Contracts/documents | band_id, title, content, status |
| `inventory` | Band equipment | band_id, name, quantity, status |
| `task_templates` | Reusable task templates | band_id, name, category, tasks (JSON) |
| `transactions` | Financial records | band_id, title, amount, type, category, date |
| `notifications` | System notifications | user_id, type, title, body, data (JSON) |
| `chats` | Chat conversations | band_id, event_id, name, type, created_by |
| `chat_participants` | Chat membership | chat_id, user_id, last_read_at, muted |
| `messages` | Chat messages | chat_id, sender_id, content, reply_to |
| `onboarding_progress` | Onboarding state per user | user_id, step, completed |

---

## 🔐 Authorization (RLS)

**Status: ✅ Enabled on all tables** (as of last session)

### RLS Policy Rules
- **Band-scoped data:** Most tables use `band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())`
- **Admin privileges:** Certain destructive operations require `role = 'admin'` in band_members
- **Chat messages:** Scoped to chat participants via `chat_participants` join
- **Notifications:** Scoped to `user_id = auth.uid()`
- **Profiles:** Self + band members can view each other
- **Onboarding:** Own progress only

### Authorization Checks (Frontend)
- `BandContext.isAdmin` — derived from `band_members.role`
- `BandContext.currentMemberRole` — `'admin' | 'member' | null`
- UI conditionally shows admin-only actions (delete events, manage members, etc.)

### RLS SQL Script
Located at `supabase/enable_rls_fixed.sql` — includes all 18 tables with full policies.

---

## ✅ Current Build Status

### TypeScript Errors: **0**
All ~55 TypeScript errors have been resolved:
- Missing exports (InventoryView)
- Type mismatches (EventStatus, Quote, Song types)
- Framer Motion type issues (variants, transitions)
- RefObject nullability
- Supabase query type casting
- shadcn/ui React 19 ref type conflicts

### Build: **✅ Passes**
```
✓ 2181 modules transformed
✓ built in 5.91s
```

### Runtime: **App loads and renders** on http://localhost:5173

---

## 🐛 Known Issues / Future Work

### Critical
- None currently. App builds and runs.

### Moderate
1. **AuthenticatedApp.tsx is ~7000+ lines** — should be refactored into smaller modules
2. **Some mock/static data** in `src/app/data/` is used as fallback when Supabase data is unavailable
3. **File upload** (avatars, documents) not yet implemented — URLs stored but no upload UI
4. **Push notifications** need proper Firebase/APNs setup for production

### Minor
5. **shadcn/ui components** were upgraded to a newer version that uses React 19 ref patterns — works but has type mismatches (fixed with `as any`)
6. **Some views** use inline styles extensively instead of Tailwind classes
7. **Rehearsal types** are defined locally in `components/rehearsal/types.ts` while song types are in `services/songs.ts` — some duplication
8. **Quote types** differ between `data/quotes.ts` (camelCase) and `services/quotes.ts` (snake_case) — requires manual mapping

---

## 🔧 How to Run

```bash
cd BandWith
pnpm install
pnpm run dev  # Vite dev server on :5173
pnpm run build  # Production build
```

## 🌐 Environment Variables (`.env`)
```
VITE_SUPABASE_URL=https://oakhbfdhesktokscqxqo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🧪 Key Service Dependencies
- **@capacitor/core** + **@capacitor/push-notifications** — Native push
- **@fontsource/inter** — Font
- **lucide-react** — Icons
- **motion** (framer-motion v11) — Animations
- **react-day-picker** — Calendar
- **recharts** — Charts/analytics
- **sonner** — Toast notifications
- **supabase-js** — Backend client
- **vaul** — Drawer component
- **@radix-ui/react-*** — Many shadcn/ui primitives

---

## 🎯 Recommended Next Steps for Another AI

1. **Refactor `AuthenticatedApp.tsx`** — Split into smaller focused components. It handles view routing, state management, modals, and event handling all in one file.
2. **Create proper file upload** — Avatars, contract documents, song charts.
3. **Add proper error boundaries** — Graceful fallbacks for failed API calls.
4. **Set up E2E tests** — Critical flows: signup → create band → create event → chat.
5. **Migrate to React Router** — For proper URL-based navigation instead of state-based.
6. **Audit unused components** — Many shadcn/ui components are imported but not used.
7. **Standardize type naming** — `Quote` in data vs services is confusing.
