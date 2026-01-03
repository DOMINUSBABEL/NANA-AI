import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
  beatFreq: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ isPlaying, beatFreq }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      // Clear with transparency for trail effect
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)'; // Dark blue background fade
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!isPlaying) {
         // Gentle idle animation
         time += 0.01;
      } else {
         // Speed depends on beat frequency (e.g., Delta 2Hz = Slower)
         time += 0.01 + (beatFreq * 0.005);
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Draw soothing concentric circles/blobs
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const radius = 100 + (i * 60) + Math.sin(time + i) * 30;
        const hue = 220 + (Math.sin(time * 0.5) * 20); // Blueish range
        
        const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
        gradient.addColorStop(0, `hsla(${hue}, 70%, 80%, 0)`);
        gradient.addColorStop(0.5, `hsla(${hue}, 60%, 70%, 0.1)`);
        gradient.addColorStop(1, `hsla(${hue}, 50%, 60%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw gentle particles
      for(let j = 0; j < 20; j++) {
         const angle = (j / 20) * Math.PI * 2 + time * 0.2;
         const dist = 150 + Math.sin(time * 2 + j) * 50;
         const px = centerX + Math.cos(angle) * dist;
         const py = centerY + Math.sin(angle) * dist;
         
         ctx.beginPath();
         ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
         ctx.arc(px, py, 2, 0, Math.PI * 2);
         ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [isPlaying, beatFreq]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 opacity-60"
    />
  );
};

export default Visualizer;
