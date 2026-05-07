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

  useEffect(() => {
    if (!username) return;

    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    const ydoc = new Y.Doc();

    const provider = new SocketIOProvider(
      "https://multi-user-whiteboard.onrender.com",
      "whiteboard",
      ydoc,
      { autoConnect: true }
    );

    const yObjects = ydoc.getArray("objects");

    const userColor = getRandomColor();

    provider.awareness.setLocalStateField("user", {
      username,
      color: userColor,
      cursor: null
    });

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values());
      setUsers(states.filter(s => s.user?.username).map(s => s.user));
    };

    provider.awareness.on("change", updateUsers);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let drawing = false;
    let start = null;
    let currentPoints = [];

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

      yObjects.toArray().forEach(obj => {
        if (!obj) return;

        ctx.strokeStyle = obj.color || "#000";
        ctx.fillStyle = obj.color || "#000";
        ctx.lineWidth = 2;

        // ✏️ PEN (free draw)
        if (obj.type === "pen") {
          const pts = obj.points;
          if (!pts?.length) return;

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);

          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }

        // 🟦 RECTANGLE
        if (obj.type === "rect") {
          ctx.strokeRect(
            obj.x,
            obj.y,
            obj.w,
            obj.h
          );
        }

        // ⚪ CIRCLE
        if (obj.type === "circle") {
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 📝 TEXT
        if (obj.type === "text") {
          ctx.font = "16px Arial";
          ctx.fillText(obj.text, obj.x, obj.y);
        }
      });
    };

    resize();
    window.addEventListener("resize", resize);
    yObjects.observe(render);

    const getPos = (e) => ({
      x: e.clientX,
      y: e.clientY
    });

    // 🚀 POINTER START
    canvas.onpointerdown = (e) => {
      drawing = true;
      start = getPos(e);
      currentPoints = [start];
    };

    // 🚀 POINTER MOVE
    canvas.onpointermove = (e) => {
      provider.awareness.setLocalStateField("user", {
        username,
        color: userColor,
        cursor: getPos(e)
      });

      if (!drawing || tool !== "pen") return;

      currentPoints.push(getPos(e));
    };

    // 🚀 POINTER END (FINALIZE OBJECT)
    canvas.onpointerup = (e) => {
      if (!drawing) return;
      drawing = false;

      const end = getPos(e);

      // ✏ PEN
      if (tool === "pen") {
        yObjects.push([
          {
            type: "pen",
            points: [...currentPoints],
            color: userColor
          }
        ]);
      }

      // 🟦 RECT
      if (tool === "rect") {
        yObjects.push([
          {
            type: "rect",
            x: start.x,
            y: start.y,
            w: end.x - start.x,
            h: end.y - start.y,
            color: userColor
          }
        ]);
      }

      // ⚪ CIRCLE
      if (tool === "circle") {
        const r = Math.sqrt(
          Math.pow(end.x - start.x, 2) +
          Math.pow(end.y - start.y, 2)
        );

        yObjects.push([
          {
            type: "circle",
            x: start.x,
            y: start.y,
            r,
            color: userColor
          }
        ]);
      }

      // 📝 TEXT
      if (tool === "text") {
        const text = prompt("Enter text:");

        if (text) {
          yObjects.push([
            {
              type: "text",
              x: end.x,
              y: end.y,
              text,
              color: userColor
            }
          ]);
        }
      }
    };

    canvas.style.touchAction = "none";

    clearRef.current = () => {
      yObjects.delete(0, yObjects.length);
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
        <button onClick={() => setTool("rect")}>⬛</button>
        <button onClick={() => setTool("circle")}>⚪</button>
        <button onClick={() => setTool("text")}>📝</button>

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