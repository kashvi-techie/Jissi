// Ambient declaration for the Skia web entry (the package ships its types in a
// parallel tree and doesn't map this subpath, so tsc can't resolve it directly).
declare module '@shopify/react-native-skia/lib/module/web' {
  import type React from 'react';
  export const WithSkiaWeb: <TProps extends object>(props: {
    getComponent: () => Promise<{ default: React.ComponentType<TProps> }>;
    fallback?: React.ReactNode;
    componentProps?: TProps;
    opts?: Record<string, unknown>;
  }) => React.JSX.Element;
}
