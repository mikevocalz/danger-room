import React, { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { RiveChrome, type RiveChromePresentation } from './RiveChrome';
const A={w:800,h:500,x:36,y:92,ww:728,wh:326};
export interface RivePlateProps {
  width:number;height:number;name:string;status:string;finish:'silver'|'gold';
  empty?:boolean;live?:boolean;muted?:boolean;self?:boolean;speaking?:boolean;level?:number;videoSlot?:ReactNode;
}
export function RivePlate({width,height,name,status,finish,empty=false,live=false,muted=false,self=false,speaking=false,level=0,videoSlot}:RivePlateProps){
  const well=useMemo(()=>({position:'absolute' as const,left:width*A.x/A.w,top:height*A.y/A.h,width:width*A.ww/A.w,height:height*A.wh/A.h,overflow:'hidden' as const,backgroundColor:'#07101f'}),[width,height]);
  const p=useMemo<RiveChromePresentation>(()=>({name:name.toUpperCase(),status:status.toUpperCase(),
    goldAlpha:finish==='gold'?1:0,silverAlpha:finish==='silver'?1:0,emptyAlpha:empty?1:0,
    speakingAlpha:speaking?Math.max(.35,Math.min(1,level||1)):0,selfAlpha:self?1:0,liveAlpha:live?1:0,mutedAlpha:muted?1:0
  }),[empty,finish,level,live,muted,name,self,speaking,status]);
  if(width<=0||height<=0)return null;
  return <View style={{width,height}}><View style={well}>{videoSlot}</View>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><RiveChrome presentation={p}/></View></View>;
}
