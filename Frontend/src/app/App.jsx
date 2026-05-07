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
  const [users, setUsers] = useState([]);
  const [textInput, setTextInput] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const viewport = useRef({ scale: 1, x: 0, y: 0 });

  const drag = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const history = useRef({ past: [], future: [] });

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

    const yStrokes = ydoc.getArray("strokes");

    const userColor = getRandomColor();

    provider.awareness.setLocalStateField("user", {
      username,
      color: userColor
    });

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values());
      setUsers(states.filter(s => s.user?.username).map(s => s.user));
    };

    provider.awareness.on("change", updateUsers);

    let drawing = false;
    let current = [];

    const screenToWorld = (x, y) => ({
      x: (x - viewport.current.x) / viewport.current.scale,
      y: (y - viewport.current.y) / viewport.current.scale
    });

    const pushHistory = () => {
      history.current.past.push(JSON.stringify(yStrokes.toArray()));
      history.current.future = [];
    };

    const undo = () => {
      if (!history.current.past.length) return;

      history.current.future.push(JSON.stringify(yStrokes.toArray()));

      const prev = JSON.parse(history.current.past.pop());
      yStrokes.delete(0, yStrokes.length);
      yStrokes.push(prev);
      render();
    };

    const redo = () => {
      if (!history.current.future.length) return;

      history.current.past.push(JSON.stringify(yStrokes.toArray()));

      const next = JSON.parse(history.current.future.pop());
      yStrokes.delete(0, yStrokes.length);
      yStrokes.push(next);
      render();
    };

    const drawGrid = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.strokeStyle = "#eee";

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
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawGrid();

      ctx.save();
      ctx.translate(viewport.current.x, viewport.current.y);
      ctx.scale(viewport.current.scale, viewport.current.scale);

      yStrokes.toArray().forEach(wrap => {
        const o = wrap[0];
        if (!o) return;

        ctx.strokeStyle = o.color || "#000";
        ctx.fillStyle = o.color || "#000";

        if (o.type === "pen") {
          ctx.beginPath();
          ctx.moveTo(o.points[0].x, o.points[0].y);
          o.points.forEach(p => ctx.lineTo(p.x, p.y));
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

        if (o.type === "text") {
          ctx.font = "16px Arial";
          ctx.fillText(o.text, o.x, o.y);
        }

        if (o.id === selectedId) {
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = "#00aaff";

          if (o.type === "rect") ctx.strokeRect(o.x, o.y, o.w, o.h);
          if (o.type === "circle") {
            ctx.beginPath();
            ctx.arc(o.x, o.y, o.r + 5, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.setLineDash([]);
        }
      });

      ctx.restore();
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;

      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;

      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      render();
    };

    resize();
    window.addEventListener("resize", resize);

    yStrokes.observe(render);

    canvas.style.touchAction = "none";

    canvas.onpointerdown = (e) => {
      const rect = canvas.getBoundingClientRect();

      const x = (e.clientX - rect.left - viewport.current.x) / viewport.current.scale;
      const y = (e.clientY - rect.top - viewport.current.y) / viewport.current.scale;

      const objs = yStrokes.toArray();

      for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i][0];

        const hit =
          (o.type === "rect" &&
            x >= o.x && x <= o.x + o.w &&
            y >= o.y && y <= o.y + o.h) ||
          (o.type === "circle" &&
            Math.hypot(x - o.x, y - o.y) <= o.r);

        if (hit) {
          setSelectedId(o.id);
          drag.current = {
            active: true,
            offsetX: x - o.x,
            offsetY: y - o.y
          };
          return;
        }
      }

      setSelectedId(null);

      if (tool === "text") {
        setTextInput({ x, y, value: "" });
        return;
      }

      drawing = true;
      current = [{ x, y }];
    };

    canvas.onpointermove = (e) => {
      const rect = canvas.getBoundingClientRect();

      const x = (e.clientX - rect.left - viewport.current.x) / viewport.current.scale;
      const y = (e.clientY - rect.top - viewport.current.y) / viewport.current.scale;

      if (drag.current.active && selectedId) {
        const arr = yStrokes.toArray();

        arr.forEach((w, i) => {
          const o = w[0];
          if (o.id === selectedId) {
            o.x = x - drag.current.offsetX;
            o.y = y - drag.current.offsetY;

            yStrokes.delete(i, 1);
            yStrokes.insert(i, [o]);
          }
        });

        render();
        return;
      }

      if (!drawing) return;

      current.push({ x, y });

      ctx.beginPath();
      ctx.lineTo(x, y);
    };

    canvas.onpointerup = () => {
      drag.current.active = false;

      if (!drawing) return;
      drawing = false;

      if (tool === "pen") {
        yStrokes.push([{
          id: crypto.randomUUID(),
          type: "pen",
          points: [...current],
          color: userColor
        }]);
      }

      pushHistory();
    };

    canvas.onwheel = (e) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const world = screenToWorld(mx, my);

      const zoom = e.deltaY < 0 ? 1.1 : 0.9;

      viewport.current.scale *= zoom;

      viewport.current.x = mx - world.x * viewport.current.scale;
      viewport.current.y = my - world.y * viewport.current.scale;

      render();
    };

    return () => {
      provider.disconnect();
      window.removeEventListener("resize", resize);
      ydoc.destroy();
    };
  }, [username, tool, selectedId]);

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
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", background: "white", padding: 10, borderRadius: 20, display: "flex", gap: 10 }}>
        <button onClick={() => setTool("pen")}>✏️</button>
        <button onClick={() => setTool("rect")}>⬛</button>
        <button onClick={() => setTool("circle")}>⚪</button>
        <button onClick={() => setTool("text")}>📝</button>
        <button onClick={undo}>↩️</button>
        <button onClick={redo}>↪️</button>
      </div>

      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh", display: "block" }} />

      {/* TEXT INPUT */}
      {textInput && (
        <input
          autoFocus
          value={textInput.value}
          onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
          onBlur={() => {
            yStrokes.push([{
              id: crypto.randomUUID(),
              type: "text",
              x: textInput.x,
              y: textInput.y,
              text: textInput.value,
              color: "#000"
            }]);

            setTextInput(null);
          }}
          style={{
            position: "fixed",
            left: textInput.x,
            top: textInput.y
          }}
        />
      )}

      {/* USERS */}
      <div style={{ position: "absolute", top: 10, left: 10 }}>
        {users.map((u, i) => (
          <div key={i} style={{ color: u.color }}>{u.username}</div>
        ))}
      </div>
    </>
  );
}