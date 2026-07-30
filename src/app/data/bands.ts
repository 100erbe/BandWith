// Bands data types
export interface Band {
  id: number;
  name: string;
  role: 'ADMIN' | 'MEMBER';
  initials: string;
  members: number;
  genre: string;
  plan: 'Free' | 'Pro';
}
