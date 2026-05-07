import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";

function getRandomColor() {
  const colors = ["#e63946", "#457b9d", "#2a9d8f", "#f4a261", "#9b5de5"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function App() {
  const canvasRef = useRef(null);

  const [username, setUsername] = useState("");
  const [tool, setTool] = useState("pen");

  useEffect(() => {
    if (!username) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const ydoc = new Y.Doc();
    const provider = new SocketIOProvider(
      "https://multi-user-whiteboard.onrender.com",
      "whiteboard",
      ydoc,{ autoConnect: true }
    );

    const yItems = ydoc.getArray("items");
    const color = getRandomColor();

    let drawing = false;
    let start = null;
    let points = [];

    // 📐 GRID
    const drawGrid = () => {
      const step = 40;
      ctx.strokeStyle = "#eee";
      ctx.lineWidth = 1;

      for (let x = 0; x < window.innerWidth; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, window.innerHeight);
        ctx.stroke();
      }

      for (let y = 0; y < window.innerHeight; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(window.innerWidth, y);
        ctx.stroke();
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      render();
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawGrid();

      const items = yItems.toArray();

      items.forEach(w => {
        const o = w?.[0];
        if (!o) return;

        ctx.strokeStyle = o.color || "#000";
        ctx.lineWidth = 2;

        // ✏ PEN
        if (o.type === "pen") {
          ctx.beginPath();
          ctx.moveTo(o.points[0].x, o.points[0].y);
          o.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }

        // ⬛ RECT
        if (o.type === "rect") {
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }

        // ⚪ CIRCLE
        if (o.type === "circle") {
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    };

    resize();
    window.addEventListener("resize", resize);

    yItems.observe(render);

    // 🔥 POINTER FIXED (THIS WAS YOUR MAIN ISSUE)
    canvas.addEventListener("pointerdown", (e) => {
      drawing = true;

      const x = e.clientX;
      const y = e.clientY;

      if (tool === "pen") {
        points = [{ x, y }];
      }

      if (tool === "rect" || tool === "circle") {
        start = { x, y };
      }
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return;

      const x = e.clientX;
      const y = e.clientY;

      // ✏ PEN LIVE DRAW
      if (tool === "pen") {
        points.push({ x, y });

        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    });

    canvas.addEventListener("pointerup", (e) => {
      drawing = false;

      const x = e.clientX;
      const y = e.clientY;

      // ✏ SAVE PEN
      if (tool === "pen" && points.length > 2) {
        yItems.push([{
          type: "pen",
          points: [...points],
          color
        }]);
      }

      // ⬛ RECT
      if (tool === "rect") {
        yItems.push([{
          type: "rect",
          x: start.x,
          y: start.y,
          w: x - start.x,
          h: y - start.y,
          color
        }]);
      }

      // ⚪ CIRCLE
      if (tool === "circle") {
        const r = Math.hypot(x - start.x, y - start.y);

        yItems.push([{
          type: "circle",
          x: start.x,
          y: start.y,
          r,
          color
        }]);
      }

      points = [];
      start = null;
    });

    return () => {
      provider.disconnect();
      window.removeEventListener("resize", resize);
      ydoc.destroy();
    };
  }, [username, tool]);

  // 🔐 LOGIN
  if (!username) {
    return (
      <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <form onSubmit={(e) => {
          e.preventDefault();
          setUsername(e.target.username.value);
        }}>
          <input name="username" placeholder="Enter name" />
          <button>Join</button>
        </form>
      </div>
    );
  }

  return (
    <>
      {/* TOOLBAR */}
      <div style={{
        position: "absolute",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 10,
        zIndex: 10,
        background: "white",
        padding: 10,
        borderRadius: 20
      }}>
        <button onClick={() => setTool("pen")}>✏️</button>
        <button onClick={() => setTool("rect")}>⬛</button>
        <button onClick={() => setTool("circle")}>⚪</button>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          width: "100vw",
          height: "100vh",
          display: "block",
          touchAction: "none"
        }}
      />
    </>
  );
}