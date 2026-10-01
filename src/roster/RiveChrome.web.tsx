import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RiveChromePresentation } from './RiveChrome.native';
export type { RiveChromePresentation } from './RiveChrome.native';
export function RiveChrome({presentation}:{presentation:RiveChromePresentation}) {
  return <View pointerEvents="none" style={[s.frame,presentation.goldAlpha>.5&&s.gold]}>
    <View style={s.header}><Text style={s.name}>{presentation.name}</Text><Text style={s.status}>{presentation.status}</Text></View>
  </View>;
}
const s=StyleSheet.create({frame:{flex:1,borderWidth:8,borderColor:'#cfd4da'},gold:{borderColor:'#eec645'},
header:{minHeight:34,flexDirection:'row',justifyContent:'space-between',paddingHorizontal:10,alignItems:'center'},
name:{color:'#16294d',fontWeight:'900'},status:{color:'#16294d',fontSize:10,fontWeight:'800'}});
