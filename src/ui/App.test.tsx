import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalStore } from '../store/LocalStore';
import { App } from './App';

describe('App', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('switches language from the header menu and remembers it', () => {
    const store = new LocalStore(localStorage);
    render(<App store={store} />);

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Polski' }));

    expect(screen.getByText('Import nie jest jeszcze zaimplementowany.')).toBeTruthy();
    expect(document.documentElement.lang).toBe('pl');
    expect(store.loadLocale()).toBe('pl');
  });
});
