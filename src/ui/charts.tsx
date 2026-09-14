/**
 * La courbe d'une nuit, et les plages de sommeil d'une semaine ou d'un mois.
 *
 * Courbe : la plage recommandée tracée en fond — c'est elle qui rend la courbe lisible sans
 * connaître les seuils ; échelle logarithmique pour la lumière ; un trait pour la température et
 * l'humidité, une aire pour la lumière et le bruit, comme SleepMapper. Un trou de collecte coupe
 * le trait et se dessine : il n'est jamais comblé par interpolation (cadrage §3.C).
 */
import Svg, { Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { hhmm, pad2 } from '../domain/format';
import { READING_KEY, type Gap, type ReadingPoint } from '../domain/stats';
import { METRICS, type Metric } from '../domain/thresholds';
import type { Bar } from '../domain/views';
import { colors, fonts } from './theme';

const LABEL = { fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: fonts.regular };

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const LUX_TICKS = [0, 10, 40, 200, 1000, 10000];
const lux = (v: number) => Math.log10(Math.max(0, v) + 1);

export function NightChart({
  metric,
  readings,
  start,
  end,
  gaps,
  width,
  breakAfter,
}: {
  metric: Metric;
  readings: readonly ReadingPoint[];
  start: number;
  end: number;
  gaps: readonly Gap[];
  width: number;
  /** Écart au-delà duquel le trait se coupe (le seuil de `findGaps`). */
  breakAfter: number;
}) {
  const info = METRICS[metric];
  const key = READING_KEY[metric];
  const pts = readings.filter((r) => r[key] !== null && r[key] !== undefined).map((r) => ({ ts: r.ts, v: r[key] as number }));
  const f = info.logScale ? lux : (v: number) => v;

  const values = pts.map((p) => p.v);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  let lo: number;
  let hi: number;
  if (info.logScale) {
    lo = 0;
    hi = lux(Math.max(dataMax, 40)) * 1.06;
  } else if (metric === 'snd') {
    lo = Math.max(0, Math.min(dataMin, 25) - 5);
    hi = Math.max(dataMax, 40) + 5;
  } else {
    lo = Math.min(dataMin, info.ideal.from);
    hi = Math.max(dataMax, info.ideal.to);
    const pad = Math.max((hi - lo) * 0.12, metric === 'temp' ? 0.5 : 2);
    lo -= pad;
    hi += pad;
  }

  const left = 44;
  const right = width - 10;
  const top = 12;
  const bottom = 162;
  const x = (ts: number) => left + ((ts - start) / Math.max(1, end - start)) * (right - left);
  const y = (v: number) => bottom - ((f(v) - lo) / Math.max(1e-9, hi - lo)) * (bottom - top);
  const clampY = (v: number) => Math.min(bottom, Math.max(top, v));

  const ticks: number[] = info.logScale
    ? LUX_TICKS.filter((t) => lux(t) <= hi)
    : (() => {
        const step = niceStep((hi - lo) / 4);
        const out: number[] = [];
        for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(Number(t.toFixed(6)));
        return out;
      })();

  // Segments continus : le trait se coupe à chaque trou.
  const segments: { ts: number; v: number }[][] = [];
  for (const p of pts) {
    const seg = segments[segments.length - 1];
    if (!seg || p.ts - seg[seg.length - 1].ts > breakAfter) segments.push([p]);
    else seg.push(p);
  }
  const line = (seg: { ts: number; v: number }[]) => seg.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.ts).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const filled = metric === 'lux' || metric === 'snd';

  const bandTop = clampY(y(info.ideal.to));
  const bandBottom = clampY(y(info.ideal.from));

  // Graduations horaires : début, fin, et les heures paires qui ne les chevauchent pas.
  const hourTicks: { ts: number; label: string; anchor: 'start' | 'middle' | 'end' }[] = [
    { ts: start, label: hhmm(start), anchor: 'start' },
  ];
  const first = new Date(start * 1000);
  first.setMinutes(0, 0, 0);
  for (let t = first.getTime() / 1000 + 3600; t < end; t += 3600) {
    const h = new Date(t * 1000).getHours();
    if (h % 2 === 0 && x(t) - x(start) > 44 && x(end) - x(t) > 44) hourTicks.push({ ts: t, label: `${pad2(h)}:00`, anchor: 'middle' });
  }
  hourTicks.push({ ts: end, label: hhmm(end), anchor: 'end' });

  return (
    <Svg width={width} height={206}>
      <Defs>
        <LinearGradient id="band" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.accent} stopOpacity={0.05} />
          <Stop offset="0.5" stopColor={colors.accent} stopOpacity={0.26} />
          <Stop offset="1" stopColor={colors.accent} stopOpacity={0.05} />
        </LinearGradient>
      </Defs>
      {ticks.map((t) => (
        <G key={t}>
          <Line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
          <SvgText x={left - 8} y={y(t) + 4} textAnchor="end" {...LABEL}>
            {metric === 'lux' && t >= 1000 ? `${t / 1000}k` : String(t)}
          </SvgText>
        </G>
      ))}
      {bandBottom > bandTop ? <Rect x={left} y={bandTop} width={right - left} height={bandBottom - bandTop} fill="url(#band)" /> : null}
      {gaps.map((g) => {
        const gx = Math.max(left, x(g.from));
        const gw = Math.min(right, x(g.to)) - gx;
        if (gw <= 0) return null;
        return (
          <G key={`${g.from}-${g.to}`}>
            <Rect x={gx} y={top} width={gw} height={bottom - top} fill="rgba(255,255,255,0.035)" />
            <Line x1={gx} x2={gx} y1={top} y2={bottom} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
            <Line x1={gx + gw} x2={gx + gw} y1={top} y2={bottom} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
            {gw > 46 ? (
              <>
                <SvgText x={gx + gw / 2} y={(top + bottom) / 2 - 4} textAnchor="middle" {...LABEL} fill="rgba(255,255,255,0.5)">pas de</SvgText>
                <SvgText x={gx + gw / 2} y={(top + bottom) / 2 + 10} textAnchor="middle" {...LABEL} fill="rgba(255,255,255,0.5)">relevé</SvgText>
              </>
            ) : null}
          </G>
        );
      })}
      {segments.map((seg, i) =>
        seg.length < 2 ? (
          <Rect key={`p${i}`} x={x(seg[0].ts) - 1.5} y={y(seg[0].v) - 1.5} width={3} height={3} fill="rgba(255,255,255,0.92)" />
        ) : (
          <G key={`s${i}`}>
            {filled ? (
              <Path d={`${line(seg)} L${x(seg[seg.length - 1].ts).toFixed(1)} ${bottom} L${x(seg[0].ts).toFixed(1)} ${bottom} Z`} fill="rgba(255,255,255,0.13)" />
            ) : null}
            <Path d={line(seg)} stroke="rgba(255,255,255,0.92)" strokeWidth={filled ? 1.4 : 2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </G>
        ),
      )}
      <Line x1={left} x2={right} y1={bottom + 1} y2={bottom + 1} stroke="rgba(255,255,255,0.12)" />
      {hourTicks.map((t) => (
        <SvgText key={`${t.ts}`} x={x(t.ts)} y={bottom + 17} textAnchor={t.anchor} {...LABEL}>{t.label}</SvgText>
      ))}
      <Rect x={left} y={bottom + 31} width={14} height={2.5} rx={1.25} fill="rgba(255,255,255,0.92)" />
      <SvgText x={left + 22} y={bottom + 36} {...LABEL} fill="rgba(255,255,255,0.62)" fontSize={11.5}>Dans votre chambre</SvgText>
      <Rect x={left + 170} y={bottom + 27} width={12} height={10} rx={2} fill={colors.accent} fillOpacity={0.3} />
      <SvgText x={left + 190} y={bottom + 36} {...LABEL} fill="rgba(255,255,255,0.62)" fontSize={11.5}>Plage recommandée</SvgText>
    </Svg>
  );
}

/** Plages de sommeil sur l'axe de la journée, de midi à midi : la régularité se lit d'un coup d'œil. */
export function BedBars({
  days,
  bars,
  width,
  labelFor,
}: {
  days: readonly string[];
  bars: readonly Bar[];
  width: number;
  labelFor: (day: string, index: number) => string | null;
}) {
  const left = 46;
  const right = width - 6;
  const top = 10;
  const bottom = 256;
  const y = (min: number) => top + (min / 1440) * (bottom - top);
  const col = (right - left) / Math.max(1, days.length);
  const w = Math.max(3, Math.min(26, col * 0.56));
  const hours = [0, 180, 360, 540, 720, 900, 1080, 1260, 1440];
  return (
    <Svg width={width} height={bottom + 26}>
      {hours.map((m) => (
        <G key={m}>
          <Line x1={left} x2={right} y1={y(m)} y2={y(m)} stroke="rgba(255,255,255,0.06)" />
          <SvgText x={left - 8} y={y(m) + 4} textAnchor="end" {...LABEL} fontSize={10.5}>{`${pad2((12 + m / 60) % 24)}:00`}</SvgText>
        </G>
      ))}
      {bars.map((b) => {
        const i = days.indexOf(b.night.day);
        if (i < 0) return null;
        const bx = left + i * col + (col - w) / 2;
        const by = y(b.startMin);
        const bh = Math.max(3, y(b.endMin) - by);
        return (
          <Rect
            key={b.night.id}
            x={bx}
            y={by}
            width={w}
            height={bh}
            rx={Math.min(3, w / 2)}
            fill={b.ongoing ? colors.accent : b.estimated ? 'rgba(238,167,83,0.18)' : '#ffffff'}
            stroke={b.estimated && !b.ongoing ? colors.estimated : 'none'}
            strokeWidth={b.estimated ? 1.5 : 0}
            strokeDasharray={b.estimated ? '4 3' : undefined}
          />
        );
      })}
      {days.map((d, i) => {
        const label = labelFor(d, i);
        return label ? (
          <SvgText key={d} x={left + i * col + col / 2} y={bottom + 18} textAnchor="middle" {...LABEL} fontSize={11} fill="rgba(255,255,255,0.62)">{label}</SvgText>
        ) : null;
      })}
    </Svg>
  );
}
