import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";

function getRandomColor() {
  const colors = ["#e63946", "#457b9d", "#2a9d8f", "#f4a261", "#9b5de5", "#ff006e"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function App() {
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

  const [tool, setTool] = useState("pen");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [editingText, setEditingText] = useState(null);

  useEffect(() => {
    if (!username) return;

    const ydoc = new Y.Doc();

    const provider = new SocketIOProvider(
      "https://multi-user-whiteboard.onrender.com",
      "whiteboard",
      ydoc,{autoConnect:true}
    );

    const yObjects = ydoc.getArray("objects");

    const userColor = getRandomColor();

    provider.awareness.setLocalStateField("user", {
      username,
      color: userColor,
      cursor: null
    });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let drawing = false;
    let start = null;
    let points = [];

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

        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = 2;

        // ✏️ PEN
        if (obj.type === "pen") {
          const pts = obj.points;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);

          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }

          ctx.stroke();
        }

        // 📝 TEXT (now editable + visible)
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

    // 🖱 POINTER DOWN
    canvas.onpointerdown = (e) => {
      const pos = getPos(e);

      // 📝 TEXT TOOL → create editable text object
      if (tool === "text") {
        const newText = {
          type: "text",
          x: pos.x,
          y: pos.y,
          text: "Type...",
          color: userColor
        };

        yObjects.push([newText]);

        setEditingText({
          obj: newText,
          x: pos.x,
          y: pos.y
        });

        setTimeout(() => {
          inputRef.current.focus();
        }, 0);

        return;
      }

      drawing = true;
      start = pos;
      points = [pos];
    };

    // 🖱 MOVE (pen only)
    canvas.onpointermove = (e) => {
      if (!drawing || tool !== "pen") return;
      points.push(getPos(e));
    };

    // 🖱 UP
    canvas.onpointerup = () => {
      if (!drawing) return;
      drawing = false;

      if (tool === "pen") {
        yObjects.push([
          {
            type: "pen",
            points: [...points],
            color: userColor
          }
        ]);
      }
    };

    canvas.style.touchAction = "none";

    return () => {
      provider.disconnect();
      window.removeEventListener("resize", resize);
      ydoc.destroy();
    };
  }, [username, tool]);

  // ✍️ SAVE TEXT EDIT
  const saveText = (value) => {
    const canvas = canvasRef.current;
    const ydoc = window.__ydoc;
    if (!editingText) return;

    const ctx = canvas.__yctx;

    editingText.obj.text = value;

    setEditingText(null);
  };

  // 🔐 JOIN
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
        <button onClick={() => setTool("text")}>📝</button>
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

      {/* 📝 REAL INLINE TEXT EDITOR */}
      {editingText && (
        <input
          ref={inputRef}
          defaultValue={editingText.obj.text}
          onBlur={(e) => {
            editingText.obj.text = e.target.value;
            setEditingText(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.target.blur();
            }
          }}
          style={{
            position: "fixed",
            left: editingText.x,
            top: editingText.y,
            fontSize: 16,
            border: "1px solid #ccc",
            padding: 4,
            outline: "none",
            background: "white"
          }}
        />
      )}
    </>
  );
}