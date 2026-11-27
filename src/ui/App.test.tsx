import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FORMATEK_TXT } from '../core/fixtures';
import { LocalStore } from '../store/LocalStore';
import { App } from './App';

/** The open result tab, apart from the element list and the print sheet. */
const panel = () => within(screen.getByRole('tabpanel'));

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
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(2);
    expect(panel().getByRole('cell', { name: '650' })).toBeTruthy();

    unmount();
    render(<App store={store} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(2);
    expect(panel().getByRole('columnheader', { name: 'Okleina L1' })).toBeTruthy();
    expect(panel().getAllByRole('cell', { name: 'Obrzeże 0,8 mm' })).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść sesję' }));
    expect(screen.queryByRole('tabpanel')).toBeNull();
  });

  it('switches the shown result with the chosen version', () => {
    const store = new LocalStore(localStorage);
    render(<App store={store} />);
    fireEvent.change(screen.getByLabelText('Or paste a table'), {
      target: { value: FORMATEK_TXT },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load pasted text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and calculate' }));

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0]!.checked).toBe(true);
    fireEvent.click(radios[1]!);
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);
    expect(store.loadSession()!.version).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Waste, m²' }));
    expect(screen.getAllByRole('radio')).toHaveLength(radios.length);
  });

  it('leaves unticked elements out and prints the ticked sections', () => {
    const store = new LocalStore(localStorage);
    render(<App store={store} />);
    fireEvent.change(screen.getByLabelText('Or paste a table'), {
      target: { value: FORMATEK_TXT },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load pasted text' }));

    // Row 6 is the boki.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include 6 Boki szafy po lewej' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and calculate' }));
    expect(screen.getByText('Elements: 11 of 12 selected')).toBeTruthy();
    expect(store.loadSession()!.excluded).toEqual([5]);
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(1);

    // Ticking it again brings it back without a new import.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include 6 Boki szafy po lewej' }));
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(2);

    const sheet = () => document.querySelector('[data-testid="print-sheet"]')!;
    expect(sheet().querySelectorAll('section')).toHaveLength(6);
    // 4 boki, 10 across-grain, 3 unbanded and 2 mirror strips; the 4 doors come whole.
    expect(sheet().textContent).toContain('strips: 19, whole elements: 4');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Board drawings' }));
    expect(sheet().querySelectorAll('section')).toHaveLength(5);
  });
});
