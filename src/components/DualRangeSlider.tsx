import { Component, createSignal, createEffect, onMount, onCleanup } from 'solid-js';

interface DualRangeSliderProps {
  min: number;
  max: number;
  startValue: number;
  endValue: number;
  onStartChange: (value: number) => void;
  onEndChange: (value: number) => void;
  disabled?: boolean;
  step?: number;
}

const DualRangeSlider: Component<DualRangeSliderProps> = (props) => {
  const [startValue, setStartValue] = createSignal(props.startValue);
  const [endValue, setEndValue] = createSignal(props.endValue);
  const [isDragging, setIsDragging] = createSignal<'start' | 'end' | null>(null);
  let containerRef: HTMLDivElement | undefined;
  let startThumbRef: HTMLDivElement | undefined;
  let endThumbRef: HTMLDivElement | undefined;

  createEffect(() => {
    setStartValue(props.startValue);
    setEndValue(props.endValue);
  });

  const getValueFromPosition = (clientX: number): number => {
    if (!containerRef) return 0;
    const rect = containerRef.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const value = props.min + (props.max - props.min) * percent;
    const stepped = Math.round(value / (props.step || 0.1)) * (props.step || 0.1);
    return Math.max(props.min, Math.min(props.max, stepped));
  };

  const handleMouseDown = (e: MouseEvent, type: 'start' | 'end') => {
    if (props.disabled) return;
    e.preventDefault();
    setIsDragging(type);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging() || props.disabled) return;
    
    const value = getValueFromPosition(e.clientX);
    const start = startValue();
    const end = endValue();

    if (isDragging() === 'start') {
      if (value <= end) {
        setStartValue(value);
        props.onStartChange(value);
      } else {
        // Swap if start exceeds end
        setStartValue(end);
        setEndValue(value);
        props.onStartChange(end);
        props.onEndChange(value);
        setIsDragging('end');
      }
    } else if (isDragging() === 'end') {
      if (value >= start) {
        setEndValue(value);
        props.onEndChange(value);
      } else {
        // Swap if end is less than start
        setEndValue(start);
        setStartValue(value);
        props.onEndChange(start);
        props.onStartChange(value);
        setIsDragging('start');
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  onMount(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  onCleanup(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });

  const handleContainerClick = (e: MouseEvent) => {
    if (props.disabled || isDragging() || !containerRef) return;
    
    const value = getValueFromPosition(e.clientX);
    const start = startValue();
    const end = endValue();
    const startDist = Math.abs(value - start);
    const endDist = Math.abs(value - end);
    
    // Move the closer thumb
    if (startDist < endDist && value <= end) {
      setStartValue(value);
      props.onStartChange(value);
    } else if (value >= start) {
      setEndValue(value);
      props.onEndChange(value);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startPercent = () => {
    if (props.max === props.min) return 0;
    return ((startValue() - props.min) / (props.max - props.min)) * 100;
  };
  
  const endPercent = () => {
    if (props.max === props.min) return 100;
    return ((endValue() - props.min) / (props.max - props.min)) * 100;
  };

  return (
    <div class="flex flex-col gap-2 w-full">
      <div 
        ref={containerRef}
        class="relative h-8 flex items-center cursor-pointer select-none"
        onClick={handleContainerClick}
      >
        {/* Track background */}
        <div class="absolute top-1/2 left-0 right-0 h-1.5 bg-border rounded -translate-y-1/2 pointer-events-none"></div>
        
        {/* Active range */}
        <div
          class="absolute top-1/2 h-1.5 bg-accent rounded -translate-y-1/2 pointer-events-none"
          style={`left: ${startPercent()}%; width: ${Math.max(0, endPercent() - startPercent())}%;`}
        ></div>

        {/* Start thumb */}
        <div
          ref={startThumbRef}
          class="absolute top-1/2 w-4 h-4 bg-accent border-2 border-bg rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 hover:scale-110 transition-transform"
          style={`left: ${startPercent()}%;`}
          onMouseDown={(e) => handleMouseDown(e, 'start')}
        ></div>

        {/* End thumb */}
        <div
          ref={endThumbRef}
          class="absolute top-1/2 w-4 h-4 bg-accent border-2 border-bg rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 hover:scale-110 transition-transform"
          style={`left: ${endPercent()}%;`}
          onMouseDown={(e) => handleMouseDown(e, 'end')}
        ></div>
      </div>

      {/* Labels */}
      <div class="flex justify-between text-xs text-fg-muted">
        <span>Start: {formatTime(startValue())}</span>
        <span>End: {formatTime(endValue())}</span>
      </div>
    </div>
  );
};

export default DualRangeSlider;
