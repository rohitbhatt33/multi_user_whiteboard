import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { SocketIOProvider } from "y-socket.io";

function getRandomColor() {
  const colors = ["#e63946", "#457b9d", "#2a9d8f", "#f4a261", "#9b5de5", "#ff006e"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function App() {
  const canvasRef = useRef(null);

  const [tool, setTool] = useState("pen");
  const [username, setUsername] = useState("");
  const [textBox, setTextBox] = useState(null);

  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });

  const panRef = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!username) return;

    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    const ydoc = new Y.Doc();

    const provider = new SocketIOProvider(
  "https://multi-user-whiteboard.onrender.com",
  "whiteboard",
  ydoc,
  {
    connect: true // only if your version supports options
  }
);

    const yObjects = ydoc.getArray("objects");
    window.__yObjects = yObjects;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let drawing = false;
    let start = null;
    let points = [];

    const userColor = getRandomColor();

    // 🚀 FIXED: MOBILE-PERFECT COORDINATE SYSTEM
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();

      // ONLY use CSS-space coordinates (this fixes mobile shift bug)
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      return {
        x: (x - offsetRef.current.x) / scaleRef.current,
        y: (y - offsetRef.current.y) / scaleRef.current
      };
    };

    const applyTransform = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(offsetRef.current.x, offsetRef.current.y);
      ctx.scale(scaleRef.current, scaleRef.current);
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

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      applyTransform();

      yObjects.toArray().forEach(obj => {
        if (!obj) return;

        ctx.strokeStyle = obj.color || "#000";
        ctx.fillStyle = obj.color || "#000";
        ctx.lineWidth = 2;

        // ✏️ PEN
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

        // ⬛ RECT
        if (obj.type === "rect") {
          ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
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

    canvas.style.touchAction = "none";

    // 🖱 DOWN
    canvas.onpointerdown = (e) => {
      e.preventDefault();

      const pos = getPos(e);

      if (e.button === 1 || tool === "pan") {
        panRef.current = true;
        lastPan.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (tool === "text") {
        setTextBox({ x: pos.x, y: pos.y, value: "" });
        return;
      }

      drawing = true;
      start = pos;
      points = [pos];
    };

    // 🖱 MOVE
    canvas.onpointermove = (e) => {
      const pos = getPos(e);

      // ✋ PAN
      if (panRef.current) {
        offsetRef.current.x += e.clientX - lastPan.current.x;
        offsetRef.current.y += e.clientY - lastPan.current.y;

        lastPan.current = { x: e.clientX, y: e.clientY };
        render();
        return;
      }

      // 🧽 ERASER
      if (tool === "eraser") {
        const objs = window.__yObjects.toArray();

        objs.forEach((obj, index) => {
          if (!obj?.points) return;

          const hit = obj.points.some(p =>
            Math.abs(p.x - pos.x) < 25 &&
            Math.abs(p.y - pos.y) < 25
          );

          if (hit) window.__yObjects.delete(index, 1);
        });

        return;
      }

      if (!drawing || tool !== "pen") return;

      points.push(pos);
    };

    // 🖱 UP
    canvas.onpointerup = (e) => {
      panRef.current = false;

      if (!drawing) return;
      drawing = false;

      const end = getPos(e);

      if (tool === "pen") {
        window.__yObjects.push([
          { type: "pen", points: [...points], color: "#000" }
        ]);
      }

      if (tool === "rect") {
        window.__yObjects.push([
          {
            type: "rect",
            x: start.x,
            y: start.y,
            w: end.x - start.x,
            h: end.y - start.y,
            color: "#000"
          }
        ]);
      }

      if (tool === "circle") {
        const r = Math.sqrt(
          Math.pow(end.x - start.x, 2) +
          Math.pow(end.y - start.y, 2)
        );

        window.__yObjects.push([
          {
            type: "circle",
            x: start.x,
            y: start.y,
            r,
            color: "#000"
          }
        ]);
      }
    };

    // 🔍 ZOOM
    canvas.onwheel = (e) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = (mouseX - offsetRef.current.x) / scaleRef.current;
      const worldY = (mouseY - offsetRef.current.y) / scaleRef.current;

      const zoom = e.deltaY < 0 ? 1.1 : 0.9;

      scaleRef.current *= zoom;

      offsetRef.current.x = mouseX - worldX * scaleRef.current;
      offsetRef.current.y = mouseY - worldY * scaleRef.current;

      render();
    };

    return () => {
      provider.disconnect();
      window.removeEventListener("resize", resize);
      ydoc.destroy();
    };
  }, [username, tool]);

  // 📝 SAVE TEXT
  const saveText = () => {
    if (!textBox?.value) {
      setTextBox(null);
      return;
    }

    window.__yObjects.push([
      {
        type: "text",
        x: textBox.x,
        y: textBox.y,
        text: textBox.value,
        color: "#000"
      }
    ]);

    setTextBox(null);
  };

  // 🔐 JOIN SCREEN
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
        <button onClick={() => setTool("text")}>📝</button>
        <button onClick={() => setTool("eraser")}>🧽</button>
        <button onClick={() => setTool("pan")}>✋</button>
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

      {/* TEXT INPUT */}
      {textBox && (
        <input
          autoFocus
          value={textBox.value}
          onChange={(e) =>
            setTextBox({ ...textBox, value: e.target.value })
          }
          onBlur={saveText}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.target.blur();
          }}
          style={{
            position: "fixed",
            left: textBox.x,
            top: textBox.y,
            fontSize: 16,
            padding: 4,
            background: "white",
            border: "1px solid #ccc",
            zIndex: 9999
          }}
        />
      )}
    </>
  );
}