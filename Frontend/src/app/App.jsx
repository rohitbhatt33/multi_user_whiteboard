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

  const [tool, setTool] = useState("pen");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [color, setColor] = useState("#000000");

  // 🔥 ZOOM STATE (ADDED ONLY)
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    if (!username) return;

    const ydoc = new Y.Doc();

    const provider = new SocketIOProvider(
      "https://multi-user-whiteboard.onrender.com",
      "whiteboard",
      ydoc,{autoConnect:true,connect: true}
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

    let drawing = false;
    let currentStroke = [];

    // 📐 GRID
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

    // 📏 CANVAS RESIZE
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;

      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;

      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      render();
    };

    // 🎯 RENDER
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawGrid(ctx, window.innerWidth, window.innerHeight);

      ctx.save();

      // 🔥 APPLY ZOOM + PAN
      ctx.translate(offsetRef.current.x, offsetRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      yStrokes.toArray().forEach(stroke => {
        if (!stroke?.points?.length) return;

        ctx.strokeStyle = stroke.color || "#000";
        ctx.lineWidth = stroke.width || 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const pts = stroke.points;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }

        ctx.stroke();
      });

      ctx.restore();
    };

    const renderLive = () => {
      ctx.save();

      ctx.translate(offsetRef.current.x, offsetRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);

      ctx.strokeStyle = tool === "eraser" ? "#fff" : userColor;
      ctx.lineWidth = tool === "eraser" ? 30 : 3;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);

      currentStroke.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();

      ctx.restore();
    };

    resize();
    window.addEventListener("resize", resize);
    yStrokes.observe(render);

    canvas.style.touchAction = "none";

    // 🖱 POINTER DOWN
    canvas.onpointerdown = (e) => {
      drawing = true;

      const rect = canvas.getBoundingClientRect();

      currentStroke = [
        {
          x: (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current,
          y: (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current
        }
      ];
    };

    // 🖱 POINTER MOVE
    canvas.onpointermove = (e) => {
      provider.awareness.setLocalStateField("user", {
        username,
        color: userColor,
        cursor: {
          x: e.clientX,
          y: e.clientY
        }
      });

      if (!drawing) return;

      const rect = canvas.getBoundingClientRect();

      currentStroke.push({
        x: (e.clientX - rect.left - offsetRef.current.x) / scaleRef.current,
        y: (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current
      });

      renderLive();
    };

    // 🖱 POINTER UP
    const end = () => {
      if (!drawing) return;
      drawing = false;

      if (tool === "pen" && currentStroke.length > 1) {
        yStrokes.push([
          {
            points: [...currentStroke],
            color: userColor,
            width: 3
          }
        ]);
      }

      if (tool === "eraser") {
        const strokes = yStrokes.toArray();

        strokes.forEach((stroke, index) => {
          const hit = stroke.points.some(p =>
            currentStroke.some(e =>
              Math.abs(p.x - e.x) < 50 &&
              Math.abs(p.y - e.y) < 50
            )
          );

          if (hit) yStrokes.delete(index, 1);
        });
      }
    };

    canvas.onpointerup = end;
    canvas.onpointerleave = end;

    clearRef.current = () => {
      yStrokes.delete(0, yStrokes.length);
    };

    // 🔥 ZOOM FEATURE (ADDED)
    canvas.onwheel = (e) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - offsetRef.current.x) / scaleRef.current;
      const worldY = (mouseY - offsetRef.current.y) / scaleRef.current;

      const zoomIntensity = 0.1;
      const wheel = e.deltaY < 0 ? 1 : -1;
      const zoom = Math.exp(wheel * zoomIntensity);

      const newScale = scaleRef.current * zoom;

      offsetRef.current.x = mouseX - worldX * newScale;
      offsetRef.current.y = mouseY - worldY * newScale;

      scaleRef.current = newScale;

      render();
    };

    return () => {
      provider.disconnect();
      window.removeEventListener("resize", resize);
      ydoc.destroy();
    };
  }, [username, tool, color]);

  // 🔐 JOIN SCREEN
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
          <button type="submit">Join</button>
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
        <button onClick={() => setTool("eraser")}>🧽</button>

        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
        />

        <button onClick={() => clearRef.current()}>🧹</button>
      </div>

      {/* USERS */}
      <div style={{ position: "absolute", top: 10, left: 10 }}>
        {users.map((u, i) => (
          <div key={i} style={{ color: u.color }}>
            {u.username}
          </div>
        ))}
      </div>

      {/* CANVAS */}
      <canvas
        ref={canvasRef}
        style={{
          width: "100vw",
          height: "100vh",
          display: "block"
        }}
      />

      {/* CURSORS */}
      {users.map((u, i) => u.cursor && (
        <div
          key={i}
          style={{
            position: "fixed",
            left: u.cursor.x,
            top: u.cursor.y,
            pointerEvents: "none"
          }}
        >
          <div style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: u.color
          }} />
        </div>
      ))}
    </>
  );
}