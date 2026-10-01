import React, { createContext, useContext, type ReactNode } from 'react';

type GuestRenderer = (columns: number) => ReactNode;
const GuestRendererContext = createContext<GuestRenderer | null>(null);
const GuestColumnsContext = createContext(2);

export function RoomGuestProvider({ renderGuests, children }: { renderGuests: GuestRenderer; children: ReactNode }) {
  return <GuestRendererContext.Provider value={renderGuests}>{children}</GuestRendererContext.Provider>;
}
export function GuestColumnsProvider({ columns, children }: { columns: number; children: ReactNode }) {
  return <GuestColumnsContext.Provider value={columns}>{children}</GuestColumnsContext.Provider>;
}
export function RoomGuestPane() {
  const renderGuests = useContext(GuestRendererContext);
  const columns = useContext(GuestColumnsContext);
  return renderGuests ? <>{renderGuests(columns)}</> : null;
}
