import { filterTimeZoneOptions, timeZoneOptions } from '../timeZoneOptions';

describe('time zone choices', () => {
  it('includes UTC, the device zone and a valid saved alias', () => {
    const options = timeZoneOptions('Europe/Rome', 'US/Eastern', ['America/New_York', 'Europe/Rome']);
    expect(options.map((option) => option.id)).toEqual(['UTC', 'America/New_York', 'Europe/Rome', 'US/Eastern']);
  });
  it('never offers an invalid saved zone', () => {
    expect(timeZoneOptions('UTC', 'Mars/Olympus', ['UTC']).map((option) => option.id)).toEqual(['UTC']);
  });
  it('finds cities using Italian names, IANA identifiers, accents and spaces', () => {
    const options = timeZoneOptions('UTC', 'UTC', ['Europe/Rome', 'America/New_York', 'America/Sao_Paulo']);
    expect(filterTimeZoneOptions(options, 'roma').map((option) => option.id)).toEqual(['Europe/Rome']);
    expect(filterTimeZoneOptions(options, 'Europe/Rome').map((option) => option.id)).toEqual(['Europe/Rome']);
    expect(filterTimeZoneOptions(options, 'new york').map((option) => option.id)).toEqual(['America/New_York']);
    expect(filterTimeZoneOptions(options, 'São Paulo').map((option) => option.id)).toEqual(['America/Sao_Paulo']);
    expect(filterTimeZoneOptions(options, '  america york  ').map((option) => option.id)).toEqual(['America/New_York']);
    expect(filterTimeZoneOptions(options, 'Mars')).toEqual([]);
  });
  it('provides supported IANA zones when the mobile runtime cannot enumerate them', () => {
    const original = Object.getOwnPropertyDescriptor(Intl, 'supportedValuesOf');
    Object.defineProperty(Intl, 'supportedValuesOf', { configurable: true, value: undefined });
    try {
      jest.isolateModules(() => {
        const { supportedTimeZones } = jest.requireActual<typeof import('../timeZoneOptions')>('../timeZoneOptions');
        const zones = supportedTimeZones();
        expect(zones.length).toBeGreaterThan(300);
        expect(zones).toEqual(expect.arrayContaining(['Europe/Rome', 'Asia/Kathmandu', 'Australia/Eucla', 'Pacific/Chatham']));
      });
    } finally {
      if (original) Object.defineProperty(Intl, 'supportedValuesOf', original);
      else Reflect.deleteProperty(Intl, 'supportedValuesOf');
    }
  });
});
