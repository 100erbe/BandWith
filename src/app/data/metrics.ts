import { 
  CloudLightning, 
  FileText, 
  RotateCw,
  ListMusic,
  Users,
  Box,
  LayoutTemplate,
  FileSignature,
  type LucideIcon
} from "lucide-react";

// Types
export interface Metrics {
  earnings: { value: string; label: string; trend: string };
  expenses: { value: string; label: string };
  net: { value: string; label: string };
  confirmed: { value: number; label: string; count: number };
  pending: { value: number; label: string; count: number };
  quotes: { value: number; label: string; count: number };
}

export interface SmartInsight {
  id: number;
  type: 'weather' | 'admin' | 'repertoire';
  title: string;
  desc: string;
  action: string;
  icon: LucideIcon;
  color: string;
  textColor: string;
  accent: string;
}

export interface QuickAction {
  id: number;
  label: string;
  icon: LucideIcon;
}

export interface Transaction {
  id: number;
  title: string;
  date: string;
  amount: string;
  type: 'income' | 'expense';
  tag: string;
}

// Data
export const METRICS: Metrics = {
  earnings: { value: "8.3k", label: "Total Revenue", trend: "+12%" },
  expenses: { value: "2.1k", label: "Expenses" },
  net: { value: "6.2k", label: "Net Profit" },
  confirmed: { value: 500, label: "Confirmed", count: 12 },
  pending: { value: 0, label: "Pending", count: 3 },
  quotes: { value: 12.5, label: "Quotes", count: 7 },
};

export const SMART_INSIGHTS: SmartInsight[] = [
  { 
    id: 1, 
    type: "weather", 
    title: "Weather Alert", 
    desc: "Rain expected for Como Wedding", 
    action: "Check Plan B",
    icon: CloudLightning,
    color: "bg-[#1C1C1E]", 
    textColor: "text-white",
    accent: "text-[#D4FB46]"
  },
  { 
    id: 2, 
    type: "admin", 
    title: "Missing Contract", 
    desc: "Wedding - Rossi hasn't signed yet", 
    action: "Resend",
    icon: FileText,
    color: "bg-[#FF4F28]", 
    textColor: "text-white",
    accent: "text-white"
  },
  { 
    id: 3, 
    type: "repertoire", 
    title: "Dust It Off", 
    desc: "'Take Five' not played in 45 days", 
    action: "Add to Setlist",
    icon: RotateCw,
    color: "bg-[#E6E5E1]", 
    textColor: "text-[#1A1A1A]",
    accent: "text-[#1A1A1A]"
  }
];

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 1, label: "Setlist & Repertoire", icon: ListMusic },
  { id: 2, label: "Band Members", icon: Users },
  { id: 3, label: "Inventory", icon: Box },
  { id: 4, label: "Task Templates", icon: LayoutTemplate },
  { id: 5, label: "Contracts & Riders", icon: FileSignature },
];

export const TRANSACTIONS: Transaction[] = [
  { id: 1, title: "Performance Fee", date: "Today, 10:23", amount: "+€500.00", type: "income", tag: "GIG" },
  { id: 2, title: "Equipment Rental", date: "Yesterday", amount: "-€150.00", type: "expense", tag: "GEAR" },
  { id: 3, title: "Spotify Royalties", date: "Jan 20", amount: "+€84.20", type: "income", tag: "ROYALTY" },
  { id: 4, title: "Studio Deposit", date: "Jan 15", amount: "-€200.00", type: "expense", tag: "RENT" },
  { id: 5, title: "Private Party", date: "Jan 10", amount: "+€2,500.00", type: "income", tag: "GIG" },
];
