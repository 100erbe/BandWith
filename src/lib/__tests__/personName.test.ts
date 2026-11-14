import { describe, it, expect } from 'vitest';
import { realName, personName, personFirstName, personInitials, hasRealName } from '../personName';

describe('personName', () => {
  it('uses the real name', () => {
    expect(personName({ full_name: 'Alex Bianchi', email: 'alex@example.com' })).toBe('Alex Bianchi');
    expect(personFirstName({ full_name: 'Alex Bianchi', email: 'alex@example.com' })).toBe('Alex');
    expect(personInitials({ full_name: 'Alex Bianchi', email: 'alex@example.com' })).toBe('AB');
  });

  it('treats the part before the @ as no name and shows the address', () => {
    const p = { full_name: 'alex.bianchi', email: 'Alex.Bianchi@example.com' };
    expect(realName(p.full_name, p.email)).toBe('');
    expect(hasRealName(p)).toBe(false);
    expect(personName(p)).toBe('Alex.Bianchi@example.com');
    expect(personFirstName(p)).toBe('Alex.Bianchi@example.com');
    expect(personInitials(p)).toBe('AL');
  });

  it('falls back when there is neither', () => {
    expect(personName({ full_name: null, email: null })).toBe('Member');
    expect(personName(undefined, 'Someone')).toBe('Someone');
    expect(personInitials({})).toBe('?');
  });

  it('keeps a name that only looks like part of the address elsewhere', () => {
    expect(personName({ full_name: 'Leo', email: 'leo.m@example.com' })).toBe('Leo');
  });
});
