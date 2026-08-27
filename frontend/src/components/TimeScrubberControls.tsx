import React, { useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Rewind, 
  Clock, 
  Activity, 
  Sliders
} from 'lucide-react';

interface TimeScrubberControlsProps {
  currentTimeSec: number;
  minTimeSec: number;
  maxTimeSec: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onScrub: (sec: number) => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
}

export const TimeScrubberControls: React.FC<TimeScrubberControlsProps> = ({
  currentTimeSec,
  minTimeSec,
  maxTimeSec,
  isPlaying,
  playbackSpeed,
  onTogglePlay,
  onScrub,
  onSetSpeed,
  onReset,
}) => {
  const timeSpan = Math.max(1, maxTimeSec - minTimeSec);
  const elapsedSec = Math.max(0, Math.round(currentTimeSec - minTimeSec));

  const formatClock = (sec: number) => {
    if (!sec || isNaN(sec)) return '00:00:00';
    const d = new Date(sec * 1000);
    return d.toISOString().slice(11, 19);
  };

  // Playback timer animation tick
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const next = currentTimeSec + 1 * playbackSpeed;
      if (next >= maxTimeSec) {
        onScrub(minTimeSec);
      } else {
        onScrub(next);
      }
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, maxTimeSec, minTimeSec, currentTimeSec, onScrub]);

  return (
    <div className="bg-[#101B1F] border-2 border-slate-700/80 rounded-2xl p-4 shadow-xl font-mono text-xs text-slate-300 space-y-3">
      
      {/* Upper Bar: Controls, Clock Readout, Speed Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Playback Action Buttons */}
        <div className="flex items-center space-x-2">
          
          <button
            onClick={onReset}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all active:scale-95"
            title="Reset Timeline to Start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onScrub(Math.max(minTimeSec, currentTimeSec - 5))}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all active:scale-95"
            title="Step Back -5s"
          >
            <Rewind className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold transition-all shadow-md active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-tuas-teal hover:bg-tuas-cyan text-psa-navy shadow-tuas-teal/20'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </button>

          <button
            onClick={() => onScrub(Math.min(maxTimeSec, currentTimeSec + 5))}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all active:scale-95"
            title="Step Forward +5s"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        {/* Middle: Scrubber Timestamp Metric Displays */}
        <div className="flex items-center space-x-4 bg-black/40 px-4 py-2 rounded-xl border border-slate-700">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-tuas-cyan animate-pulse" />
            <span className="text-slate-400 text-[10px] uppercase font-bold">UTC Time:</span>
            <span className="text-white font-mono font-black text-sm">{formatClock(currentTimeSec)}</span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Elapsed:</span>
            <span className="text-tuas-teal font-mono font-bold">+{elapsedSec}s</span>
            <span className="text-slate-500">/ {Math.round(timeSpan)}s</span>
          </div>
        </div>

        {/* Right: Playback Speed Selection */}
        <div className="flex items-center space-x-1 bg-black/40 p-1 rounded-xl border border-slate-700 text-[10px]">
          <span className="text-slate-500 px-2 font-bold uppercase">Speed:</span>
          {[1, 2, 5, 10].map(spd => (
            <button
              key={spd}
              onClick={() => onSetSpeed(spd)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                playbackSpeed === spd
                  ? 'bg-tuas-cyan text-psa-navy shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Time Range Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={minTimeSec}
          max={maxTimeSec}
          step={0.5}
          value={currentTimeSec}
          onChange={(e) => onScrub(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-tuas-cyan focus:outline-none focus:ring-2 focus:ring-tuas-cyan/50"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>T0: {formatClock(minTimeSec)}</span>
          <span>LIVE SYNCHRONIZED PLAYHEAD</span>
          <span>T_MAX: {formatClock(maxTimeSec)}</span>
        </div>
      </div>
    </div>
  );
};
