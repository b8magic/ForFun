import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { type Surface } from '@/ui/theme';
import { DurationInput } from '../DurationInput';

jest.mock('@/ui/useTheme', () => {
  const surface = jest.requireActual('@/ui/theme').surfaces.calm;
  return {
    useSurface: () => surface,
    useThemedStyles: (factory: (surface: Surface) => unknown) => factory(surface),
  };
});

describe('native duration input events', () => {
  let renderer: ReactTestRenderer;

  afterEach(() => {
    act(() => renderer?.unmount());
  });

  function renderInput(initialValue = '') {
    const onChange = jest.fn();
    function Form() {
      const [value, setValue] = useState(initialValue);
      return <DurationInput value={value} onChange={(next) => { onChange(next); setValue(next); }} onBlur={() => {}} error={null} testID="duration" />;
    }
    act(() => { renderer = create(<Form />); });
    const input = () => renderer.root.findByType(TextInput).props as TextInputProps;
    const changeText = (text: string) => act(() => input().onChangeText?.(text));
    const select = (text: string | undefined, start: number, end = start) => act(() => {
      // RN 0.86 iOS and RN Web include text in the selection event payload.
      input().onSelectionChange?.({ nativeEvent: { text, selection: { start, end } } } as unknown as Parameters<NonNullable<TextInputProps['onSelectionChange']>>[0]);
    });
    const type = (inserted: string) => {
      const { value = '', selection = { start: value.length, end: value.length } } = input();
      const next = value.slice(0, selection.start) + inserted + value.slice(selection.end ?? selection.start);
      changeText(next);
      // UITextField emits onChange before the selection for the same raw text.
      select(next, selection.start + inserted.length);
    };
    const backspace = () => {
      const { value = '', selection = { start: value.length, end: value.length } } = input();
      const end = selection.end ?? selection.start;
      const start = selection.start === end ? Math.max(0, selection.start - 1) : selection.start;
      const next = value.slice(0, start) + value.slice(end);
      changeText(next);
      select(next, start);
    };
    return { input, changeText, select, type, backspace, onChange };
  }

  it.each([false, true])('appends at the correct caret after the raw iOS selection event (batched: %s)', (batched) => {
    const { input, changeText, select, type } = renderInput();
    if (batched) {
      act(() => { changeText('123'); select('123', 3); });
    } else {
      changeText('123');
      select('123', 3);
    }
    expect(input().value).toBe('1h23m');
    type('7');
    expect(input().value).toBe('12h37m');
    expect(input().selection).toEqual({ start: 5, end: 5 });
  });

  it('keeps sequential keyboard typing and deletion at the end of the digit stream', () => {
    const { input, type, select, backspace } = renderInput();
    for (const [digit, expected] of [['1', '1m'], ['2', '12m'], ['3', '1h23m'], ['7', '12h37m']]) {
      type(digit);
      expect(input().value).toBe(expected);
    }
    backspace();
    expect(input().value).toBe('1h23m');
    type('7');
    expect(input().value).toBe('12h37m');
    select('12h37m', 6);
    backspace();
    expect(input().value).toBe('1h23m');
    for (const expected of ['12m', '1m', '']) {
      backspace();
      expect(input().value).toBe(expected);
    }
  });

  it('accepts actual cursor movement and range replacement within the formatted value', () => {
    const { input, type, select } = renderInput('12:37');
    select('12h37m', 3, 4);
    type('4');
    expect(input().value).toBe('12h47m');
    expect(input().selection).toEqual({ start: 4, end: 4 });
    select('12h47m', 0, 2);
    type('3');
    expect(input().value).toBe('3h47m');
    expect(input().selection).toEqual({ start: 1, end: 1 });
    select('3h47m', 3);
    type('2');
    expect(input().value).toBe('34h27m');
  });

  it('preserves selection events without attached text, as emitted on Android', () => {
    const { input, type, select } = renderInput('12:37');
    select(undefined, 3, 4);
    type('4');
    expect(input().value).toBe('12h47m');
  });

  it('accepts selection before a text event without losing the original range', () => {
    const { input, changeText, select } = renderInput('12:37');
    select('12h37m', 0, 2);
    select('3h37m', 1);
    changeText('3h37m');
    expect(input().value).toBe('3h37m');
    expect(input().selection).toEqual({ start: 1, end: 1 });
  });

  it('preserves existing seconds when only the selection changes', () => {
    const { select, onChange } = renderInput('1:30:37');
    select('1h30m', 4);
    select('1h30m', 0, 4);
    expect(onChange).not.toHaveBeenCalled();
  });
});
