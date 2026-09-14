/** Icônes au trait, reprises des maquettes (`design/Main.dc.html`). */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from './theme';

export type IconName =
  | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'plus' | 'close' | 'check'
  | 'bell' | 'sunset' | 'moon' | 'sun' | 'thermometer' | 'drop' | 'speaker' | 'bed'
  | 'device' | 'calendar' | 'copy' | 'bolt' | 'refresh' | 'alert' | 'clock' | 'archive' | 'arrow-down';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.6 }: Props) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const p = (d: string) => <Path d={d} {...stroke} />;
  let content: React.ReactNode;
  switch (name) {
    case 'chevron-left': content = p('M15 18l-6-6 6-6'); break;
    case 'chevron-right': content = p('M9 18l6-6-6-6'); break;
    case 'chevron-down': content = p('M6 9l6 6 6-6'); break;
    case 'plus': content = p('M12 5v14M5 12h14'); break;
    case 'close': content = p('M6 6l12 12M18 6L6 18'); break;
    case 'check': content = p('M4.5 12.5l5 5 10-10'); break;
    case 'bell': content = <>{p('M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5z')}{p('M10.3 19.5a2 2 0 0 0 3.4 0')}</>; break;
    case 'sunset': content = <>{p('M12 3v3M4.9 6.9l2.1 2.1M2 16h3M19 16h3M17 9l2.1-2.1')}{p('M8 16a4 4 0 0 1 8 0')}{p('M3 20h18')}</>; break;
    case 'moon': content = p('M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z'); break;
    case 'sun': content = <><Circle cx={12} cy={12} r={4} {...stroke} />{p('M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4')}</>; break;
    case 'thermometer': content = p('M14 14.76V4.5a2.5 2.5 0 0 0-5 0v10.26a4.5 4.5 0 1 0 5 0z'); break;
    case 'drop': content = p('M12 2.7l5.1 5.6a7 7 0 1 1-10.2 0z'); break;
    case 'speaker': content = <>{p('M4 9v6h3.5L13 19V5L7.5 9z')}{p('M16.5 9.5a3.5 3.5 0 0 1 0 5')}</>; break;
    case 'bed': content = <>{p('M3 17v-4a2 2 0 0 1 2-2h10a3 3 0 0 1 3 3v3')}{p('M3 17h18')}<Circle cx={7.5} cy={8.5} r={2} {...stroke} /></>; break;
    case 'device': content = <><Circle cx={12} cy={12} r={8.5} {...stroke} /><Circle cx={12} cy={12} r={3} {...stroke} /></>; break;
    case 'calendar': content = <><Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} {...stroke} />{p('M3.5 9.5h17M8 3v3.5M16 3v3.5')}</>; break;
    case 'copy': content = <><Rect x={9} y={9} width={11} height={11} rx={2} {...stroke} />{p('M5 15V5a2 2 0 0 1 2-2h8')}</>; break;
    case 'bolt': content = <Path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" fill={color} />; break;
    case 'refresh': content = <>{p('M20 11.5A8 8 0 0 0 6.3 6.3L3 9.4')}{p('M4 12.5a8 8 0 0 0 13.7 5.2L21 14.6')}{p('M3 4.6v4.8h4.8M21 19.4v-4.8h-4.8')}</>; break;
    case 'alert': content = <><Circle cx={12} cy={12} r={9.2} {...stroke} />{p('M12 7.6v5')}{p('M12 16.2h.01')}</>; break;
    case 'clock': content = <><Circle cx={12} cy={13} r={7.5} {...stroke} />{p('M12 9.5V13l2.4 1.6M4.6 5.2l2.6-2M19.4 5.2l-2.6-2')}</>; break;
    case 'archive': content = <>{p('M3.5 6.5h17v4h-17z')}{p('M5 10.5v8.5h14v-8.5')}{p('M10 14.5h4')}</>; break;
    case 'arrow-down': content = p('M12 5v14M6 13l6 6 6-6'); break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {content}
    </Svg>
  );
}
