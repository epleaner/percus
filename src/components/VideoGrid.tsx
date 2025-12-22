import { Component, createSignal, For, onMount, createEffect } from 'solid-js';
import YouTubePlayer from './YouTubePlayer';
import { getStateFromURL, setStateInURL, type PlayerState } from '../utils/urlState';

interface VideoGridProps {}

const VideoGrid: Component<VideoGridProps> = () => {
  // Load initial state from URL
  const urlState = getStateFromURL();
  const initialPlayerIds = urlState?.players.map(p => p.playerId) || [0];
  const [playerIds, setPlayerIds] = createSignal<number[]>(initialPlayerIds);
  const [playerStates, setPlayerStates] = createSignal<Map<number, PlayerState>>(new Map());

  const addPlayer = () => {
    const ids = playerIds();
    const newId = Math.max(...ids, -1) + 1;
    setPlayerIds([...ids, newId]);
  };

  const removePlayer = (id: number) => {
    const ids = playerIds();
    if (ids.length > 1) {
      setPlayerIds(ids.filter(pid => pid !== id));
      const states = playerStates();
      states.delete(id);
      setPlayerStates(new Map(states));
      updateURL();
    }
  };

  const handlePlayerStateChange = (state: PlayerState) => {
    const states = playerStates();
    states.set(state.playerId, state);
    setPlayerStates(new Map(states));
    updateURL();
  };

  const updateURL = () => {
    const states = Array.from(playerStates().values());
    setStateInURL({ players: states });
  };

  // Initialize player states from URL
  onMount(() => {
    if (urlState) {
      const statesMap = new Map<number, PlayerState>();
      urlState.players.forEach(state => {
        statesMap.set(state.playerId, state);
      });
      setPlayerStates(statesMap);
    }
  });

  return (
    <div class="flex flex-col h-full w-full p-6 gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-medium">Video Grid</h1>
        <button onClick={addPlayer} class="btn btn-primary">
          Add Video
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 overflow-y-auto pb-4">
        <For each={playerIds()}>
          {(id) => (
            <div class="flex flex-col border border-border rounded p-3 bg-bg-subtle min-h-0 h-fit">
              <div class="flex justify-end mb-1">
                <button
                  onClick={() => removePlayer(id)}
                  class="text-xs text-fg-muted hover:text-fg px-2"
                  disabled={playerIds().length === 1}
                >
                  ×
                </button>
              </div>
              <div class="flex-1 min-h-0">
                <YouTubePlayer 
                  playerId={id} 
                  initialState={playerStates().get(id)}
                  onStateChange={handlePlayerStateChange}
                />
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default VideoGrid;

