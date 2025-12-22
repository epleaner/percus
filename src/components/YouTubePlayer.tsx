import { Component, createSignal, onMount, onCleanup, Show, createEffect } from 'solid-js';

interface YouTubePlayerProps {}

// YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const YouTubePlayer: Component<YouTubePlayerProps> = () => {
  const [videoUrl, setVideoUrl] = createSignal('');
  const [videoId, setVideoId] = createSignal<string | null>(null);
  const [player, setPlayer] = createSignal<any>(null);
  const [startTime, setStartTime] = createSignal(0);
  const [endTime, setEndTime] = createSignal(0);
  const [isLooping, setIsLooping] = createSignal(false);
  const [isApiReady, setIsApiReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Extract video ID from YouTube URL
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Load YouTube IFrame API
  onMount(() => {
    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setIsApiReady(true);
    };
  });

  // Initialize player when video ID is set and API is ready
  const initializePlayer = () => {
    if (!isApiReady() || !videoId()) return;

    const playerElement = document.getElementById('youtube-player');
    if (!playerElement) return;

    // Destroy existing player if any
    if (player()) {
      try {
        player().destroy();
      } catch (e) {
        // Ignore errors
      }
      setPlayer(null);
    }

    // Clear the container
    playerElement.innerHTML = '';

    const ytPlayer = new window.YT.Player('youtube-player', {
      videoId: videoId()!,
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: (event: any) => {
          setPlayer(event.target);
          setError(null);
        },
        onError: (event: any) => {
          setError('Failed to load video. Please check the URL.');
        },
        onStateChange: (event: any) => {
          // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
          if (event.data === window.YT.PlayerState.PLAYING && isLooping()) {
            checkLoop();
          }
        },
      },
    });

    setPlayer(ytPlayer);
  };

  // Check if we need to loop
  const checkLoop = () => {
    if (!player() || !isLooping()) return;

    const currentTime = player().getCurrentTime();
    const end = endTime();

    if (end > 0 && currentTime >= end) {
      const start = startTime();
      player().seekTo(start, true);
    }
  };

  // Set up interval to check loop when playing
  let loopInterval: number | null = null;

  const startLoopCheck = () => {
    if (loopInterval) return;
    loopInterval = window.setInterval(() => {
      if (player() && player().getPlayerState() === window.YT.PlayerState.PLAYING) {
        checkLoop();
      }
    }, 100); // Check every 100ms
  };

  const stopLoopCheck = () => {
    if (loopInterval) {
      clearInterval(loopInterval);
      loopInterval = null;
    }
  };

  // Handle URL submission
  const handleLoadVideo = () => {
    const url = videoUrl().trim();
    if (!url) {
      setError('Please enter a YouTube URL');
      return;
    }

    const id = extractVideoId(url);
    if (!id) {
      setError('Invalid YouTube URL');
      return;
    }

    // Stop loop and destroy existing player
    stopLoopCheck();
    setIsLooping(false);
    if (player()) {
      try {
        player().destroy();
      } catch (e) {
        // Ignore errors
      }
      setPlayer(null);
    }

    setVideoId(id);
    setError(null);
    setStartTime(0);
    setEndTime(0);
  };

  // Handle loop toggle
  const handleToggleLoop = () => {
    if (!player()) return;

    const newLooping = !isLooping();
    setIsLooping(newLooping);

    if (newLooping) {
      const start = startTime();
      const end = endTime();
      if (end > start && end > 0) {
        player().seekTo(start, true);
        startLoopCheck();
      } else {
        setError('Please set a valid time range (end time must be greater than start time)');
        setIsLooping(false);
      }
    } else {
      stopLoopCheck();
    }
  };

  // Initialize player when video ID or API readiness changes
  createEffect(() => {
    if (isApiReady() && videoId()) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initializePlayer();
      }, 100);
      return () => clearTimeout(timer);
    }
  });

  // Update loop check when looping state changes
  createEffect(() => {
    if (isLooping() && player()) {
      startLoopCheck();
    } else {
      stopLoopCheck();
    }
  });

  // Cleanup
  onCleanup(() => {
    stopLoopCheck();
    if (player()) {
      try {
        player().destroy();
      } catch (e) {
        // Ignore errors
      }
    }
  });

  return (
    <div class="flex flex-col h-full w-full p-6 gap-4">
      <div class="flex flex-col gap-4">
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Enter YouTube URL"
            value={videoUrl()}
            onInput={(e) => setVideoUrl(e.currentTarget.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleLoadVideo();
              }
            }}
            class="input flex-1"
          />
          <button onClick={handleLoadVideo} class="btn btn-primary">
            Load Video
          </button>
        </div>

        <Show when={error()}>
          <div class="text-sm text-red-500">{error()}</div>
        </Show>

        <Show when={videoId()}>
          <div class="flex flex-col gap-4">
            <div class="flex gap-4 items-center">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-fg-muted">Start Time (seconds)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={startTime()}
                  onInput={(e) => setStartTime(parseFloat(e.currentTarget.value) || 0)}
                  class="input w-32"
                  disabled={isLooping()}
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-fg-muted">End Time (seconds)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={endTime()}
                  onInput={(e) => setEndTime(parseFloat(e.currentTarget.value) || 0)}
                  class="input w-32"
                  disabled={isLooping()}
                />
              </div>
              <div class="flex items-end">
                <button
                  onClick={handleToggleLoop}
                  class={`btn ${isLooping() ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={!player() || endTime() <= startTime() || endTime() <= 0}
                >
                  {isLooping() ? 'Stop Loop' : 'Start Loop'}
                </button>
              </div>
            </div>

            <div class="w-full" style="aspect-ratio: 16/9;">
              <div id="youtube-player" class="w-full h-full"></div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default YouTubePlayer;

