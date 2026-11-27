import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FORMATEK_TXT } from '../core/fixtures';
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

    expect(screen.getByText('Parametry')).toBeTruthy();
    expect(document.documentElement.lang).toBe('pl');
    expect(store.loadLocale()).toBe('pl');
  });

  it('imports a pasted table, then keeps the result across reload and language switch', () => {
    const store = new LocalStore(localStorage);
    const { unmount } = render(<App store={store} />);

    fireEvent.change(screen.getByLabelText('Or paste a table'), {
      target: { value: FORMATEK_TXT },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load pasted text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and calculate' }));
    expect(screen.getByRole('cell', { name: '599.2' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '614' })).toBeTruthy();

    unmount();
    render(<App store={store} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(screen.getByRole('cell', { name: '599,2' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Okleina L1' })).toBeTruthy();
    expect(screen.getAllByRole('cell', { name: 'Obrzeże 0,8 mm' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść sesję' }));
    expect(screen.queryByRole('cell', { name: '599,2' })).toBeNull();
  });
});
