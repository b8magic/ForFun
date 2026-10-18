import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import { DATE_ONLY } from '@/domain/timing';
import type { Category, Session } from '@/domain/types';
import { DaySessionRow } from '@/places/time/DaySessionRow';
import { DaySessions } from '@/places/time/DaySessions';
import { deleteSession, selectBulkDay, toggleBulkSession } from '@/state/actions';
import { useApp } from '@/state/store';
import { BulkDaySheet } from '../BulkDaySheet';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), canGoBack: () => true, back: jest.fn(), replace: jest.fn() } }));
jest.mock('@/ui/useTheme', () => ({ useSurface: () => jest.requireActual('@/ui/theme').surfaces.calm }));
jest.mock('@/state/actions', () => ({ deleteSession: jest.fn(), selectBulkDay: jest.fn(), toggleBulkSession: jest.fn() }));
jest.mock('@/ui/Toast', () => ({ ToastContent: () => null }));
jest.mock('react-native-gesture-handler', () => ({ Pressable: jest.requireActual('react-native').Pressable }));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ children }: { children: React.ReactNode }) => React.createElement(View, {}, children) };
});
jest.mock('@/ui/controls', () => {
  const React = jest.requireActual('react');
  const { View, Pressable, Text } = jest.requireActual('react-native');
  return {
    Sheet: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => React.createElement(View, {}, children, footer),
    Button: ({ label, ...props }: { label: string }) => React.createElement(Pressable, props, React.createElement(Text, {}, label)),
  };
});

const surf: Category = { id: 'surf', name: 'Surf', color: '#FF4D1F', pattern: 'swell', sortOrder: 0, createdAt: 'a', updatedAt: 'a' };
const corsa: Category = { ...surf, id: 'corsa', name: 'Corsa', color: '#A1CD5C', sortOrder: 1 };
const bare: Session = { id: 'surf-bare', categoryId: surf.id, date: '2026-10-08', timing: DATE_ONLY, notes: null, place: null, origin: 'manual', saveRequestId: null, createdAt: 'a', updatedAt: 'a' };
const sessions: Session[] = [
  bare,
  { ...bare, id: 'corsa-later', categoryId: corsa.id, notes: 'Parco' },
  { ...bare, id: 'surf-earlier', date: '2026-10-06', notes: 'Livorno' },
  { ...bare, id: 'outside', date: '2026-10-10' },
];
const dates = ['2026-10-06', '2026-10-08', '2026-10-09'];

describe('common Home session list', () => {
  let renderer: ReactTestRenderer;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    useApp.setState({ categories: [surf, corsa], sessions, activeId: surf.id, selection: dates, bulkSelection: ['surf-earlier', 'corsa-later'], homeSessionMode: 'new', saving: false, bulkSaving: false });
  });
  afterEach(() => { act(() => renderer?.unmount()); jest.restoreAllMocks(); });
  const render = (date = '') => act(() => { renderer = create(<BulkDaySheet date={date} />); });
  const rowProps = () => renderer.root.findAllByType(DaySessionRow).map((row) => row.props);
  const press = (testID: string) => act(() => renderer.root.findByProps({ testID }).props.onPress());

  it.each([surf.id, null])('Nuove browses every activity on multiple selected days (active: %s)', (activeId) => {
    useApp.setState({ activeId });
    const before = useApp.getState();
    render();
    const rows = rowProps();
    expect(rows.map((row) => row.id)).toEqual(['surf-earlier', 'corsa-later', 'surf-bare']);
    expect(rows.map((row) => row.color)).toEqual([surf.color, corsa.color, surf.color]);
    expect(rows.map((row) => row.title)).toEqual(['Surf', 'Corsa', 'Surf']);
    expect(rows.find((row) => row.id === bare.id)?.detail).toBe('');
    expect(renderer.root.findAllByType(DaySessions).map((group) => group.props.date)).toEqual(dates.slice(0, 2));
    for (const date of dates) expect(renderer.root.findAllByProps({ testID: `selected-sessions-day-${date}` }).length).toBeGreaterThan(0);
    expect(rows.every((row) => row.selection === undefined)).toBe(true);
    press('session-corsa-later');
    expect(router.push).toHaveBeenCalledWith('/session/corsa-later');
    press('bulk-day-done');
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(useApp.getState().selection).toBe(before.selection);
    expect(useApp.getState().bulkSelection).toBe(before.bulkSelection);
    expect(selectBulkDay).not.toHaveBeenCalled();
    expect(toggleBulkSession).not.toHaveBeenCalled();
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it('Modifica keeps exclusions and hidden activity choices while scopes change', () => {
    useApp.setState({ homeSessionMode: 'edit' });
    const before = useApp.getState();
    render();
    expect(rowProps().map((row) => [row.id, row.selection?.checked])).toEqual([['surf-earlier', true], ['surf-bare', false]]);
    expect(rowProps().every((row) => row.onDelete === undefined)).toBe(true);
    act(() => useApp.setState({ activeId: null }));
    expect(rowProps().map((row) => [row.id, row.selection?.checked])).toEqual([['surf-earlier', true], ['corsa-later', true], ['surf-bare', false]]);
    expect(rowProps().map((row) => row.color)).toEqual([surf.color, corsa.color, surf.color]);
    act(() => useApp.setState({ homeSessionMode: 'new' }));
    expect(rowProps().every((row) => row.selection === undefined)).toBe(true);
    act(() => useApp.setState({ homeSessionMode: 'edit', activeId: surf.id }));
    expect(rowProps().map((row) => [row.id, row.selection?.checked])).toEqual([['surf-earlier', true], ['surf-bare', false]]);
    expect(useApp.getState().bulkSelection).toBe(before.bulkSelection);
    expect(useApp.getState().selection).toBe(before.selection);
    expect(selectBulkDay).not.toHaveBeenCalled();
    expect(toggleBulkSession).not.toHaveBeenCalled();
    press('bulk-day-session-surf-bare');
    expect(toggleBulkSession).toHaveBeenCalledWith(bare.id);
    expect(router.push).not.toHaveBeenCalled();
    press('bulk-day-all');
    expect(selectBulkDay).toHaveBeenNthCalledWith(1, dates[0], true);
    expect(selectBulkDay).toHaveBeenNthCalledWith(2, dates[1], true);
    expect(selectBulkDay).toHaveBeenCalledTimes(2);
  });

  it('does not toggle rows or all records while a save is in flight', () => {
    useApp.setState({ homeSessionMode: 'edit', bulkSaving: true });
    render();
    expect(renderer.root.findByProps({ testID: 'bulk-day-session-surf-bare' }).props['aria-disabled']).toBe(true);
    press('bulk-day-session-surf-bare');
    press('bulk-day-all');
    expect(toggleBulkSession).not.toHaveBeenCalled();
    expect(selectBulkDay).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('Nuove deletes only the pressed record with undo and blocks duplicate presses while busy', async () => {
    let complete!: () => void;
    jest.mocked(deleteSession).mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    render();
    const remove = renderer.root.findAllByType(DaySessions)[0].props.onDelete;
    act(() => { remove(sessions[2]); remove(bare); });
    expect(deleteSession).toHaveBeenCalledTimes(1);
    expect(deleteSession).toHaveBeenCalledWith('surf-earlier', { undo: true });
    expect(rowProps().every((row) => !row.interactive)).toBe(true);
    await act(async () => complete());
    expect(rowProps().every((row) => row.interactive)).toBe(true);
    expect(useApp.getState().selection).toBe(dates);
  });

  it('restores the list and reports a failed deletion', async () => {
    jest.mocked(deleteSession).mockRejectedValueOnce(new Error('disk full'));
    render();
    await act(async () => renderer.root.findByProps({ testID: 'day-delete-surf-bare' }).props.onPress());
    expect(rowProps().map((row) => row.id)).toContain(bare.id);
    expect(rowProps().every((row) => row.interactive)).toBe(true);
    expect(renderer.root.findAllByProps({ testID: 'selected-sessions-delete-error' }).length).toBeGreaterThan(0);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalled();
  });
});
