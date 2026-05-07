import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";

function getColor() {
  const colors = ["#e63946", "#457b9d", "#2a9d8f", "#f4a261", "#9b5de5"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function App() {
  const canvasRef = useRef(null);

  const [username, setUsername] = useState("");
  const [tool, setTool] = useState("pen");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!username) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const ydoc = new Y.Doc();

    const provider = new SocketIOProvider(
      "https://multi-user-whiteboard.onrender.com",
      "whiteboard",
      ydoc,{autoConnect:true}
    );

    const yItems = ydoc.getArray("items");
    const color = getColor();

    // 👤 Awareness (IMPORTANT FIXED PART)
    provider.awareness.setLocalStateField("user", {
      username,
      color,
      cursor: null
    });

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values());

      setUsers(
        states
          .map(s => s.user)
          .filter(Boolean)
      );
    };

    provider.awareness.on("change", updateUsers);

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
      ctx.lineWidth = 1;

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

    // 🎨 RENDER
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

    yItems.observe(render);

    // 📍 FIX MOBILE COORDS
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    // 🟢 START
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

    // ✏️ MOVE
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

      // 👇 LIVE CURSOR UPDATE (IMPORTANT)
      provider.awareness.setLocalStateField("user", {
        username,
        color,
        cursor: p
      });
    });

    // 🔴 END
    canvas.addEventListener("pointerup", (e) => {
      drawing = false;

      const p = getPos(e);

      if (tool === "pen" && points.length > 1) {
        yItems.push([{
          type: "pen",
          points: [...points],
          color
        }]);
      }

      if (tool === "rect" && start) {
        yItems.push([{
          type: "rect",
          x: start.x,
          y: start.y,
          w: p.x - start.x,
          h: p.y - start.y,
          color
        }]);
      }

      if (tool === "circle" && start) {
        yItems.push([{
          type: "circle",
          x: start.x,
          y: start.y,
          r: Math.hypot(p.x - start.x, p.y - start.y),
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

  // 🔐 LOGIN SCREEN
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

      {/* 👥 USERS (FIXED - NOW VISIBLE) */}
      <div style={{
        position: "absolute",
        top: 10,
        left: 10,
        background: "white",
        padding: 10,
        borderRadius: 8,
        zIndex: 20
      }}>
        <strong>Users</strong>
        {users.map((u, i) => (
          <div key={i} style={{ color: u.color }}>
            ● {u.username}
          </div>
        ))}
      </div>

      {/* CURSORS */}
      {users.map((u, i) => u.cursor && (
        <div
          key={i}
          style={{
            position: "fixed",
            left: u.cursor.x,
            top: u.cursor.y,
            pointerEvents: "none",
            zIndex: 30
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