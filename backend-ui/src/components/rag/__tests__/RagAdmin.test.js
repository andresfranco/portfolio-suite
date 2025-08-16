import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { SnackbarProvider } from 'notistack';
import RagAdmin from '../../rag/RagAdmin';

// Normalize global timers for jsdom
if (typeof global.setInterval === 'undefined') {
  // @ts-ignore
  global.setInterval = window.setInterval.bind(window);
}
if (typeof global.clearInterval === 'undefined') {
  // @ts-ignore
  global.clearInterval = window.clearInterval.bind(window);
}

jest.mock('../../../services/ragAdminApi', () => {
  let metricsQueue = [];
  return {
    __esModule: true,
    default: {
      getSettings: jest.fn(() => Promise.resolve({ data: { settings: {} } })),
      listDeadLetters: jest.fn(() => Promise.resolve({ data: { items: [] } })),
      getMetricsSummary: jest.fn(() => {
        if (metricsQueue.length) {
          return Promise.resolve({ data: metricsQueue.shift() });
        }
        return Promise.resolve({ data: {
          index_jobs_total: 0,
          retire_jobs_total: 0,
          chunks_retired_total: 0,
          reindex_active: false,
          last_reindex_started_at: '2025-08-15T23:40:00Z',
          last_reindex_finished_at: '2025-08-15T23:40:28Z',
        } });
      }),
      reindexAll: jest.fn(() => Promise.resolve({ data: { scheduled: [] } })),
      __setMetricsQueue: (arr) => { metricsQueue = arr; },
    },
  };
});

describe('RagAdmin', () => {
  // Use real timers; we manually drive polling via captured setInterval callback
  afterEach(() => {
    // no-op
  });

  const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  it('shows last finished on load and no spinner', async () => {
    await act(async () => {
      render(
        <SnackbarProvider maxSnack={1}>
          <RagAdmin />
        </SnackbarProvider>
      );
    });
    expect(screen.getByText(/Last reindex finished:/i)).toBeInTheDocument();
    expect(screen.queryByText(/In progress/i)).toBeNull();
  });

  it('stops spinner after backend reports inactive/finished', async () => {
    // Capture and neutralize interval; we rely on the immediate poll to update UI
    const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(() => 1);
    const clearSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});

    const api = (await import('../../../services/ragAdminApi')).default;
    const startedIso = new Date().toISOString();
    const finishedIso = new Date(Date.now() + 1000).toISOString();
    // Seed three calls in order: initial load, baseline (pre-schedule), immediate poll (finished)
    api.__setMetricsQueue([
      // initial load
      { index_jobs_total: 0, retire_jobs_total: 0, chunks_retired_total: 0, reindex_active: false, last_reindex_started_at: startedIso, last_reindex_finished_at: startedIso },
      // baseline before scheduling (content not critical)
      { index_jobs_total: 1, retire_jobs_total: 0, chunks_retired_total: 0, reindex_active: true, last_reindex_started_at: startedIso },
      // immediate poll after scheduling -> finished
      { index_jobs_total: 2, retire_jobs_total: 0, chunks_retired_total: 0, reindex_active: false, last_reindex_started_at: startedIso, last_reindex_finished_at: finishedIso },
    ]);

    await act(async () => {
      render(
        <SnackbarProvider maxSnack={1}>
          <RagAdmin />
        </SnackbarProvider>
      );
    });

    const btn = screen.getByRole('button', { name: /Reindex All/i });
    // After clicking, the component performs an immediate poll (third queued item -> finished)
    await act(async () => {
      fireEvent.click(btn);
    });
    await flushMicrotasks();
    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByText(/Last reindex finished:/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/In progress/i)).toBeNull();

    intervalSpy.mockRestore();
    clearSpy.mockRestore();
  });
});
