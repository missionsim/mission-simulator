declare module '3d-tiles-renderer/r3f' {
  import type { TilesRenderer as TilesRendererImpl } from '3d-tiles-renderer';
  import type { ReactNode, Ref } from 'react';

  export interface TilesRendererProps {
    url?: string;
    ref?: Ref<TilesRendererImpl>;
    children?: ReactNode;
    [key: string]: unknown;
  }

  export const TilesRenderer: (props: TilesRendererProps) => JSX.Element;
  export const TilesPlugin: (props: { plugin: any; [key: string]: unknown }) => JSX.Element;
  export const TilesAttributionOverlay: () => JSX.Element;
}

declare module '3d-tiles-renderer/plugins' {
  export const GLTFExtensionsPlugin: any;
  export const GoogleCloudAuthPlugin: any;
  export const TileCompressionPlugin: any;
  export const TilesFadePlugin: any;
  export const UpdateOnChangePlugin: any;
} 