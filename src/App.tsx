import { Component } from 'solid-js';
import VideoGrid from './components/VideoGrid';

const App: Component = () => {
  return (
    <div class="flex flex-col h-screen bg-bg">
      <div class="w-full h-full">
        <VideoGrid />
      </div>
    </div>
  );
};

export default App;

