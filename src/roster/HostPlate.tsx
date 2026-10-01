import React, { type ReactNode } from 'react';
import { RivePlate } from './RivePlate';
export interface HostPlateProps {width:number;height:number;name:string;videoSlot?:ReactNode;level?:number;speaking?:boolean;tag?:string;animated?:boolean;font?:unknown}
export const HostPlate=({width,height,name,videoSlot,level=0,speaking=false,tag}:HostPlateProps)=>
<RivePlate width={width} height={height} name={name} status={tag??(videoSlot?'HOST · LIVE':'HOST · STANDBY')}
finish="silver" live={!!videoSlot} speaking={speaking} level={level} videoSlot={videoSlot}/>;
