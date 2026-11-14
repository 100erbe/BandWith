import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const Boom: React.FC<{ value: unknown }> = ({ value }) => <p>{value as React.ReactNode}</p>;

describe('ErrorBoundary', () => {
  it('shows the fallback instead of blanking, and tries again on new data', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary resetKey="bad" fallback={<span>fallback shown</span>}>
        <Boom value={{ en: 'Verse' }} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fallback shown')).toBeTruthy();
    rerender(
      <ErrorBoundary resetKey="good" fallback={<span>fallback shown</span>}>
        <Boom value="Verse" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Verse')).toBeTruthy();
  });
});
