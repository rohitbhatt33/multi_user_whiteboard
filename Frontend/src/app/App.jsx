import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";

function getRandomColor() {
  const colors = ["#e63946", "#457b9d", "#2a9d8f", "#f4a261", "#9b5de5", "#ff006e"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function App() {
  const canvasRef = useRef(null);

  const [username, setUsername] = useState("");
  const [tool, setTool] = useState("pen");
  const [selectedId, setSelectedId] = useState(null);

  const viewport = useRef({ x: 0, y: 0, scale: 1 });
  const drag = useRef({ active: false, ox: 0, oy: 0 });

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

    const userColor = getRandomColor();

    provider.awareness.setLocalStateField("user", {
      username,
      color: userColor
    });

    let drawing = false;
    let stroke = [];

    // 🧠 GRID (FIXED + STABLE)
    const drawGrid = () => {
      const step = 40;
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.save();
      ctx.strokeStyle = "#eeeeee";
      ctx.lineWidth = 1;

      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.restore();
    };

    const screenToWorld = (x, y) => ({
      x: (x - viewport.current.x) / viewport.current.scale,
      y: (y - viewport.current.y) / viewport.current.scale
    });

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;

      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;

      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      render();
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawGrid();

      ctx.save();
      ctx.translate(viewport.current.x, viewport.current.y);
      ctx.scale(viewport.current.scale, viewport.current.scale);

      const items = yItems.toArray() || [];

      for (let i = 0; i < items.length; i++) {
        const wrap = items[i];
        if (!wrap || !Array.isArray(wrap)) continue;

        const o = wrap[0];
        if (!o || !o.type) continue;

        ctx.strokeStyle = o.color || "#000";

        // ✏ PEN
        if (o.type === "pen" && o.points?.length) {
          ctx.beginPath();
          ctx.moveTo(o.points[0].x, o.points[0].y);

          for (let j = 1; j < o.points.length; j++) {
            ctx.lineTo(o.points[j].x, o.points[j].y);
          }

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

        // 🧠 SELECTION
        if (o.id === selectedId) {
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = "#00aaff";

          if (o.type === "rect") ctx.strokeRect(o.x, o.y, o.w, o.h);

          if (o.type === "circle") {
            ctx.beginPath();
            ctx.arc(o.x, o.y, o.r + 4, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.setLineDash([]);
        }
      }

      ctx.restore();
    };

    resize();
    window.addEventListener("resize", resize);

    // 🔥 IMPORTANT: FORCE LIVE RENDER LOOP (FIXES "NOT WORKING" ISSUE)
    const loop = () => {
      render();
      requestAnimationFrame(loop);
    };
    loop();

    canvas.style.touchAction = "none";

    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const p = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      const items = yItems.toArray();

      for (let i = items.length - 1; i >= 0; i--) {
        const o = items[i]?.[0];
        if (!o) continue;

        const hit =
          (o.type === "rect" &&
            p.x >= o.x && p.x <= o.x + o.w &&
            p.y >= o.y && p.y <= o.y + o.h) ||
          (o.type === "circle" &&
            Math.hypot(p.x - o.x, p.y - o.y) <= o.r);

        if (hit) {
          setSelectedId(o.id);
          drag.current = {
            active: true,
            ox: p.x - o.x,
            oy: p.y - o.y
          };
          return;
        }
      }

      setSelectedId(null);

      drawing = true;
      stroke = [p];
    });

    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const p = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      // 🧲 DRAG
      if (drag.current.active && selectedId) {
        const arr = yItems.toArray();

        arr.forEach((wrap, i) => {
          const o = wrap?.[0];

          if (o?.id === selectedId) {
            o.x = p.x - drag.current.ox;
            o.y = p.y - drag.current.oy;

            yItems.delete(i, 1);
            yItems.insert(i, [o]);
          }
        });

        return;
      }

      if (!drawing) return;

      stroke.push(p);
    });

    canvas.addEventListener("pointerup", () => {
      drag.current.active = false;

      if (!drawing) return;
      drawing = false;

      if (stroke.length > 2) {
        yItems.push([{
          id: crypto.randomUUID(),
          type: "pen",
          points: stroke,
          color: userColor
        }]);
      }

      stroke = [];
    });

    // 🔥 ZOOM (MOBILE SAFE)
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const world = screenToWorld(mx, my);

      const zoom = e.deltaY < 0 ? 1.1 : 0.9;

      viewport.current.scale *= zoom;

      viewport.current.x = mx - world.x * viewport.current.scale;
      viewport.current.y = my - world.y * viewport.current.scale;
    });

    return () => {
      provider.disconnect();
      window.removeEventListener("resize", resize);
      ydoc.destroy();
    };
  }, [username, tool, selectedId]);

  // 🔐 LOGIN
  if (!username) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}>
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
        background: "white",
        padding: 10,
        borderRadius: 20,
        display: "flex",
        gap: 10,
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