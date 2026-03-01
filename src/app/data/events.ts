import { Play, Truck, Volume2, LogOut } from "lucide-react";

// Event types
export type EventStatus = 'CONFIRMED' | 'TENTATIVE' | 'QUOTE' | 'REHEARSAL';

export interface EventItem {
  id: number;
  eventId?: string;
  title: string;
  status: EventStatus;
  date: string;
  time: string;
  location: string;
  price: string;
  members: string[];
  color: string;
  notes?: string;
  createdBy?: string;
  setlistId?: string;
  clientName?: string;
  venueAddress?: string;
  venueCity?: string;
  guests?: number;
  eventType?: string;
  loadInTime?: string;
  soundcheckTime?: string;
  endTime?: string;
}

export interface PendingEvent {
  id: number;
  title: string;
  status: EventStatus;
  time: string;
  location: string;
  price: string;
  members: string[];
  weather: 'rain' | 'sun' | 'cloud';
  temp: string;
  travelTime: string;
  contractSigned: boolean;
}

export interface PendingEventGroup {
  date: string;
  label: string;
  events: PendingEvent[];
}

export interface ConfirmedGig {
  id: number;
  title: string;
  venue: string;
  date: string;
  time: string;
  setlist: string;
  dress: string;
  amount: number;
  daysLeft: number;
  team: string[];
  address: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  timeline: { loadIn: string; soundCheck: string; show: string };
}

// Events data
export const EVENTS_DATA: EventItem[] = [
  { 
    id: 1, 
    title: "Corporate Gala", 
    status: "TENTATIVE", 
    date: "2026-01-20", 
    time: "19:00", 
    location: "Hilton Milan", 
    price: "500", 
    members: ["GB", "CE"],
    color: "bg-yellow-100 text-yellow-700"
  },
  { 
    id: 2, 
    title: "Wedding - Trs", 
    status: "QUOTE", 
    date: "2026-01-26", 
    time: "15:30", 
    location: "Villa Erba", 
    price: "4,840", 
    members: [],
    color: "bg-blue-100 text-blue-700"
  },
  { 
    id: 3, 
    title: "Private Party", 
    status: "TENTATIVE", 
    date: "2026-01-26", 
    time: "16:00", 
    location: "Terrazza Aperol", 
    price: "2,000", 
    members: ["GB", "CE"],
    color: "bg-yellow-100 text-yellow-700"
  },
  { 
    id: 4, 
    title: "Vino Tasting", 
    status: "TENTATIVE", 
    date: "2026-01-26", 
    time: "15:30", 
    location: "Tarallucci", 
    price: "500", 
    members: ["GB", "CE"],
    color: "bg-yellow-100 text-yellow-700"
  },
  { 
    id: 5, 
    title: "Jazz Night", 
    status: "CONFIRMED", 
    date: "2026-02-26", 
    time: "21:00", 
    location: "Blue Note", 
    price: "2,000", 
    members: ["CE", "GB", "JT"],
    color: "bg-green-100 text-green-700"
  },
];

export const PENDING_EVENTS_BY_DATE: PendingEventGroup[] = [
  {
    date: "2026-01-20",
    label: "Today",
    events: [
      { 
        id: 101, 
        title: "Corporate Gala", 
        status: "TENTATIVE", 
        time: "19:00", 
        location: "Hilton Milan", 
        price: "500", 
        members: ["GB", "CE"],
        weather: "rain",
        temp: "12°",
        travelTime: "25 min",
        contractSigned: false
      }
    ]
  },
  {
    date: "2026-01-26",
    label: "Next Week",
    events: [
      { 
        id: 102, 
        title: "Wedding - Trs", 
        status: "QUOTE", 
        time: "15:30", 
        location: "Villa Erba", 
        price: "4,840", 
        members: [],
        weather: "sun",
        temp: "24°",
        travelTime: "45 min",
        contractSigned: false
      },
      { 
        id: 103, 
        title: "Private Party", 
        status: "TENTATIVE", 
        time: "16:00", 
        location: "Terrazza Aperol", 
        price: "2,000", 
        members: ["GB", "CE"],
        weather: "cloud",
        temp: "18°",
        travelTime: "15 min",
        contractSigned: true
      }
    ]
  }
];

export const CONFIRMED_GIGS: ConfirmedGig[] = [
  { 
    id: 1, 
    title: "Jazz Night", 
    venue: "Blue Note", 
    date: "Jan 26", 
    time: "21:00", 
    setlist: "Standard Set A", 
    dress: "Black Tie", 
    amount: 2000, 
    daysLeft: 5, 
    team: ["GB", "JT", "RS"],
    address: "Via Pietro Borsieri 37, Milano",
    contactName: "Marco (Dir. Artistico)",
    contactPhone: "+39 333 1234567",
    notes: "Load-in is strictly via the back door. Drums provided.",
    timeline: { loadIn: "17:00", soundCheck: "18:30", show: "21:00" }
  },
  { 
    id: 2, 
    title: "Wedding - Trs", 
    venue: "Villa Erba", 
    date: "Feb 14", 
    time: "15:30", 
    setlist: "Wedding Classic", 
    dress: "Formal", 
    amount: 4840, 
    daysLeft: 24, 
    team: ["GB", "JT", "WB", "RS"],
    address: "Largo Luchino Visconti 4, Cernobbio",
    contactName: "Laura (Wedding Planner)",
    contactPhone: "+39 333 9876543",
    notes: "Outdoor ceremony if sunny. Bring white cables.",
    timeline: { loadIn: "13:00", soundCheck: "14:00", show: "15:30" }
  },
  { 
    id: 3, 
    title: "Vino Tasting", 
    venue: "Tarallucci", 
    date: "Feb 20", 
    time: "18:00", 
    setlist: "Acoustic Vibes", 
    dress: "Smart Casual", 
    amount: 500, 
    daysLeft: 30, 
    team: ["GB", "JT"], 
    address: "Via Roma 1, Firenze", 
    contactName: "Luigi", 
    contactPhone: "123", 
    notes: "Small PA provided", 
    timeline: { loadIn: "17:00", soundCheck: "17:30", show: "18:00" } 
  },
  { 
    id: 4, 
    title: "Corporate Event", 
    venue: "City Life", 
    date: "Mar 05", 
    time: "20:00", 
    setlist: "Party Mix", 
    dress: "Casual", 
    amount: 1500, 
    daysLeft: 43, 
    team: ["GB", "JT", "WB"], 
    address: "Piazza Tre Torri, Milano", 
    contactName: "Sara", 
    contactPhone: "456", 
    notes: "ID required for entry", 
    timeline: { loadIn: "18:00", soundCheck: "19:00", show: "20:00" } 
  },
];

export const EVENT_FILTERS = ["All", "Confirmed", "Rehearsal"];

// Helper function to get timeline icons
export const getTimelineIcons = () => ({
  Play,
  Truck,
  Volume2,
  LogOut
});
