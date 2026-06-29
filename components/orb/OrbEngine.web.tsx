import React from 'react';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { PlasmaOrb } from './PlasmaOrb';
import type { OrbProps } from './OrbSkia';

/**
 * Web entry: loads CanvasKit (WASM) lazily, then renders the shader orb. The SVG
 * orb is shown as the fallback while CanvasKit loads — and if it never does, the
 * app still works (it just keeps the SVG orb). The heavy Skia code is only pulled
 * via the dynamic import, so it never bloats the initial web bundle.
 */
export function OrbEngine(props: OrbProps) {
  return (
    <WithSkiaWeb<OrbProps>
      getComponent={() => import('./OrbSkia')}
      componentProps={props}
      // Self-hosted CanvasKit: load the wasm from /canvaskit.wasm (served from
      // public/), NOT from a relative path or CDN. Absolute path so it resolves
      // correctly on every route. The file is version-locked via scripts/copy-canvaskit.mjs.
      opts={{ locateFile: (file: string) => `/${file}` }}
      fallback={<PlasmaOrb state={props.state} size={Math.round((props.size ?? 260) * 0.8)} />}
    />
  );
}
