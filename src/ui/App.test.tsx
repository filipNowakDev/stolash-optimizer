import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMATEK_TXT } from '../core/fixtures';
import { FACTORY_SETTINGS } from '../core/settings';
import { LocalStore, STORAGE_KEYS } from '../store/LocalStore';
import { App } from './App';

// Loading the real solver is covered in the core tests; here it is unreachable.
vi.mock('./solver', () => ({ loadSolver: () => Promise.reject(new Error('offline')) }));

/** The open result tab, apart from the element list and the print sheet. */
const panel = () => within(screen.getByTestId('results-panel'));

const paste = () => {
  fireEvent.change(screen.getByLabelText('Or paste a table'), {
    target: { value: FORMATEK_TXT },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Load pasted text' }));
};
const generate = () =>
  fireEvent.click(screen.getByRole('button', { name: /^(Generate|Update) cut lists$/ }));

describe('App', () => {
  // These tests are about the screens, so they use the algorithm that needs no download.
  beforeEach(() => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ ...FACTORY_SETTINGS, algorithm: 'optimized' }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('switches language from the header menu and remembers it', () => {
    const store = new LocalStore(localStorage);
    render(<App store={store} />);

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Polski' }));

    expect(screen.getByRole('tab', { name: 'Płyta i piła' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('pl');
    expect(store.loadLocale()).toBe('pl');
  });

  it('starts empty on every visit, keeping the language', () => {
    const store = new LocalStore(localStorage);
    const { unmount } = render(<App store={store} />);
    paste();
    generate();
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Polski' }));
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(2);
    expect(panel().getByRole('columnheader', { name: 'Okleina L1' })).toBeTruthy();
    expect(panel().getAllByRole('cell', { name: 'Obrzeże 0,8 mm' })).toHaveLength(3);

    unmount();
    render(<App store={store} />);
    expect(screen.getAllByText('Brak elementów')).toHaveLength(3);
    expect(screen.queryByTestId('results-panel')).toBeNull();
  });

  it('empties the page when the session is cleared', () => {
    render(<App store={new LocalStore(localStorage)} />);
    paste();
    generate();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear session' }));
    expect(screen.getAllByText('No elements yet')).toHaveLength(3);
    expect(screen.queryByTestId('results-panel')).toBeNull();
  });

  it('switches the shown result with the chosen version', () => {
    const store = new LocalStore(localStorage);
    render(<App store={store} />);
    paste();
    generate();

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0]!.checked).toBe(true);
    fireEvent.click(radios[1]!);
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Waste, m²' }));
    expect(screen.getAllByRole('radio')).toHaveLength(radios.length);
  });

  it('shows results only after Generate and says when they are out of date', () => {
    const store = new LocalStore(localStorage);
    render(<App store={store} />);
    const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
    expect(button('Generate cut lists').disabled).toBe(true);

    paste();
    expect(screen.queryByTestId('results-panel')).toBeNull();
    generate();
    expect(button('Up to date').disabled).toBe(true);

    // A changed setting leaves the old results alone until asked.
    const length = screen.getByLabelText(/Board length/) as HTMLInputElement;
    fireEvent.change(length, { target: { value: '2800' } });
    expect(button('Update cut lists').disabled).toBe(false);
    expect(panel().queryByRole('cell', { name: '2800' })).toBeNull();
    // Putting it back needs no update.
    fireEvent.change(length, { target: { value: '2760' } });
    expect(button('Up to date').disabled).toBe(true);

    fireEvent.change(length, { target: { value: '2800' } });
    generate();
    expect(panel().getAllByRole('cell', { name: '2800' }).length).toBeGreaterThan(0);
  });

  it('offers a choice of packing algorithm that applies on the next generation', () => {
    render(<App store={new LocalStore(localStorage)} />);
    paste();
    generate();
    const select = screen.getByLabelText(/Packing algorithm/) as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['highs', 'optimized', 'ffd']);

    fireEvent.change(select, { target: { value: 'ffd' } });
    generate();
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(2);
  });

  it('uses HiGHS by default and still gives results when it cannot load', async () => {
    localStorage.clear();
    render(<App store={new LocalStore(localStorage)} />);
    expect((screen.getByLabelText(/Packing algorithm/) as HTMLSelectElement).value).toBe('highs');
    paste();
    generate();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(2);
  });

  it('leaves unticked elements out and prints the ticked sections', () => {
    const store = new LocalStore(localStorage);
    render(<App store={store} />);
    paste();

    // Row 6 is part A.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include 6 Przykład A' }));
    generate();
    expect(screen.getByText('Elements: 11 of 12 selected')).toBeTruthy();
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(1);

    // Ticking it again brings it back without a new import.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include 6 Przykład A' }));
    generate();
    expect(panel().getAllByRole('cell', { name: '600' })).toHaveLength(2);

    const sheet = () => document.querySelector('[data-testid="print-sheet"]')!;
    expect(sheet().querySelectorAll('section')).toHaveLength(6);
    // 4 of part A, 10 across-grain, 3 unbanded and 2 mirror strips; the 4 doors come whole.
    expect(sheet().textContent).toContain('strips: 19, whole elements: 4');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Board drawings' }));
    expect(sheet().querySelectorAll('section')).toHaveLength(5);

    expect(sheet().classList.contains('mono')).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Black and white' }));
    expect(sheet().classList.contains('mono')).toBe(true);
  });
});
