import React, { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { I18nManager, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { foldLayoutsFromRegions, foldsInsideRow } from '@/adaptive/fold-layout';
import { useReservedRegions } from '@/adaptive/reserved-regions';

export interface RoomLayoutProps { host: ReactNode; showcase: ReactNode; guests: (columns: number) => ReactNode }
type RowFrame = { x: number; y: number; width: number; height: number };

export const RoomLayout = ({ host, showcase, guests }: RoomLayoutProps) => {
  const rowRef = useRef<React.ElementRef<typeof View>>(null);
  const regions = useReservedRegions();
  const window = useWindowDimensions();
  const [row, setRow] = useState<RowFrame | null>(null);
  const measure = useCallback((_e?: LayoutChangeEvent) => requestAnimationFrame(() => {
    rowRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => setRow((old) =>
      old && old.x === x && old.y === y && old.width === width && old.height === height
        ? old : { x,y,width,height }));
  }), []);
  const folds = useMemo(() => row
    ? foldsInsideRow(foldLayoutsFromRegions(regions, row.x, row.y), row.width, row.height)
    : [], [regions,row]);
  const vertical = folds.filter((f) => f.separating && f.orientation === 'vertical').sort((a,b) => a.x-b.x);
  const horizontal = folds.filter((f) => f.separating && f.orientation === 'horizontal').sort((a,b) => a.y-b.y);
  const rtl = I18nManager.isRTL;
  const w = row?.width ?? window.width;
  const h = row?.height ?? window.height;
  let content: ReactNode;

  if (vertical.length >= 2 && row) {
    const a=vertical[0]!, b=vertical[1]!;
    const widths=[Math.max(0,a.x), Math.max(0,b.x-(a.x+a.width)), Math.max(0,row.width-(b.x+b.width))];
    const panes = rtl ? [guests(2),showcase,host] : [host,showcase,guests(2)];
    content=<View style={s.physicalRow}>
      <View style={{width:widths[0]}}>{panes[0]}</View><View style={{width:a.width}} />
      <View style={{width:widths[1]}}>{panes[1]}</View><View style={{width:b.width}} />
      <View style={{width:widths[2]}}>{panes[2]}</View>
    </View>;
  } else if (vertical.length && row) {
    const f=vertical[0]!, left=Math.max(0,f.x), right=Math.max(0,row.width-f.x-f.width);
    const consolePane=<View style={s.column}><View style={s.flex}>{host}</View><View style={s.flex}>{showcase}</View></View>;
    const guestPane=<View style={s.flex}>{guests(2)}</View>;
    content=<View style={s.physicalRow}>
      <View style={{width:left}}>{rtl?guestPane:consolePane}</View><View style={{width:f.width}} />
      <View style={{width:right}}>{rtl?consolePane:guestPane}</View>
    </View>;
  } else if (horizontal.length && row) {
    const f=horizontal[0]!, top=Math.max(0,f.y), bottom=Math.max(0,row.height-f.y-f.height);
    content=<View style={s.physicalColumn}>
      <View style={[s.row,{height:top}]}><View style={s.flex}>{host}</View><View style={s.flex}>{showcase}</View></View>
      <View style={{height:f.height}} /><View style={{height:bottom}}>{guests(4)}</View>
    </View>;
  } else if (h >= w) {
    content=<View style={s.column}>
      <View style={[s.flex,s.row]}><View style={{flex:.6}}>{host}</View><View style={{flex:.4}}>{showcase}</View></View>
      <View style={s.flex}>{guests(4)}</View>
    </View>;
  } else {
    content=<View style={s.row}>
      <View style={s.column}><View style={s.flex}>{host}</View><View style={s.flex}>{showcase}</View></View>
      <View style={s.flex}>{guests(2)}</View>
    </View>;
  }
  return <View ref={rowRef} onLayout={measure} style={s.fill}>{content}</View>;
};
const s=StyleSheet.create({fill:{flex:1},flex:{flex:1},row:{flex:1,flexDirection:'row',gap:12},column:{flex:1,gap:12},physicalRow:{flex:1,flexDirection:'row'},physicalColumn:{flex:1}});
