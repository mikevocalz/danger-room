import React, { type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { RivePlate } from './RivePlate';
export type SeatState='empty'|'joining'|'occupied';
export interface RosterTileProps {width:number;height:number;state?:SeatState;seatIndex?:number;name?:string;videoSlot?:ReactNode;level?:number;speaking?:boolean;isSelf?:boolean;muted?:boolean;glyph?:unknown;font?:unknown;onPress?:()=>void}
export const RosterTile=({width,height,state='empty',seatIndex,name,videoSlot,level=0,speaking=false,isSelf=false,muted=false,onPress}:RosterTileProps)=>{
{const occupied=state==='occupied'; const label=occupied?(name??'GUEST'):state==='joining'?'CONNECTING':seatIndex?`SEAT ${String(seatIndex).padStart(2,'0')}`:(name&&name!=='OPEN'?name:'OPEN');
 const plate=<RivePlate width={width} height={height} name={label}
 status={occupied?(muted?'MUTED':'GUEST · LIVE'):state==='joining'?'LINKING…':'AVAILABLE'}
 finish={occupied?'gold':'silver'} empty={!occupied} live={occupied&&!!videoSlot} muted={muted} self={isSelf}
 speaking={speaking} level={level} videoSlot={occupied?videoSlot:undefined}/>;
 return state==='empty'&&onPress?<Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Join ${label.toLowerCase()}`}>{plate}</Pressable>:plate;}};
