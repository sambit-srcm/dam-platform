import { whenLoaded } from '../../lib/whenLoaded';
import type { AssetView } from './types';
import type { ViewState } from './AssetViewer';

export async function loadViewState(
  loadView: (assetId: string) => Promise<AssetView>,
  assetId: string,
  isCancelled: () => boolean,
  onState: (state: ViewState) => void,
) {
  return whenLoaded(
    loadView(assetId),
    isCancelled,
    (view) => onState({ status: 'ready', view }),
    (message) => onState({ status: 'error', message }),
  );
}
