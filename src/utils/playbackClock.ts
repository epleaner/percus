class PlaybackClock {
  private isPlaying: boolean = false;
  private playListeners: Set<() => void> = new Set();
  private pauseListeners: Set<() => void> = new Set();

  isGlobalPlaying(): boolean {
    return this.isPlaying;
  }

  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.notifyPlay();
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.notifyPause();
  }

  subscribePlay(callback: () => void): () => void {
    this.playListeners.add(callback);
    return () => {
      this.playListeners.delete(callback);
    };
  }

  subscribePause(callback: () => void): () => void {
    this.pauseListeners.add(callback);
    return () => {
      this.pauseListeners.delete(callback);
    };
  }

  private notifyPlay(): void {
    this.playListeners.forEach(callback => callback());
  }

  private notifyPause(): void {
    this.pauseListeners.forEach(callback => callback());
  }
}

export const globalPlaybackClock = new PlaybackClock();

