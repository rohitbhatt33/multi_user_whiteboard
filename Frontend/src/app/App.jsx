import { useEffect, useRef, useState } from "react";

function getRandomColor() {
  const colors = ["#e63946", "#457b9d", "#2a9d8f", "#f4a261", "#9b5de5", "#00bbf9"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function App() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const [color, setColor] = useState("#e63946");
  const [isDrawing, setIsDrawing] = useState(false);
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState("");

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;

    ctxRef.current = ctx;

    drawGrid(ctx, canvas.width, canvas.height);
  }, []);

  // Update color
  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
    }
  }, [color]);

  const drawGrid = (ctx, w, h) => {
    ctx.save();
    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 1;

    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const startDraw = (e) => {
    setIsDrawing(true);
    const { offsetX, offsetY } = e.nativeEvent;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(offsetX, offsetY);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;

    // stroke smoothing (simple interpolation)
    ctxRef.current.lineTo(offsetX, offsetY);
    ctxRef.current.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  if (!joined) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="p-6 bg-white rounded-xl shadow-lg space-y-3">
          <h2 className="text-xl font-bold">Join Whiteboard</h2>
          <input
            className="border p-2 rounded w-full"
            placeholder="Enter room id"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
          <button
            className="bg-black text-white px-4 py-2 rounded w-full"
            onClick={() => setJoined(true)}
          >
            Join
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
      />

      {/* Modern floating toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-full px-4 py-2 flex gap-3 items-center">
        <button onClick={() => setColor(getRandomColor())}>🎨 Random</button>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <button onClick={() => ctxRef.current.clearRect(0, 0, window.innerWidth, window.innerHeight)}>
          🧹 Clear
        </button>
      </div>

      {/* Mobile bottom toolbar */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 md:hidden bg-white shadow-xl rounded-full px-4 py-2 flex gap-3">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button onClick={() => setColor(getRandomColor())}>🎨</button>
      </div>
    </div>
  );
}
