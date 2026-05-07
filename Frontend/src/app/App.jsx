import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";

export default function App() {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState("pen");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // 🧠 YJS SETUP (SAFE)
    const ydoc = new Y.Doc();

    const provider = new SocketIOProvider(
      "https://multi-user-whiteboard.onrender.com",
      "whiteboard",
      ydoc,{autoConnect: true}
    );

    const yItems = ydoc.getArray("items");

    let drawing = false;
    let start = null;
    let points = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      render();
    };

    // 📐 GRID
    const drawGrid = () => {
      const step = 40;
      ctx.strokeStyle = "#eee";

      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    // 🎨 RENDER FROM YJS STATE
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid();

      const items = yItems.toArray();

      items.forEach(w => {
        const o = w?.[0];
        if (!o) return;

        ctx.strokeStyle = o.color || "#000";

        if (o.type === "pen") {
          ctx.beginPath();
          ctx.moveTo(o.points[0].x, o.points[0].y);

          for (let i = 1; i < o.points.length; i++) {
            ctx.lineTo(o.points[i].x, o.points[i].y);
          }

          ctx.stroke();
        }

        if (o.type === "rect") {
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }

        if (o.type === "circle") {
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    };

    resize();
    window.addEventListener("resize", resize);

    // 🔥 SAFE OBSERVER
    yItems.observe(render);

    // 📍 MOBILE FIXED COORDS
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    // 🟢 POINTER DOWN
    canvas.addEventListener("pointerdown", (e) => {
      drawing = true;
      const p = getPos(e);

      if (tool === "pen") {
        points = [p];
      }

      if (tool === "rect" || tool === "circle") {
        start = p;
      }
    });

    // ✏️ PEN LIVE DRAW
    canvas.addEventListener("pointermove", (e) => {
      if (!drawing || tool !== "pen") return;

      const p = getPos(e);
      points.push(p);

      const prev = points[points.length - 2];
      if (!prev) return;

      ctx.strokeStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });

    // 🔴 POINTER UP (SAVE TO YJS)
    canvas.addEventListener("pointerup", (e) => {
      drawing = false;

      const p = getPos(e);

      if (tool === "pen" && points.length > 1) {
        yItems.push([{
          type: "pen",
          points: [...points],
          color: "#000"
        }]);
      }

      if (tool === "rect" && start) {
        yItems.push([{
          type: "rect",
          x: start.x,
          y: start.y,
          w: p.x - start.x,
          h: p.y - start.y,
          color: "#000"
        }]);
      }

      if (tool === "circle" && start) {
        yItems.push([{
          type: "circle",
          x: start.x,
          y: start.y,
          r: Math.hypot(p.x - start.x, p.y - start.y),
          color: "#000"
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
  }, [tool]);

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
        background: "white",
        padding: 10,
        borderRadius: 10,
        zIndex: 10
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