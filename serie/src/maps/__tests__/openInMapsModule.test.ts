/** The adapter loads with the real expo-linking / react-native modules (as the session sheet imports it). */
import { openPlaceInMaps, openUrlFor } from '../openInMaps';

it('loads without mocks and still prefers an injected opener', async () => {
  expect(openUrlFor({ label: 'Faro', address: null, mapUrl: null, coords: { lat: 43.46, lng: -3.81 }, resolution: 'manual', resolutionNote: null })).toBe('http://maps.apple.com/?ll=43.46,-3.81&q=Faro');
  const openURL = jest.fn(async () => true);
  await expect(openPlaceInMaps({ label: 'Faro', address: null, mapUrl: null, coords: null, resolution: 'none', resolutionNote: null }, { openURL })).resolves.toMatchObject({ opened: true });
  expect(openURL).toHaveBeenCalledTimes(1);
});
