/**
 * Tutto — the whole history as one field of corduroy (every month a swell
 * line, every peak a session), followed by progress drawn from the same
 * data: totals, frequency, consistency, distribution, milestones, hours.
 * Every figure is computed from stored sessions; decoration never encodes data.
 */
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Path, Skia, Group } from '@shopify/react-native-skia';
import type { Category, LocalDate, Session } from '@/domain/types';
import { monthGroups, type MonthGroup } from '@/domain/history';
import { summarize, frequency, weekStreaks, monthlyBuckets, distribution, averageKnown } from '@/domain/stats';
import { computeMilestones } from '@/domain/milestones';
import { formatDuration } from '@/domain/duration';
import { surfaces, palette, space } from '@/ui/theme';
import { T } from '@/ui/T';
import { IdentityDisc } from '@/graphics/IdentityDisc';
import { MONTHS_SHORT, t } from '@/i18n/it';
import { durationLine, shortDate } from './format';

const C = surfaces.calm;

interface Props {
  sessions: Session[];
  allSessions: Session[];
  categories: Category[];
  filterId: string | null;
  today: LocalDate;
  accent: string;
  header: React.ReactElement;
}

export function AllMode({ sessions, allSessions, categories, filterId, today, accent, header }: Props) {
  const { width } = useWindowDimensions();
  const W = width - 2 * space.gutter;
  const total = useMemo(() => summarize(sessions), [sessions]);
  const freq = useMemo(() => frequency(sessions, today, 12), [sessions, today]);
  const streaks = useMemo(() => weekStreaks(sessions, today), [sessions, today]);
  const trend = useMemo(() => monthlyBuckets(sessions, today, 24), [sessions, today]);
  const groups = useMemo(() => monthGroups(sessions, today), [sessions, today]);
  const dist = useMemo(() => distribution(allSessions, categories), [allSessions, categories]);
  const milestones = useMemo(
    () => computeMilestones(sessions, { first: t.milestoneFirst, sessions: t.milestoneSessions, hours: t.milestoneHours, weeks: t.milestoneWeeks }),
    [sessions],
  );
  const avg = averageKnown(total.duration);
  const nextSessions = milestones.find((m) => m.kind === 'sessions' && !m.reached);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 90 }} testID="all-mode">
      {header}
      <View style={{ paddingHorizontal: space.gutter, gap: 30 }}>
        <Corduroy groups={groups} width={W} accent={accent} />

        <View style={styles.bigRow} accessible accessibilityLabel={`${t.totalSessions}: ${total.sessions}. ${durationLine(total.duration)}`}>
          <View style={{ flex: 1 }}>
            <T variant="label" color={C.mute}>
              {t.totalSessions}
            </T>
            <T variant="hero" color={C.fg} style={{ fontVariant: ['tabular-nums'] }}>
              {total.sessions}
            </T>
            <T variant="data" color={C.mute}>
              {t.activeDays(total.activeDays)}
            </T>
          </View>
          <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
            <T variant="label" color={C.mute}>
              {t.cumulativeHours}
            </T>
            <T variant="hero" color={total.duration.knownCount ? C.fg : C.mute} style={{ fontVariant: ['tabular-nums'] }}>
              {total.duration.knownCount ? formatDuration(total.duration.knownSec).replace(' min', '′') : '—'}
            </T>
            <T variant="data" color={C.mute} align="right">
              {total.duration.knownCount ? t.coverage(total.duration.knownCount, total.duration.totalCount) : t.noDurations}
            </T>
          </View>
        </View>
        {avg ? (
          <T variant="small" color={C.mute}>
            {t.averageDuration(formatDuration(avg.avgSec), avg.count)}
          </T>
        ) : null}

        <Block label={t.trend}>
          <Trend values={trend.map((b) => b.summary.sessions)} width={W} accent={accent} />
          <View style={styles.trendAxis}>
            <T variant="label" color={C.mute}>
              {MONTHS_SHORT[trend[0].month.m - 1]} {trend[0].month.y}
            </T>
            <T variant="label" color={C.mute}>
              {MONTHS_SHORT[trend[trend.length - 1].month.m - 1]} {trend[trend.length - 1].month.y}
            </T>
          </View>
        </Block>

        <Block label={`${t.weeklyFrequency} · ${t.monthlyFrequency}`}>
          <Pair a={t.perWeekAvg(freq.perWeek.toFixed(1).replace('.', ','))} b={t.perMonthAvg(freq.perMonth.toFixed(1).replace('.', ','))} note="Ultime 12 settimane" />
        </Block>

        <Block label={t.consistency}>
          <Pair a={t.activeWeeks(freq.activeWeeks, freq.windowWeeks)} b={t.longestStreak(streaks.longest)} note={streaks.current ? `Serie attuale: ${streaks.current} settimane` : 'Nessuna serie in corso'} />
        </Block>

        {!filterId ? (
          <Block label={t.perActivity}>
            {dist.map((d) => (
              <View key={d.categoryId} style={styles.distRow} accessible accessibilityLabel={`${d.name}: ${t.sessions(d.summary.sessions)}, ${Math.round(d.share * 100)}%. ${durationLine(d.summary.duration) || t.noDurations}`}>
                <IdentityDisc size={34} pattern={categories.find((c) => c.id === d.categoryId)!.pattern} color={d.color} stripe={C.fg} animated={false} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.distHead}>
                    <T variant="bodyStrong" color={C.fg}>
                      {d.name}
                    </T>
                    <T variant="dataStrong" color={C.fg}>
                      {d.summary.sessions} · {Math.round(d.share * 100)}%
                    </T>
                  </View>
                  <View style={styles.shareTrack}>
                    <View style={[styles.shareFill, { width: `${Math.max(1.5, d.share * 100)}%`, backgroundColor: d.color }]} />
                  </View>
                  <T variant="small" color={C.mute}>
                    {d.summary.sessions ? durationLine(d.summary.duration) : t.emptyMonth}
                  </T>
                </View>
              </View>
            ))}
          </Block>
        ) : null}

        <Block label={t.milestones}>
          {milestones
            .filter((m) => m.reached || m === nextSessions || m.id === 'hours-10' || m.id === 'weeks-4')
            .map((m) => (
              <View key={m.id} style={styles.milestone} accessible accessibilityLabel={`${m.rule}: ${m.reached && m.reachedOn ? t.reachedOn(shortDate(m.reachedOn)) : t.notReached}`}>
                <View style={[styles.mDot, { backgroundColor: m.reached ? accent : 'transparent', borderColor: m.reached ? accent : C.mute }]} />
                <T variant="body" color={m.reached ? C.fg : C.mute} style={{ flex: 1 }}>
                  {m.rule}
                </T>
                <T variant="data" color={C.mute}>
                  {m.reached && m.reachedOn ? shortDate(m.reachedOn) : m.kind === 'sessions' ? `${total.sessions}/${m.threshold}` : t.notReached}
                </T>
              </View>
            ))}
        </Block>

        <T variant="small" color={C.mute}>
          {t.attributionNote} Le ore sommano solo le durate note.
        </T>
      </View>
    </ScrollView>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.blockHead}>
        <T variant="label" color={C.mute}>
          {label}
        </T>
      </View>
      {children}
    </View>
  );
}

function Pair({ a, b, note }: { a: string; b: string; note?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T variant="title" color={C.fg}>
        {a}
      </T>
      <T variant="title" color={C.fg}>
        {b}
      </T>
      {note ? (
        <T variant="small" color={C.mute}>
          {note}
        </T>
      ) : null}
    </View>
  );
}

/** Monthly counts over 24 months as one swell line, with exact values available to assistive tech. */
function Trend({ values, width, accent }: { values: number[]; width: number; accent: string }) {
  const H = 70;
  const max = Math.max(1, ...values);
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    const n = values.length;
    const pts = values.map((v, i) => ({ x: (i / (n - 1)) * width, y: H - 6 - (v / max) * (H - 18) }));
    b.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) {
      const p = pts[i - 1], q = pts[i];
      const cx = (p.x + q.x) / 2;
      b.cubicTo(cx, p.y, cx, q.y, q.x, q.y);
    }
    return b.build();
  }, [values, width, max]);
  const last = values.length ? H - 6 - (values[values.length - 1] / max) * (H - 18) : H - 6;
  return (
    <View accessible accessibilityLabel={`Sessioni per mese, ultimi 24 mesi: ${values.join(', ')}`}>
      <Canvas style={{ width, height: H }} pointerEvents="none">
        <Path path={path} style="stroke" strokeWidth={1.8} color={C.line} strokeJoin="round" />
        <Group>
          <Path path={Skia.Path.Circle(width - 1, last, 4)} color={accent} />
        </Group>
      </Canvas>
    </View>
  );
}

/** Every month as a ridgeline, oldest at the top, newest at the bottom (the trailer's corduroy field). */
const Corduroy = memo(function Corduroy({ groups, width, accent }: { groups: MonthGroup[]; width: number; accent: string }) {
  const rows = groups.slice().reverse(); // oldest first
  const n = rows.length;
  const gap = n > 60 ? 6 : n > 30 ? 8 : n > 12 ? 11 : 16;
  const H = Math.max(80, n * gap + 30);
  const labelW = 40;
  const x0 = labelW, x1 = width;
  const amp = gap * 1.7;
  const paths = useMemo(() => {
    return rows.map((g, r) => {
      const base = 24 + r * gap;
      const days = g.perDay.length - 1;
      const sig = Math.max(2, (x1 - x0) / days / 2.6);
      const b = Skia.PathBuilder.Make();
      const N = 80;
      const ys: number[] = [];
      for (let i = 0; i <= N; i++) {
        const x = x0 + ((x1 - x0) * i) / N;
        let y = base;
        for (let d = 1; d <= days; d++) {
          const c = g.perDay[d];
          if (!c) continue;
          const dx = x - (x0 + ((d - 0.5) / days) * (x1 - x0));
          if (Math.abs(dx) > sig * 4) continue;
          y -= Math.min(c, 3) * amp * 0.55 * Math.exp(-(dx * dx) / (2 * sig * sig));
        }
        ys.push(y);
        if (i === 0) b.moveTo(x, y);
        else b.lineTo(x, y);
      }
      const line = b.build();
      const fb = Skia.PathBuilder.Make();
      fb.moveTo(x0, ys[0] + 1);
      ys.forEach((y, i) => fb.lineTo(x0 + ((x1 - x0) * i) / N, y + 1));
      fb.lineTo(x1, base + gap * 2);
      fb.lineTo(x0, base + gap * 2);
      fb.close();
      return { line, fill: fb.build(), year: g.month.m === 1 || r === 0 ? g.month.y : null, base, empty: g.summary.sessions === 0, last: r === n - 1 };
    });
  }, [rows, gap, amp, x0, x1, n]);
  return (
    <View accessible accessibilityLabel={`Storia completa: ${n} mesi, ${groups.reduce((a, g) => a + g.summary.sessions, 0)} sessioni`}>
      <Canvas style={{ width, height: H }} pointerEvents="none">
        {paths.map((p, i) => (
          <Group key={i}>
            <Path path={p.fill} color={C.bg} />
            <Path path={p.line} style="stroke" strokeWidth={p.last ? 1.8 : 1.2} color={p.last ? accent : p.empty ? C.faint : C.line} />
          </Group>
        ))}
      </Canvas>
      {paths.map((p, i) =>
        p.year ? (
          <View key={`y${i}`} style={[styles.yearLabel, { top: p.base - 8 }]} pointerEvents="none">
            <T variant="label" color={C.mute} style={{ fontSize: 9 }}>
              {p.year}
            </T>
          </View>
        ) : null,
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  bigRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-end' },
  blockHead: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.faint, paddingTop: 12 },
  trendAxis: { flexDirection: 'row', justifyContent: 'space-between' },
  distRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 6 },
  distHead: { flexDirection: 'row', justifyContent: 'space-between' },
  shareTrack: { height: 2, backgroundColor: C.faint },
  shareFill: { height: 2 },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
  mDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.4 },
  yearLabel: { position: 'absolute', left: 0 },
});

export { palette };
