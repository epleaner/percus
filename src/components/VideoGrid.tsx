import { Component, createSignal, For, onMount } from 'solid-js';
import YouTubePlayer from './YouTubePlayer';
import { serializeStateToURL, deserializeStateFromURL, type PlayerState, type GridState } from '../utils/urlState';

interface VideoGridProps {}

const VideoGrid: Component<VideoGridProps> = () => {
  const [playerStates, setPlayerStates] = createSignal<PlayerState[]>([]);

  // Load state from URL on mount
  onMount(() => {
    const savedState = deserializeStateFromURL();
    if (savedState && savedState.players.length > 0) {
      setPlayerStates(savedState.players);
    } else {
      // Default: one empty player
      setPlayerStates([{
        playerId: 0,
        startTime: 0,
        endTime: 0,
        isPlaying: false,
      }]);
    }
  });

  const addPlayer = () => {
    const states = playerStates();
    const newId = states.length > 0 ? Math.max(...states.map(s => s.playerId)) + 1 : 0;
    const newState: PlayerState = {
      playerId: newId,
      startTime: 0,
      endTime: 0,
      isPlaying: false,
    };
    const updated = [...states, newState];
    setPlayerStates(updated);
    saveStateToURL(updated);
  };

  const removePlayer = (id: number) => {
    const states = playerStates();
    if (states.length > 1) {
      const updated = states.filter(s => s.playerId !== id);
      setPlayerStates(updated);
      saveStateToURL(updated);
    }
  };

  const handlePlayerStateChange = (playerId: number, state: PlayerState) => {
    const states = playerStates();
    const updated = states.map(s => s.playerId === playerId ? state : s);
    setPlayerStates(updated);
    saveStateToURL(updated);
  };

  const saveStateToURL = (states: PlayerState[]) => {
    serializeStateToURL({ players: states });
  };

  return (
    <div class="flex flex-col h-full w-full p-6 gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-medium">Video Grid</h1>
        <button onClick={addPlayer} class="btn btn-primary">
          Add Video
        </button>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 overflow-y-auto pb-4">
        <For each={playerStates()}>
          {(state) => (
            <div class="flex flex-col border border-border rounded p-3 bg-bg-subtle min-h-0 h-fit">
              <div class="flex justify-end mb-1">
                <button
                  onClick={() => removePlayer(state.playerId)}
                  class="text-xs text-fg-muted hover:text-fg px-2"
                  disabled={playerStates().length === 1}
                >
                  ×
                </button>
              </div>
              <div class="flex-1 min-h-0">
                <YouTubePlayer
                  playerId={state.playerId}
                  initialState={state}
                  onStateChange={(newState) => handlePlayerStateChange(state.playerId, newState)}
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

