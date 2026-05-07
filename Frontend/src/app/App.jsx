import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";

function getColor() {
  const c = ["#e63946", "#457b9d", "#2a9d8f", "#f4a261", "#9b5de5"];
  return c[Math.floor(Math.random() * c.length)];
}

export default function App() {
  const canvasRef = useRef(null);

  const [username, setUsername] = useState("");
  const [tool, setTool] = useState("pen");
  const [selectedId, setSelectedId] = useState(null);
  const [textBox, setTextBox] = useState(null);

  const undoStack = useRef([]);
  const redoStack = useRef([]);

  useEffect(() => {
    if (!username) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const ydoc = new Y.Doc();
    const provider = new SocketIOProvider(
      "https://multi-user-whiteboard.onrender.com",
      "whiteboard",
      ydoc,{autoConnect: true}
    );

    const items = ydoc.getArray("items");

    const color = getColor();

    let drawing = false;
    let stroke = [];
    let start = null;

    const saveState = () => {
      undoStack.current.push(JSON.stringify(items.toArray()));
      redoStack.current = [];
    };

    const drawGrid = () => {
      ctx.strokeStyle = "#eee";
      ctx.lineWidth = 1;

      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawGrid();

      const list = items.toArray();

      list.forEach(w => {
        const o = w?.[0];
        if (!o) return;

        ctx.strokeStyle = o.color || "#000";

        // PEN
        if (o.type === "pen") {
          ctx.beginPath();
          ctx.moveTo(o.points[0].x, o.points[0].y);
          o.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        }

        // RECT
        if (o.type === "rect") {
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }

        // CIRCLE
        if (o.type === "circle") {
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // TEXT
        if (o.type === "text") {
          ctx.font = "16px Arial";
          ctx.fillText(o.text, o.x, o.y);
        }

        // SELECTION BOX
        if (o.id === selectedId) {
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = "#00aaff";

          if (o.type === "rect") {
            ctx.strokeRect(o.x, o.y, o.w, o.h);
          }

          if (o.type === "circle") {
            ctx.beginPath();
            ctx.arc(o.x, o.y, o.r + 4, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.setLineDash([]);
        }
      });
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      render();
    };

    resize();
    window.addEventListener("resize", resize);

    items.observe(render);

    canvas.style.touchAction = "none";

    const getPos = (e) => ({
      x: e.clientX,
      y: e.clientY
    });

    // POINTER DOWN
    canvas.onpointerdown = (e) => {
      const p = getPos(e);

      const list = items.toArray();

      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i]?.[0];
        if (!o) continue;

        const hit =
          (o.type === "rect" &&
            p.x >= o.x && p.x <= o.x + o.w &&
            p.y >= o.y && p.y <= o.y + o.h) ||
          (o.type === "circle" &&
            Math.hypot(p.x - o.x, p.y - o.y) <= o.r);

        if (hit) {
          setSelectedId(o.id);
          return;
        }
      }

      setSelectedId(null);

      if (tool === "text") {
        setTextBox({ x: p.x, y: p.y, value: "" });
        return;
      }

      if (tool === "pen") {
        drawing = true;
        stroke = [p];
      }

      if (tool === "rect" || tool === "circle") {
        drawing = true;
        start = p;
      }
    };

    // MOVE
    canvas.onpointermove = (e) => {
      if (!drawing) return;

      const p = getPos(e);

      if (tool === "pen") {
        stroke.push(p);
      }
    };

    // UP
    canvas.onpointerup = (e) => {
      const p = getPos(e);

      drawing = false;

      saveState();

      // PEN
      if (tool === "pen" && stroke.length > 2) {
        items.push([{
          id: crypto.randomUUID(),
          type: "pen",
          points: stroke,
          color
        }]);
      }

      // RECT
      if (tool === "rect") {
        items.push([{
          id: crypto.randomUUID(),
          type: "rect",
          x: start.x,
          y: start.y,
          w: p.x - start.x,
          h: p.y - start.y,
          color
        }]);
      }

      // CIRCLE
      if (tool === "circle") {
        items.push([{
          id: crypto.randomUUID(),
          type: "circle",
          x: start.x,
          y: start.y,
          r: Math.hypot(p.x - start.x, p.y - start.y),
          color
        }]);
      }

      stroke = [];
      start = null;
    };

    // UNDO / REDO
    const handleKey = (e) => {
      if (e.ctrlKey && e.key === "z") {
        const prev = undoStack.current.pop();
        if (prev) {
          redoStack.current.push(JSON.stringify(items.toArray()));
          items.delete(0, items.length);
          JSON.parse(prev).forEach(i => items.push([i[0]]));
        }
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      provider.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKey);
      ydoc.destroy();
    };
  }, [username, tool, selectedId]);

  // LOGIN
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
        <button onClick={() => setTool("text")}>T</button>
      </div>

      {/* TEXT INPUT */}
      {textBox && (
        <input
          autoFocus
          style={{
            position: "absolute",
            left: textBox.x,
            top: textBox.y
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // can extend later
              setTextBox(null);
            }
          }}
        />
      )}

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