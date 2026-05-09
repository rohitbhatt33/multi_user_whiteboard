# Multi-User Whiteboard

A collaborative real-time whiteboard application that allows multiple users to draw, share ideas, and collaborate together in real-time.

🔗 **Live Demo:** [https://multi-user-whiteboard-five.vercel.app](https://multi-user-whiteboard-five.vercel.app)

## Features

- ✏️ **Real-time Drawing**: Draw and sketch on a shared canvas with multiple users simultaneously
- 👥 **Multi-User Collaboration**: Support for multiple concurrent users on the same whiteboard
- 🎨 **Customizable Tools**: Multiple drawing tools and color options
- 💾 **Persistent Canvas**: Your drawings are maintained during the session
- 📱 **Responsive Design**: Works across different screen sizes and devices
- ⚡ **Low Latency**: Optimized for real-time synchronization

## Tech Stack

- **Frontend**: JavaScript, HTML5 Canvas
- **Deployment**: Vercel
- **Real-time Communication**: WebSocket (for live collaboration)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/rohitbhatt33/multi_user_whiteboard.git
cd multi_user_whiteboard
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Create or Join a Session**: Start a new whiteboard session or join an existing one
2. **Draw**: Use the available drawing tools to sketch on the canvas
3. **Collaborate**: Invite others to join your whiteboard session
4. **Share Ideas**: Work together in real-time to visualize and refine concepts

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml
├── Backend/
│   ├── Dockerfile
│   ├── server.js
│   ├── package.json
│   └── .dockerignore
├── Frontend/
│   ├── Dockerfile              # (recommended if containerizing frontend)
│   ├── public/
│   ├── src/
│   │   └── app/
│   │       ├── App.jsx
│   │       └── App.css
│   └── package.json
├── docker-compose.yml          # 🔥 Added
├── .dockerignore                      # optional
└── .gitignore
└── README.md

```

## Contributing

Contributions are welcome! If you'd like to contribute to this project:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Support

If you encounter any issues or have questions, please:
- Check the [Issues](https://github.com/rohitbhatt33/multi_user_whiteboard/issues) page
- Create a new issue with a detailed description
- Reach out to the project maintainer

## Roadmap

- [ ] Undo/Redo functionality
- [ ] Shape tools (rectangle, circle, line)
- [ ] Text insertion
- [ ] Session recording and playback
- [ ] User presence indicators
- [ ] Chat integration
- [ ] Export canvas as image

## Author

Created by [@rohitbhatt33](https://github.com/rohitbhatt33)

---

**Happy Collaborating! 🎨**
