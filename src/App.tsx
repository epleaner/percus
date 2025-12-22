import { Component } from 'solid-js';
import YouTubePlayer from './components/YouTubePlayer';

const App: Component = () => {
  return (
    <div class="flex flex-col h-screen bg-bg">
      <div class="flex items-center justify-center h-full">
        <div class="w-full max-w-6xl h-full">
          <YouTubePlayer />
        </div>
      </div>
    </div>
  );
};

export default App;

