// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Preferences } from '../components/Preferences';

/** The projects folder in Preferences (addendum 34 §9). */
afterEach(() => {
  cleanup();
  delete (window as unknown as { vcwriter?: unknown }).vcwriter;
});

describe('Preferences', () => {
  it('shows the projects folder and changes it', async () => {
    const choose = vi.fn(() => Promise.resolve({ ok: true, data: { path: '/Users/ken/Library/Mobile Documents/com~apple~CloudDocs/VC Writer', canChoose: true } }));
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      projectsFolder: vi.fn(() => Promise.resolve({ ok: true, data: { path: '/Users/ken/Documents/VC Writer', canChoose: true } })),
      chooseProjectsFolder: choose,
    };
    render(<Preferences open onClose={vi.fn()} scheme={'gold' as never} onScheme={vi.fn()} paper={false} onPaper={vi.fn()} />);
    expect(await screen.findByText('/Users/ken/Documents/VC Writer')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Change…' }));
    await waitFor(() => expect(screen.getByText(/CloudDocs\/VC Writer/)).toBeTruthy());
  });
});
