# Venus AI - Professional ChatGPT-like Web Application

A modern, real-time AI chat application built with the MERN stack and Python microservices, featuring DeepSeek R1 API integration.

## 🚀 Features

- **Real-time Chat Interface** - Professional ChatGPT-like UI with real-time messaging
- **User Authentication** - Secure login/signup with JWT tokens
- **Chat History** - Persistent chat storage and retrieval
- **DeepSeek R1 Integration** - Advanced AI responses using DeepSeek R1 API
- **Responsive Design** - Beautiful UI built with Tailwind CSS
- **Microservices Architecture** - Scalable backend with Python microservices

## 🛠️ Tech Stack

### Frontend
- **React 18** with Vite for fast development
- **Tailwind CSS** for modern, responsive UI
- **Socket.io Client** for real-time communication
- **React Router** for navigation
- **Axios** for API calls

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.io** for WebSocket connections
- **JWT** for authentication
- **bcrypt** for password hashing

### Python Microservices
- **FastAPI** for high-performance API
- **DeepSeek R1 API** integration
- **Redis** for caching and session management
- **Celery** for background tasks

## 📁 Project Structure

```
venus-ai/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/                  # Node.js + Express backend
│   ├── src/
│   ├── models/
│   ├── routes/
│   └── package.json
├── python-services/          # Python microservices
│   ├── ai-service/
│   ├── chat-processor/
│   └── requirements.txt
├── docker-compose.yml        # Container orchestration
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB
- Redis (optional, for caching)

### Installation

1. Clone the repository
2. Install frontend dependencies: `cd frontend && npm install`
3. Install backend dependencies: `cd backend && npm install`
4. Install Python dependencies: `cd python-services && pip install -r requirements.txt`
5. Set up environment variables
6. Start the development servers

## 🔧 Environment Variables

Create `.env` files in each service directory with the required configuration.

## 📝 License

MIT License
