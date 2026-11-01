/**
 * The native driver must keep ONE connection (foreign keys are per connection)
 * and serialise every statement, transactions included.
 */
import { openExpoSqliteDriver } from '../expoSqlite';

const mockLog: string[] = [];
let mockOpened = 0;
jest.mock('expo-sqlite', () => {
  const delay = () => new Promise((r) => setTimeout(r, 5));
  const db = {
    execAsync: async (sql: string) => {
      await delay();
      mockLog.push(sql);
    },
    runAsync: async (sql: string) => {
      await delay();
      mockLog.push(sql);
      return { changes: 1, lastInsertRowId: 1 };
    },
    getAllAsync: async (sql: string) => (mockLog.push(sql), []),
    getFirstAsync: async (sql: string) => (mockLog.push(sql), null),
    closeAsync: async () => undefined,
    withExclusiveTransactionAsync: () => {
      throw new Error('must not open a second connection');
    },
  };
  return { openDatabaseAsync: async () => (mockOpened++, db) };
});

beforeEach(() => {
  mockLog.length = 0;
});

it('opens one connection with WAL, foreign keys and a busy timeout', async () => {
  await openExpoSqliteDriver('t.db');
  expect(mockOpened).toBe(1);
  expect(mockLog[0]).toMatch(/foreign_keys = ON/);
  expect(mockLog[0]).toMatch(/journal_mode = WAL/);
  expect(mockLog[0]).toMatch(/busy_timeout/);
});

it('runs transactions on the same connection and lets nothing interleave', async () => {
  const d = await openExpoSqliteDriver('t.db');
  mockLog.length = 0;
  const tx = d.transaction(async (t) => {
    await t.run('INSERT a');
    await t.run('INSERT b');
    return 7;
  });
  const outside = d.run('UPDATE outside');
  expect(await tx).toBe(7);
  await outside;
  expect(mockLog).toEqual(['BEGIN IMMEDIATE', 'INSERT a', 'INSERT b', 'COMMIT', 'UPDATE outside']);
});

it('rolls back and rethrows when the work fails', async () => {
  const d = await openExpoSqliteDriver('t.db');
  mockLog.length = 0;
  await expect(
    d.transaction(async (t) => {
      await t.run('INSERT a');
      throw new Error('boom');
    }),
  ).rejects.toThrow('boom');
  expect(mockLog).toEqual(['BEGIN IMMEDIATE', 'INSERT a', 'ROLLBACK']);
  await d.run('AFTER');
  expect(mockLog[mockLog.length - 1]).toBe('AFTER');
});
