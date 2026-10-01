import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Fit, RiveView, useRiveFile, useViewModelInstance } from '@rive-app/react-native';
const PLATE_FILE = require('../../assets/rive/danger_room_plate.riv');
export interface RiveChromePresentation {
  name:string; status:string; goldAlpha:number; silverAlpha:number; emptyAlpha:number;
  speakingAlpha:number; selfAlpha:number; liveAlpha:number; mutedAlpha:number;
}
export function RiveChrome({presentation}:{presentation:RiveChromePresentation}) {
  const { riveFile } = useRiveFile(PLATE_FILE);
  const { instance } = useViewModelInstance(riveFile, { async: true });
  useEffect(() => {
    if (!instance) return;
    const s=(p:string,v:string)=>{const x=instance.stringProperty(p); if(x)x.value=v};
    const n=(p:string,v:number)=>{const x=instance.numberProperty(p); if(x)x.value=v};
    s('name',presentation.name); s('status',presentation.status);
    n('goldAlpha',presentation.goldAlpha); n('silverAlpha',presentation.silverAlpha);
    n('emptyAlpha',presentation.emptyAlpha); n('speakingAlpha',presentation.speakingAlpha);
    n('selfAlpha',presentation.selfAlpha); n('liveAlpha',presentation.liveAlpha); n('mutedAlpha',presentation.mutedAlpha);
  }, [instance,presentation]);
  if (!riveFile || !instance) return null;
  return <View pointerEvents="none" style={{flex:1}}>
    <RiveView file={riveFile} dataBind={instance} artboardName="DangerRoomPlate"
      fit={Fit.Fill} autoPlay={false} style={{flex:1}}
      onError={(error)=>console.warn('[rive-plate]',error.message)} />
  </View>;
}
