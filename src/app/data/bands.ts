// Bands data
export interface Band {
  id: number;
  name: string;
  role: 'ADMIN' | 'MEMBER';
  initials: string;
  members: number;
  genre: string;
  plan: 'Free' | 'Pro';
}

export const BANDS: Band[] = [
  { id: 1, name: "BandWith", role: "ADMIN", initials: "BW", members: 4, genre: "Rock", plan: "Pro" },
  { id: 2, name: "Jazz Trio", role: "MEMBER", initials: "JT", members: 3, genre: "Jazz", plan: "Free" },
];
