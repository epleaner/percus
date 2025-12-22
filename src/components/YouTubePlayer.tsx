import { Component, createSignal, onMount, onCleanup, Show, createEffect } from 'solid-js';
import { searchYouTubeVideos, type YouTubeSearchResult } from '../utils/youtubeSearch';
import DualRangeSlider from './DualRangeSlider';
import { globalPlaybackClock } from '../utils/playbackClock';
import { type PlayerState } from '../utils/urlState';

interface YouTubePlayerProps {
  playerId: number;
  initialState?: PlayerState;
  onStateChange?: (state: PlayerState) => void;
}

// YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const YouTubePlayer: Component<YouTubePlayerProps> = (props) => {
  // Initialize from props or URL state (one-time read)
  const initialState = props.initialState;
  const [videoUrl, setVideoUrl] = createSignal(initialState?.videoUrl || '');
  const [videoId, setVideoId] = createSignal<string | null>(initialState?.videoId || null);
  const [player, setPlayer] = createSignal<any>(null);
  const [startTime, setStartTime] = createSignal(initialState?.startTime || 0);
  const [endTime, setEndTime] = createSignal(initialState?.endTime || 0);
  const [videoDuration, setVideoDuration] = createSignal(0);
  const [isLooping, setIsLooping] = createSignal(true);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [_loopLength, setLoopLength] = createSignal(0);
  const [searchQuery, setSearchQuery] = createSignal(initialState?.searchQuery || '');
  const [hasLoadedInitialState, setHasLoadedInitialState] = createSignal(!!initialState);
  const [isApiReady, setIsApiReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [searchResults, setSearchResults] = createSignal<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);
  const [showSearchResults, setShowSearchResults] = createSignal(false);
  const [sortOrder, setSortOrder] = createSignal<'asc' | 'desc'>('asc');
  const [nextPageToken, setNextPageToken] = createSignal<string | undefined>(undefined);
  const [currentThreshold, setCurrentThreshold] = createSignal<number | undefined>(undefined);

  // Notify parent of state changes (for URL serialization)
  const notifyStateChange = () => {
    if (props.onStateChange) {
      props.onStateChange({
        playerId: props.playerId,
        searchQuery: searchQuery(),
        videoUrl: videoUrl(),
        videoId: videoId() || undefined,
        startTime: startTime(),
        endTime: endTime(),
      });
    }
  };

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

  // Subscribe to global clock for play/pause synchronization
  let playUnsubscribe: (() => void) | null = null;
  let pauseUnsubscribe: (() => void) | null = null;

  // Load YouTube IFrame API
  onMount(() => {
    if (window.YT && window.YT.Player) {
      setIsApiReady(true);
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setIsApiReady(true);
      };
    }

    // Subscribe to global clock play/pause events
    playUnsubscribe = globalPlaybackClock.subscribePlay(() => {
      if (player() && !isPlaying()) {
        // When global play is triggered, start from beginning of loop
        const start = startTime();
        player().seekTo(start, true);
        player().playVideo();
      }
    });

    pauseUnsubscribe = globalPlaybackClock.subscribePause(() => {
      if (player() && isPlaying()) {
        player().pauseVideo();
      }
    });
  });

  onCleanup(() => {
    if (playUnsubscribe) playUnsubscribe();
    if (pauseUnsubscribe) pauseUnsubscribe();
  });

  // Initialize player when video ID is set and API is ready
  const initializePlayer = () => {
    if (!isApiReady() || !videoId()) return;

    const playerElement = document.getElementById(`youtube-player-${props.playerId}`);
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

    const ytPlayer = new window.YT.Player(`youtube-player-${props.playerId}`, {
      videoId: videoId()!,
      playerVars: {
        autoplay: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
      },
      events: {
        onReady: (event: any) => {
          const ytPlayer = event.target;
          setPlayer(ytPlayer);
          setError(null);
          // Get video duration
          const duration = ytPlayer.getDuration();
          if (duration && duration > 0) {
            setVideoDuration(duration);
            
            // Use initial state if available, otherwise set random 1-5 second loop segment
            if (hasLoadedInitialState() && initialState?.startTime !== undefined && initialState?.endTime !== undefined) {
              // Use initial state from URL
              setStartTime(initialState.startTime);
              setEndTime(Math.min(initialState.endTime, duration));
              setLoopLength(initialState.endTime - initialState.startTime);
              ytPlayer.seekTo(initialState.startTime, true);
            } else {
              // Set random 1-5 second loop segment
              const loopDuration = Math.floor(Math.random() * 5) + 1; // 1-5 seconds
              const maxStart = Math.max(0, duration - loopDuration);
              const randomStart = Math.floor(Math.random() * maxStart);
              
              // Ensure loop length is a multiple of 1 second
              const roundedStart = Math.floor(randomStart);
              const roundedEnd = roundedStart + loopDuration;
              
              setStartTime(roundedStart);
              setEndTime(Math.min(roundedEnd, duration));
              setLoopLength(loopDuration);
              
              // Seek to the start of the loop segment
              ytPlayer.seekTo(roundedStart, true);
              
              // Update URL state with new random range
              notifyStateChange();
            }
            
          }
          // Auto-start looping
          setIsLooping(true);
        },
        onError: (event: any) => {
          setError('Failed to load video. Please check the URL.');
        },
        onStateChange: (event: any) => {
          // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            if (isLooping()) {
              checkLoop();
            }
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (event.data === window.YT.PlayerState.ENDED && isLooping()) {
            // Restart loop when video ends
            const start = startTime();
            event.target.seekTo(start, true);
            event.target.playVideo();
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

  // Load video by ID
  const loadVideoById = (id: string) => {
    // Stop loop and destroy existing player
    stopLoopCheck();
    setIsPlaying(false);
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
    // Only reset time range if not loading from initial state
    if (!hasLoadedInitialState()) {
      setStartTime(0);
      setEndTime(0);
    }
    setVideoDuration(0);
    setLoopLength(0);
    setShowSearchResults(false);
    setIsLooping(true);
    setHasLoadedInitialState(false); // Reset flag after first load
    notifyStateChange();
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

    loadVideoById(id);
  };

  // Handle search
  const handleSearch = async (isLoadMore: boolean = false) => {
    const query = searchQuery().trim();
    if (!query && !isLoadMore) {
      setError('Please enter a search query');
      return;
    }

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsSearching(true);
      setSearchResults([]);
      setNextPageToken(undefined);
      setCurrentThreshold(undefined);
    }
    setError(null);

    try {
      const response = await searchYouTubeVideos(
        query,
        12,
        isLoadMore ? nextPageToken() : undefined,
        currentThreshold()
      );
      
      if (response.items.length === 0 && !isLoadMore) {
        setError('No videos found. Try a different search term.');
        setSearchResults([]);
        setShowSearchResults(false);
      } else {
        const newResults = isLoadMore 
          ? [...searchResults(), ...response.items]
          : response.items;
        
        // Sort by view count (ascending by default)
        const sorted = [...newResults].sort((a, b) => {
          if (sortOrder() === 'asc') {
            return a.viewCount - b.viewCount;
          } else {
            return b.viewCount - a.viewCount;
          }
        });
        setSearchResults(sorted);
        setNextPageToken(response.nextPageToken);
        setCurrentThreshold(response.currentThreshold);
        setShowSearchResults(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search videos');
      if (!isLoadMore) {
        setSearchResults([]);
      }
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  };

  // Handle infinite scroll
  const handleScroll = (e: Event) => {
    const container = e.currentTarget as HTMLDivElement;
    if (isLoadingMore() || !nextPageToken()) return;
    
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Load more when within 200px of bottom
    if (scrollHeight - scrollTop - clientHeight < 200) {
      handleSearch(true);
    }
  };

  // Handle selecting a video from search results
  const handleSelectVideo = (result: YouTubeSearchResult) => {
    const url = `https://www.youtube.com/watch?v=${result.videoId}`;
    setVideoUrl(url);
    loadVideoById(result.videoId);
  };

  // Handle play/pause toggle - sync with global clock
  const handlePlayPause = () => {
    if (!player()) return;

    if (isPlaying()) {
      // Pause this player directly and notify global clock
      player().pauseVideo();
      globalPlaybackClock.pause();
    } else {
      // When starting, seek to beginning of loop and use global play
      const start = startTime();
      player().seekTo(start, true);
      globalPlaybackClock.play();
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
    if (isLooping() && player() && videoDuration() > 0) {
      startLoopCheck();
    } else {
      stopLoopCheck();
    }
  });

  // Auto-start loop when player and duration are ready
  createEffect(() => {
    if (player() && videoDuration() > 0 && isLooping()) {
      const start = startTime();
      const end = endTime();
      if (end > start && end > 0) {
        player().seekTo(start, true);
        startLoopCheck();
      }
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
    <div class="flex flex-col h-full w-full gap-2 overflow-hidden">
      <div class="flex flex-col gap-2 flex-1 min-h-0">
        {/* Search Section */}
        <div class="flex flex-col gap-2">
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Search for low-view videos..."
              value={searchQuery()}
              onInput={(e) => {
                setSearchQuery(e.currentTarget.value);
                notifyStateChange();
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              class="input flex-1"
              disabled={isSearching()}
            />
            <button 
              onClick={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              class="btn btn-primary"
              disabled={isSearching()}
            >
              {isSearching() ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* URL Input Section */}
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="Or enter YouTube URL"
            value={videoUrl()}
            onInput={(e) => {
              setVideoUrl(e.currentTarget.value);
              notifyStateChange();
            }}
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

        {/* Search Results */}
        <Show when={showSearchResults() && searchResults().length > 0}>
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="text-sm text-fg-muted">
                Search Results ({searchResults().length})
                <Show when={currentThreshold() !== undefined}>
                  <span class="text-xs text-fg-subtle ml-1">
                    (max {currentThreshold()?.toLocaleString()} views)
                  </span>
                </Show>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-xs text-fg-muted">Sort by views:</label>
                <select
                  value={sortOrder()}
                  onChange={(e) => {
                    const order = e.currentTarget.value as 'asc' | 'desc';
                    setSortOrder(order);
                    const sorted = [...searchResults()].sort((a, b) => {
                      if (order === 'asc') {
                        return a.viewCount - b.viewCount;
                      } else {
                        return b.viewCount - a.viewCount;
                      }
                    });
                    setSearchResults(sorted);
                  }}
                  class="input text-xs py-1 px-2"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
            <div 
              onScroll={handleScroll}
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto max-h-96"
            >
              {searchResults().map((result) => (
                <button
                  onClick={() => handleSelectVideo(result)}
                  class="flex gap-3 p-2 border border-border hover:bg-bg-muted transition-colors text-left"
                >
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    class="w-24 h-18 object-cover flex-shrink-0"
                  />
                  <div class="flex flex-col gap-1 min-w-0 flex-1">
                    <div class="text-xs font-medium text-fg overflow-hidden" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                      {result.title}
                    </div>
                    <div class="text-xs text-fg-muted truncate">
                      {result.channelTitle}
                    </div>
                    <div class="text-xs text-fg-subtle">
                      {result.viewCount.toLocaleString()} views
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Show when={nextPageToken() && !isLoadingMore()}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleSearch(true);
                }}
                class="btn btn-secondary w-full"
              >
                Load More
              </button>
            </Show>
            <Show when={isLoadingMore()}>
              <div class="text-center text-xs text-fg-muted py-2">Loading more...</div>
            </Show>
          </div>
        </Show>

        <Show when={videoId()}>
          <div class="flex flex-col gap-4 flex-1 min-h-0">
            <Show when={videoDuration() > 0}>
              <div class="flex flex-col gap-2">
                <label class="text-xs text-fg-muted">Loop Range</label>
                <DualRangeSlider
                  min={0}
                  max={videoDuration()}
                  startValue={startTime()}
                  endValue={endTime()}
                  onStartChange={(value) => {
                    setStartTime(value);
                    if (player() && isPlaying()) {
                      player().seekTo(value, true);
                    }
                  }}
                  onEndChange={(value) => setEndTime(value)}
                  disabled={false}
                  step={0.1}
                />
              </div>
            </Show>
            <div class="flex items-center gap-2">
              <button
                onClick={handlePlayPause}
                class="btn btn-primary"
                disabled={!player() || videoDuration() === 0}
              >
                {isPlaying() ? 'Pause' : 'Play'}
              </button>
            </div>

            <div class="w-full flex-shrink-0" style="aspect-ratio: 16/9;">
              <div id={`youtube-player-${props.playerId}`} class="w-full h-full"></div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default YouTubePlayer;

