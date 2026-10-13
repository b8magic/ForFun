import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { router } from 'expo-router';
import { DaySessionRow } from '../DaySessionRow';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/ui/useTheme', () => ({ useSurface: () => jest.requireActual('@/ui/theme').surfaces.calm }));
jest.mock('react-native-gesture-handler', () => ({ Pressable: jest.requireActual('react-native').Pressable }));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function MockSwipeable({ children, renderRightActions }: { children: React.ReactNode; renderRightActions: () => React.ReactNode }) {
      return React.createElement(View, {}, children, renderRightActions());
    },
  };
});

describe('session row gesture boundaries', () => {
  let renderer: ReactTestRenderer;
  const onDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      renderer = create(<DaySessionRow id="one" title="Surf" detail="Livorno" color="#FF4D1F" interactive accessibilityLabel="Apri Surf" deleteLabel="Elimina Surf" onDelete={onDelete} onOpen={() => {}} />);
    });
  });
  afterEach(() => act(() => renderer.unmount()));
  const press = (testID: string) => renderer.root.findByProps({ testID }).props;

  it.each(['onSwipeableOpenStartDrag', 'onSwipeableCloseStartDrag'])('rejects a release from %s and still opens on a fresh tap', (dragCallback) => {
    act(() => press('session-one').onPressIn());
    act(() => renderer.root.findByType(Swipeable).props[dragCallback]('left'));
    act(() => press('session-one').onPress());
    expect(router.push).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    act(() => { press('session-one').onPressIn(); press('session-one').onPress(); });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/session/one');
  });

  it('only deletes on an explicit action press, never as part of the swipe', () => {
    act(() => press('session-one').onPressIn());
    act(() => renderer.root.findByType(Swipeable).props.onSwipeableOpenStartDrag('left'));
    act(() => renderer.root.findByType(Swipeable).props.onSwipeableWillOpen('left'));
    act(() => press('day-swipe-delete-one').onPress());
    expect(onDelete).not.toHaveBeenCalled();
    act(() => { press('day-swipe-delete-one').onPressIn(); press('day-swipe-delete-one').onPress(); });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('retains the accessible delete action after a swipe', () => {
    act(() => renderer.root.findByType(Swipeable).props.onSwipeableOpenStartDrag('left'));
    act(() => press('session-one').onAccessibilityAction({ nativeEvent: { actionName: 'delete' } }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });
});
