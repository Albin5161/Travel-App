import type { captureRef as CaptureRef } from 'react-native-view-shot';

// The web never pictures a view: its share images are drawn on a canvas (cardImage.ts).
export const captureRef: typeof CaptureRef = () => Promise.reject(new Error('Not on the web'));
