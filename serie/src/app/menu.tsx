/**
 * Menu — the compact way to everything that is not logging: history,
 * progress, activities, calendars, the motion preference and about.
 */
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useApp, type MotionPref } from '@/state/store';
import { setMotionPref, setPlace, setTimeScale } from '@/state/actions';
import { Section, Segmented, Sheet } from '@/ui/controls';
import { fonts, surfaces } from '@/ui/theme';
import { T } from '@/ui/T';
import { t } from '@/i18n/it';
import { MenuItem, StatusLine } from '@/sheets/manage/MenuParts';
import { closeSheet } from '@/sheets/manage/parts';

const S = surfaces.night;

export default function MenuSheet() {
  const openJobs = useApp((s) => s.openJobs);
  const motionPref = useApp((s) => s.motionPref);
  const activityCount = useApp((s) => s.categories.length);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Sheet title={t.menu} testID="menu-sheet">
      {openJobs > 0 ? <StatusLine text={t.manage.pendingExports(openJobs)} action={t.calendars} onPress={() => router.replace('/calendar')} testID="menu-pending" /> : null}

      <View>
        <View style={styles.top} />
        <MenuItem
          title={t.history}
          detail={t.manage.historyDetail}
          onPress={() => {
            setPlace('time');
            // "Mese · Anno": coming back from Progressi (Tutto) would otherwise reopen it.
            if (useApp.getState().timeScale === 'all') setTimeScale('month');
            closeSheet();
          }}
          testID="menu-history"
        />
        <MenuItem
          title={t.progress}
          detail={t.manage.progressDetail}
          onPress={() => {
            setPlace('time');
            setTimeScale('all');
            closeSheet();
          }}
          testID="menu-progress"
        />
        <MenuItem title={t.activities} detail={String(activityCount)} onPress={() => router.replace('/activities')} testID="menu-activities" />
        <MenuItem title={t.calendars} onPress={() => router.replace('/calendar')} testID="menu-calendars" />
      </View>

      <Section label={t.settings} hint={t.manage.motionHint}>
        <T variant="body" color={S.fg}>
          {t.manage.motion}
        </T>
        <Segmented<MotionPref>
          value={motionPref}
          options={[
            { key: 'system', label: t.manage.motionSystem },
            { key: 'reduced', label: t.manage.motionReduced },
            { key: 'full', label: t.manage.motionFull },
          ]}
          onChange={(k) => void setMotionPref(k).catch(() => undefined)}
          testID="motion-pref"
        />
      </Section>

      <Section label={t.about}>
        <View style={styles.about}>
          <T variant="heading" color={S.fg} style={styles.logo} accessibilityRole="text">
            {t.appName}
          </T>
          <T variant="label" color={S.mute}>
            {t.version(version)}
          </T>
        </View>
        <T variant="body" color={S.fg}>
          {t.tagline}
        </T>
        <T variant="small" color={S.mute}>
          {t.manage.credits}
        </T>
      </Section>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  top: { height: StyleSheet.hairlineWidth, backgroundColor: S.faint },
  about: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  logo: { fontFamily: fonts.displayBlack, fontSize: 36, lineHeight: 40, letterSpacing: -0.5 },
});
