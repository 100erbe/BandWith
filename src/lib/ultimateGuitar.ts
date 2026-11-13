/**
 * "Open in Ultimate Guitar": a search for the song (title + artist) on
 * ultimate-guitar.com, which opens the Ultimate Guitar app when installed.
 * Nothing is imported or stored: the user reads the tabs there.
 */
export const ultimateGuitarSearchUrl = (title: string, artist?: string | null) => {
  const q = [title, artist].map((s) => (s || '').trim()).filter(Boolean).join(' ');
  return `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`;
};
