import React from 'react';
import OrbSkia, { OrbProps } from './OrbSkia';

/**
 * Native (and tsc base) entry: Skia is synchronous here, so render the shader
 * orb directly. The `.web.tsx` sibling overrides this to lazy-load CanvasKit.
 */
export function OrbEngine(props: OrbProps) {
  return <OrbSkia {...props} />;
}
