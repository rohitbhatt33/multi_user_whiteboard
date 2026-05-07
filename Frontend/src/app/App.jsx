import { useEffect, useRef, useState } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"

function getRandomColor() {
  const colors = [
    "#e63946",
    "#457b9d",
    "#2a9d8f",
    "#f4a261",
    "#9b5de5",
    "#ff006e"
  ]

  return colors[Math.floor(Math.random() * colors.length)]
}

export default function App() {
  const canvasRef = useRef(null)
  const clearRef = useRef(null)

  const [tool, setTool] = useState("pen")
  const [username, setUsername] = useState("")
  const [users, setUsers] = useState([])

  // 💾 Save Board
  const saveBoard = () => {
    const canvas = canvasRef.current

    if (!canvas) return

    const link = document.createElement("a")

    link.download = `whiteboard-${Date.now()}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  useEffect(() => {
    document.body.style.margin = "0"
    document.body.style.overflow = "hidden"

    if (!username) return

    const ydoc = new Y.Doc()

    const provider = new SocketIOProvider(
      "https://multi-user-whiteboard.onrender.com",
      "whiteboard",
      ydoc,
      { autoConnect: true }
    )

    const yStrokes = ydoc.getArray("strokes")

    const userColor = getRandomColor()

    // 👤 User awareness
    provider.awareness.setLocalStateField("user", {
      username,
      color: userColor,
      cursor: null
    })

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values())

      setUsers(
        states
          .filter(state => state.user?.username)
          .map(state => state.user)
      )
    }

    updateUsers()

    provider.awareness.on("change", updateUsers)

    const canvas = canvasRef.current

    if (!canvas) return

    const ctx = canvas.getContext("2d")

    // 📱 Mobile touch helper
    const getTouchPos = (touch) => {
      const rect = canvas.getBoundingClientRect()

      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      }
    }

    // 🎨 Render all strokes
    const render = () => {
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      yStrokes.toArray().forEach(stroke => {
        if (!stroke?.points || stroke.points.length < 2) return

        ctx.beginPath()

        ctx.strokeStyle = stroke.color || "#000000"
        ctx.lineWidth = stroke.width || 3
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        const first = stroke.points[0]

        ctx.moveTo(first.x, first.y)

        stroke.points.forEach(point => {
          ctx.lineTo(point.x, point.y)
        })

        ctx.stroke()
      })
    }

    // 📏 Responsive canvas
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      render()
    }

    resizeCanvas()

    window.addEventListener("resize", resizeCanvas)

    yStrokes.observe(render)

    render()

    let drawing = false
    let currentStroke = []

    // 🖱 Mouse Start
    canvas.onmousedown = (e) => {
      drawing = true

      currentStroke = [
        {
          x: e.offsetX,
          y: e.offsetY
        }
      ]
    }

    // 🖱 Mouse Move
    canvas.onmousemove = (e) => {
      provider.awareness.setLocalStateField("user", {
        username,
        color: userColor,
        cursor: {
          x: e.clientX,
          y: e.clientY
        }
      })

      if (!drawing) return

      currentStroke.push({
        x: e.offsetX,
        y: e.offsetY
      })

      render()

      ctx.strokeStyle =
        tool === "eraser" ? "#ffffff" : userColor

      ctx.lineWidth =
        tool === "eraser" ? 30 : 3

      ctx.lineCap = "round"

      ctx.beginPath()

      ctx.moveTo(
        currentStroke[0].x,
        currentStroke[0].y
      )

      currentStroke.forEach(p => {
        ctx.lineTo(p.x, p.y)
      })

      ctx.stroke()
    }

    // 🖱 Mouse End
    canvas.onmouseup = () => {
      if (!drawing) return

      drawing = false

      // ✏ Pen
      if (tool === "pen") {
        if (currentStroke.length > 1) {
          yStrokes.push([
            {
              points: [...currentStroke],
              color: userColor,
              width: 3
            }
          ])
        }
      }

      // 🧽 Eraser
      if (tool === "eraser") {
        const strokes = yStrokes.toArray()

        strokes.forEach((stroke, index) => {
          if (!stroke?.points) return

          const shouldDelete = stroke.points.some(point =>
            currentStroke.some(eraserPoint =>
              Math.abs(point.x - eraserPoint.x) < 50 &&
              Math.abs(point.y - eraserPoint.y) < 50
            )
          )

          if (shouldDelete) {
            yStrokes.delete(index, 1)
          }
        })
      }
    }

    // 📱 Touch Start
    canvas.ontouchstart = (e) => {
      e.preventDefault()

      drawing = true

      const pos = getTouchPos(e.touches[0])

      currentStroke = [pos]
    }

    // 📱 Touch Move
    canvas.ontouchmove = (e) => {
      e.preventDefault()

      const pos = getTouchPos(e.touches[0])

      provider.awareness.setLocalStateField("user", {
        username,
        color: userColor,
        cursor: pos
      })

      if (!drawing) return

      currentStroke.push(pos)

      render()

      ctx.strokeStyle =
        tool === "eraser" ? "#ffffff" : userColor

      ctx.lineWidth =
        tool === "eraser" ? 30 : 3

      ctx.lineCap = "round"

      ctx.beginPath()

      ctx.moveTo(
        currentStroke[0].x,
        currentStroke[0].y
      )

      currentStroke.forEach(p => {
        ctx.lineTo(p.x, p.y)
      })

      ctx.stroke()
    }

    // 📱 Touch End
    canvas.ontouchend = () => {
      canvas.onmouseup()
    }

    // 🧽 Clear Board
    clearRef.current = () => {
      yStrokes.delete(0, yStrokes.length)
    }

    // 🧹 Cleanup
    return () => {
      provider.disconnect()

      window.removeEventListener(
        "resize",
        resizeCanvas
      )

      ydoc.destroy()
    }

  }, [username, tool])

  // 🔐 Join Screen
  if (!username) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()

            setUsername(
              e.target.username.value
            )
          }}
        >
          <input
            name="username"
            placeholder="Enter your name"
            style={{
              padding: 10,
              marginRight: 10
            }}
          />

          <button type="submit">
            Join
          </button>
        </form>
      </div>
    )
  }

  return (
    <>
      {/* 👥 Users */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          background: "white",
          padding: 10,
          borderRadius: 6,
          zIndex: 10
        }}
      >
        <strong>Users:</strong>

        <ul>
          {users.map((u, i) => (
            <li
              key={i}
              style={{
                color: u.color
              }}
            >
              {u.username}
            </li>
          ))}
        </ul>
      </div>

      {/* 🧽 Clear */}
      <button
        onClick={() => clearRef.current()}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          padding: "8px 14px",
          background: "red",
          color: "white",
          border: "none",
          borderRadius: 5,
          cursor: "pointer",
          zIndex: 20
        }}
      >
        Clear
      </button>

      {/* 💾 Save */}
      <button
        onClick={saveBoard}
        style={{
          position: "absolute",
          top: 10,
          right: 100,
          padding: "8px 14px",
          background: "green",
          color: "white",
          border: "none",
          borderRadius: 5,
          cursor: "pointer",
          zIndex: 20
        }}
      >
        Save
      </button>

      {/* ✏ Tools */}
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 10,
          display: "flex",
          gap: 10,
          zIndex: 20
        }}
      >
        <button
          onClick={() => setTool("pen")}
          style={{
            padding: "6px 12px",
            background:
              tool === "pen"
                ? "black"
                : "#ccc",
            color: "white",
            border: "none",
            borderRadius: 5,
            cursor: "pointer"
          }}
        >
          Pen
        </button>

        <button
          onClick={() => setTool("eraser")}
          style={{
            padding: "6px 12px",
            background:
              tool === "eraser"
                ? "black"
                : "#ccc",
            color: "white",
            border: "none",
            borderRadius: 5,
            cursor: "pointer"
          }}
        >
          Eraser
        </button>
      </div>

      {/* 🎨 Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: "100vw",
          height: "100vh",
          display: "block",
          touchAction: "none"
        }}
      />

      {/* 🖱 Cursors */}
      {users.map((u, i) =>
        u.cursor ? (
          <div
            key={i}
            style={{
              position: "fixed",
              left: u.cursor.x,
              top: u.cursor.y,
              pointerEvents: "none",
              transform:
                "translate(-50%, -50%)",
              zIndex: 30
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: u.color
              }}
            />

            <div
              style={{
                fontSize: 12,
                background: u.color,
                color: "white",
                padding: "2px 6px",
                borderRadius: 4,
                marginTop: 4
              }}
            >
              {u.username}
            </div>
          </div>
        ) : null
      )}
    </>
  )
}