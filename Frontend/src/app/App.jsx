import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";

function getRandomColor() {
  const colors = [
    "#e63946",
    "#457b9d",
    "#2a9d8f",
    "#f4a261",
    "#9b5de5",
    "#ff006e"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function App() {
  const canvasRef = useRef(null);
  const clearRef = useRef(null);
  const ctxRef = useRef(null);

  const [tool, setTool] = useState("pen");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [color, setColor] = useState("#000000");

  const saveBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // 📐 Grid background
  const drawGrid = (ctx, w, h) => {
    ctx.save();
    ctx.strokeStyle = "#f0f0f0";
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

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    if (!username) return;

    const ydoc = new Y.Doc();

    const provider = new SocketIOProvider(
      "https://multi-user-whiteboard.onrender.com",
      "whiteboard",
      ydoc,
      { autoConnect: true }
    );

    const yStrokes = ydoc.getArray("strokes");

    const userColor = getRandomColor();

    provider.awareness.setLocalStateField("user", {
      username,
      color: userColor,
      cursor: null
    });

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values());
      setUsers(
        states
          .filter(s => s.user?.username)
          .map(s => s.user)
      );
    };

    provider.awareness.on("change", updateUsers);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      render();
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid(ctx, canvas.width, canvas.height);

      yStrokes.toArray().forEach(stroke => {
        if (!stroke?.points?.length) return;

        ctx.strokeStyle = stroke.color || "#000";
        ctx.lineWidth = stroke.width || 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();

        const pts = stroke.points;
        ctx.moveTo(pts[0].x, pts[0].y);

        // ✨ smoothing via quadratic curve
        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }

        ctx.stroke();
      });
    };

    resize();
    window.addEventListener("resize", resize);

    yStrokes.observe(render);

    let drawing = false;
    let currentStroke = [];

    const start = (x, y) => {
      drawing = true;
      currentStroke = [{ x, y }];
    };

    const move = (x, y) => {
      if (!drawing) return;
      currentStroke.push({ x, y });
      renderLive();
    };

    const end = () => {
      if (!drawing) return;
      drawing = false;

      if (tool === "pen" && currentStroke.length > 1) {
        yStrokes.push([
          {
            points: [...currentStroke],
            color,
            width: 3
          }
        ]);
      }

      if (tool === "eraser") {
        const strokes = yStrokes.toArray();

        strokes.forEach((stroke, i) => {
          const hit = stroke.points.some(p =>
            currentStroke.some(e =>
              Math.abs(p.x - e.x) < 50 &&
              Math.abs(p.y - e.y) < 50
            )
          );

          if (hit) yStrokes.delete(i, 1);
        });
      }
    };

    const renderLive = () => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.strokeStyle = tool === "eraser" ? "#fff" : color;
      ctx.lineWidth = tool === "eraser" ? 30 : 3;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);

      currentStroke.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    };

    canvas.onmousedown = e => start(e.offsetX, e.offsetY);
    canvas.onmousemove = e => move(e.offsetX, e.offsetY);
    canvas.onmouseup = end;

    clearRef.current = () => yStrokes.delete(0, yStrokes.length);

    return () => {
      provider.disconnect();
      window.removeEventListener("resize", resize);
      ydoc.destroy();
    };
  }, [username, tool, color]);

  // 🔐 Better Join UI
  if (!username) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f5f5"
      }}>
        <div style={{
          background: "white",
          padding: 30,
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          textAlign: "center"
        }}>
          <h2>Join Whiteboard</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            setUsername(e.target.username.value);
          }}>
            <input
              name="username"
              placeholder="Enter name"
              style={{ padding: 10, marginTop: 10 }}
            />
            <br />
            <button style={{ marginTop: 10, padding: "8px 16px" }}>
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 🧭 Floating Toolbar */}
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
        boxShadow: "0 5px 20px rgba(0,0,0,0.1)",
        zIndex: 10
      }}>
        <button onClick={() => setTool("pen")}>✏️</button>
        <button onClick={() => setTool("eraser")}>🧽</button>

        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
        />

        <button onClick={saveBoard}>💾</button>
        <button onClick={() => clearRef.current()}>🧹</button>
      </div>

      {/* 👥 Users */}
      <div style={{ position: "absolute", top: 10, left: 10 }}>
        {users.map((u, i) => (
          <div key={i} style={{ color: u.color }}>
            {u.username}
          </div>
        ))}
      </div>

      {/* 🎨 Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: "100vw", height: "100vh", display: "block" }}
      />

      {/* 📱 Mobile toolbar */}
      <div style={{
        position: "fixed",
        bottom: 10,
        left: "50%",
        transform: "translateX(-50%)",
        background: "white",
        padding: 10,
        borderRadius: 20,
        display: "flex",
        gap: 10,
        boxShadow: "0 5px 20px rgba(0,0,0,0.1)"
      }}>
        <button onClick={() => setTool("pen")}>✏️</button>
        <button onClick={() => setTool("eraser")}>🧽</button>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} />
      </div>

      {/* 🖱 Cursors */}
      {users.map((u, i) => u.cursor && (
        <div key={i} style={{ position: "fixed", left: u.cursor.x, top: u.cursor.y }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: u.color }} />
        </div>
      ))}
    </>
  );
}
