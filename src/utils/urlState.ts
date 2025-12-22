export interface PlayerState {
  playerId: number;
  searchQuery?: string;
  videoUrl?: string;
  videoId?: string;
  startTime?: number;
  endTime?: number;
}

export interface GridState {
  players: PlayerState[];
}

const STATE_KEY = 'grid';

export function serializeGridState(players: PlayerState[]): string {
  const state: GridState = { players };
  return btoa(JSON.stringify(state));
}

export function deserializeGridState(encoded: string): GridState | null {
  try {
    const decoded = atob(encoded);
    const state = JSON.parse(decoded) as GridState;
    return state;
  } catch {
    return null;
  }
}

export function getStateFromURL(): GridState | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(STATE_KEY);
  if (!encoded) return null;
  return deserializeGridState(encoded);
}

export function setStateInURL(state: GridState): void {
  const encoded = serializeGridState(state.players);
  const url = new URL(window.location.href);
  url.searchParams.set(STATE_KEY, encoded);
  window.history.replaceState({}, '', url.toString());
}

