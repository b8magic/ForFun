import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { DATE_ONLY } from '@/domain/timing';
import type { Category, Session } from '@/domain/types';
import { deleteSession, showToast } from '@/state/actions';
import { useApp } from '@/state/store';
import { DaySheet } from '@/sheets/day/DaySheet';
import { DaySessions } from '../DaySessions';
import { InlineDayDetails } from '../InlineDayDetails';

jest.mock('expo-router', () => ({ router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() } }));
jest.mock('@/ui/useTheme', () => ({ useSurface: () => jest.requireActual('@/ui/theme').surfaces.calm }));
jest.mock('@/state/actions', () => ({ deleteSession: jest.fn(), showToast: jest.fn(), toggleDate: jest.fn(), setHomeSessionMode: jest.fn() }));
jest.mock('../DaySessions', () => ({ DaySessions: () => null }));
jest.mock('@/ui/controls', () => {
  const React = jest.requireActual('react');
  const { View, Pressable, Text } = jest.requireActual('react-native');
  return {
    Sheet: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => React.createElement(View, {}, children, footer),
    Button: ({ label, ...props }: { label: string }) => React.createElement(Pressable, props, React.createElement(Text, {}, label)),
  };
});

const category: Category = { id: 'surf', name: 'Surf', color: '#FF4D1F', pattern: 'swell', sortOrder: 0, createdAt: 'a', updatedAt: 'a' };
const session: Session = { id: 'one', categoryId: category.id, date: '2026-10-08', timing: DATE_ONLY, notes: null, place: null, origin: 'manual', saveRequestId: null, createdAt: 'a', updatedAt: 'a' };
const sessions = [session, { ...session, id: 'two' }];

describe.each(['day', 'history'] as const)('%s direct session deletion', (surface) => {
  let renderer: ReactTestRenderer;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    useApp.setState({ categories: [category], sessions, activeId: null, selection: [], today: '2026-10-13', saving: false, bulkSaving: false });
    act(() => {
      renderer = create(surface === 'day'
        ? <DaySheet date={session.date} />
        : <InlineDayDetails date={session.date} sessions={sessions} catById={new Map([[category.id, category]])} filterId={null} onClose={() => {}} onReveal={() => {}} />);
    });
  });
  afterEach(() => { act(() => renderer.unmount()); jest.restoreAllMocks(); });
  const rows = () => renderer.root.findByType(DaySessions).props;

  it('writes on the first explicit delete press and ignores duplicate presses while busy', async () => {
    let complete!: () => void;
    jest.mocked(deleteSession).mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    const onDelete = rows().onDelete;
    act(() => { onDelete(session); onDelete(sessions[1]); });
    expect(deleteSession).toHaveBeenCalledTimes(1);
    expect(deleteSession).toHaveBeenCalledWith(session.id);
    expect(rows().interactive).toBe(false);
    expect(renderer.root.findAll((node) => /^(day|history)-delete-confirm$/.test(node.props.testID ?? ''))).toHaveLength(0);
    await act(async () => complete());
    expect(rows().interactive).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('keeps the sessions available and restores actions when deletion fails', async () => {
    jest.mocked(deleteSession).mockRejectedValueOnce(new Error('disk full'));
    await act(async () => rows().onDelete(session));
    expect(rows().sessions).toEqual(sessions);
    expect(rows().interactive).toBe(true);
    expect(renderer.root.findAll((node) => node.props.testID === `${surface}-delete-error`).length).toBeGreaterThan(0);
    expect(showToast).not.toHaveBeenCalled();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalled();
  });
});
