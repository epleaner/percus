export interface PlayerState {
  playerId: number;
  searchQuery?: string;
  videoUrl?: string;
  videoId?: string;
  startTime: number;
  endTime: number;
  isPlaying: boolean;
}

export interface GridState {
  players: PlayerState[];
}

export function serializeStateToURL(state: GridState): void {
  try {
    const encoded = btoa(JSON.stringify(state));
    const url = new URL(window.location.href);
    url.searchParams.set('state', encoded);
    window.history.replaceState({}, '', url.toString());
  } catch (error) {
    console.error('Failed to serialize state to URL:', error);
  }
}

export function deserializeStateFromURL(): GridState | null {
  try {
    const url = new URL(window.location.href);
    const encoded = url.searchParams.get('state');
    if (!encoded) return null;
    
    const decoded = atob(encoded);
    return JSON.parse(decoded) as GridState;
  } catch (error) {
    console.error('Failed to deserialize state from URL:', error);
    return null;
  }
}

export function clearURLState(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('state');
  window.history.replaceState({}, '', url.toString());
}

