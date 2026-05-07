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
  const [users, setUsers] = useState([]);
  const [color, setColor] = useState("#000000");

  const [textInput, setTextInput] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const dragRef = useRef({
    active: false,
    offsetX: 0,
    offsetY: 0
  });

  const viewportRef = useRef({
    scale: 1,
    offsetX: 0,
    offsetY: 0
  });

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    if (!username) return;

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
    let currentStroke = [];
    let isPanning = false;
    let lastPan = { x: 0, y: 0 };

    // 🎯 TRANSFORM
    const screenToWorld = (x, y) => {
      const v = viewportRef.current;
      return {
        x: (x - v.offsetX) / v.scale,
        y: (y - v.offsetY) / v.scale
      };
    };

    const applyTransform = () => {
      const v = viewportRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(v.offsetX, v.offsetY);
      ctx.scale(v.scale, v.scale);
    };

    // 📐 GRID
    const drawGrid = (w, h) => {
      ctx.save();
      ctx.strokeStyle = "#f0f0f0";

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

    const hitTest = (obj, x, y) => {
      if (!obj) return false;

      if (obj.type === "rect") {
        return (
          x >= obj.x &&
          x <= obj.x + obj.w &&
          y >= obj.y &&
          y <= obj.y + obj.h
        );
      }

      if (obj.type === "circle") {
        const dx = x - obj.x;
        const dy = y - obj.y;
        return Math.sqrt(dx * dx + dy * dy) <= obj.r;
      }

      if (obj.type === "text") {
        return (
          x >= obj.x &&
          x <= obj.x + 200 &&
          y >= obj.y - 20 &&
          y <= obj.y
        );
      }

      if (obj.type === "pen") {
        return obj.points?.some(p =>
          Math.abs(p.x - x) < 5 &&
          Math.abs(p.y - y) < 5
        );
      }

      return false;
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

      drawGrid(window.innerWidth, window.innerHeight);

      ctx.save();
      applyTransform();

      yStrokes.toArray().forEach((wrap) => {
        const obj = wrap[0];
        if (!obj) return;

        ctx.strokeStyle = obj.color || "#000";
        ctx.fillStyle = obj.color || "#000";

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

        // 🎯 SELECTION HIGHLIGHT
        if (obj.id === selectedId) {
          ctx.save();
          ctx.strokeStyle = "#00aaff";
          ctx.setLineDash([5, 5]);

          if (obj.type === "rect") {
            ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
          }

          if (obj.type === "circle") {
            ctx.beginPath();
            ctx.arc(obj.x, obj.y, obj.r + 5, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.restore();
        }
      });

      ctx.restore();
    };

    const renderLive = () => {
      ctx.save();
      applyTransform();

      ctx.strokeStyle = userColor;
      ctx.lineWidth = 3;

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

    // 🖱 POINTER DOWN (SELECTION + DRAW)
    canvas.onpointerdown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const v = viewportRef.current;

      const x = (e.clientX - rect.left - v.offsetX) / v.scale;
      const y = (e.clientY - rect.top - v.offsetY) / v.scale;

      // 🎯 HIT TEST (SELECT)
      const objs = yStrokes.toArray();

      for (let i = objs.length - 1; i >= 0; i--) {
        const obj = objs[i][0];

        if (hitTest(obj, x, y)) {
          setSelectedId(obj.id);

          dragRef.current = {
            active: true,
            offsetX: x - obj.x,
            offsetY: y - obj.y
          };

          return;
        }
      }

      setSelectedId(null);

      drawing = true;
      currentStroke = [{ x, y }];
    };

    // 🖱 POINTER MOVE
    canvas.onpointermove = (e) => {
      if (dragRef.current.active && selectedId) {
        const rect = canvas.getBoundingClientRect();
        const v = viewportRef.current;

        const x = (e.clientX - rect.left - v.offsetX) / v.scale;
        const y = (e.clientY - rect.top - v.offsetY) / v.scale;

        const newX = x - dragRef.current.offsetX;
        const newY = y - dragRef.current.offsetY;

        const arr = yStrokes.toArray();

        arr.forEach((wrap, index) => {
          const obj = wrap[0];

          if (obj.id === selectedId) {
            obj.x = newX;
            obj.y = newY;

            yStrokes.delete(index, 1);
            yStrokes.insert(index, [obj]);
          }
        });

        render();
        return;
      }

      if (!drawing) return;

      const rect = canvas.getBoundingClientRect();
      const v = viewportRef.current;

      const x = (e.clientX - rect.left - v.offsetX) / v.scale;
      const y = (e.clientY - rect.top - v.offsetY) / v.scale;

      currentStroke.push({ x, y });

      renderLive();
    };

    const end = () => {
      dragRef.current.active = false;

      if (!drawing) return;
      drawing = false;

      const last = currentStroke[currentStroke.length - 1];

      yStrokes.push([{
        id: crypto.randomUUID(),
        type: "pen",
        points: [...currentStroke],
        color: userColor
      }]);
    };

    canvas.onpointerup = end;
    canvas.onpointerleave = end;

    // 🔥 ZOOM
    canvas.onwheel = (e) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const v = viewportRef.current;

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const world = screenToWorld(mx, my);

      const zoom = Math.exp((e.deltaY < 0 ? 1 : -1) * 0.1);
      const newScale = v.scale * zoom;

      v.offsetX = mx - world.x * newScale;
      v.offsetY = my - world.y * newScale;
      v.scale = newScale;

      render();
    };

    return () => {
      provider.disconnect();
      window.removeEventListener("resize", resize);
      ydoc.destroy();
    };
  }, [username, tool, color, selectedId]);

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
      <div style={{ position: "absolute", top: 10, left: 10 }}>
        {users.map((u, i) => (
          <div key={i} style={{ color: u.color }}>
            {u.username}
          </div>
        ))}
      </div>

      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh", display: "block" }} />
    </>
  );
}