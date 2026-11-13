import { describe, expect, it } from 'vitest';
import { ultimateGuitarSearchUrl } from '../ultimateGuitar';

describe('ultimateGuitarSearchUrl', () => {
  it('searches title and artist', () => {
    expect(ultimateGuitarSearchUrl('Blue Moon & Co', ' Doe ')).toBe(
      'https://www.ultimate-guitar.com/search.php?search_type=title&value=Blue%20Moon%20%26%20Co%20Doe',
    );
    expect(ultimateGuitarSearchUrl('Solo', null)).toMatch(/value=Solo$/);
  });
});
