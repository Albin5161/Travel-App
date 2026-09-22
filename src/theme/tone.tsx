import { createContext, useContext, type ReactNode } from 'react';

// Which palette the shared components (Text, Button) draw with. The app is light; anything drawn on
// top of a photo (place cards, the reel preview) wraps itself in <Tone value="dark">.
export type ToneName = 'dark' | 'light';

const ToneContext = createContext<ToneName>('light');

export function Tone({ value, children }: { value: ToneName; children: ReactNode }) {
  return <ToneContext.Provider value={value}>{children}</ToneContext.Provider>;
}

export const useTone = () => useContext(ToneContext);
