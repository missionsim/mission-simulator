# Mission Simulator 🚁

A modern, full-stack drone mission planning and control system with AI-powered mission generation capabilities. The system consists of a React-based frontend ground control station and a FastAPI backend service for intelligent mission planning.

## 🌟 Features

### Frontend (Ground Control Station)
- **Interactive Map Interface**: Click-to-add waypoints and visual mission planning
- **Real-time Telemetry**: Monitor drone status, battery, altitude, speed, and GPS data
- **AI Mission Planning**: Generate optimized flight plans from natural language objectives
- **Dark Theme UI**: Professional interface optimized for extended use
- **Multi-Drone Support**: Connect and manage multiple drones simultaneously
- **Mission Management**: Create, save, and load mission plans

### Backend (AI Mission Planning API)
- **AI-Powered Mission Planning**: Generate complete mission plans using LLMs
- **Streaming Support**: Real-time plan generation with Server-Sent Events
- **Multiple LLM Providers**: Support for OpenRouter, SambaNova, and Anakin APIs
- **Structured Output**: JSON Schema validation for consistent formatting
- **Interactive Chat**: Conversational interface for refining mission plans
- **Mission Templates**: Pre-defined templates for common mission types

## 🏗️ Architecture

```
Mission Simulator
├── frontend/           # React + TypeScript Ground Control Station
│   ├── React + Redux   # State management
│   ├── Material-UI     # UI components
│   ├── Leaflet Maps    # Interactive mapping
│   └── Recharts        # Telemetry visualization
└── api/               # FastAPI Mission Planning Service
    ├── FastAPI         # API framework
    ├── Pydantic        # Data validation
    ├── OpenAI/LLM      # AI mission generation
    └── SSE Streaming   # Real-time updates
```

## 🚀 Getting Started

### Prerequisites

- **Node.js 16+** and npm
- **Python 3.8+** and pip
- Modern web browser (Chrome, Firefox, Safari, Edge)
- API keys for at least one LLM provider (OpenRouter, SambaNova, or Anakin)

### Installation

#### 1. Clone the Repository
```bash
git clone [repository-url]
cd mission_simulator
```

#### 2. Backend Setup (API)

Navigate to the API directory:
```bash
cd api
```

Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Create environment configuration:
```bash
cp .env.example .env
```

Edit `.env` file with your API keys:
```env
# Required: At least one LLM provider API key
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_API_MODEL=google/gemini-2.5-pro-preview-03-25

# Alternative providers (optional)
SAMBANOVA_API_KEY=your_sambanova_api_key_here
ANAKIN_API_KEY=your_anakin_api_key_here

# Optional settings
DEBUG=False
```

#### 3. Frontend Setup

Open a new terminal and navigate to the frontend directory:
```bash
cd frontend
```

Install Node.js dependencies:
```bash
npm install
```

Create frontend environment file (optional):
```bash
# Create .env file in frontend/ directory if needed
echo "REACT_APP_API_URL=http://localhost:8000" > .env
```

### Running the Application

#### Start the Backend API
In the `api/` directory with virtual environment activated:
```bash
# Development
python main.py

# Or production mode
uvicorn main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

#### Start the Frontend
In a new terminal, from the `frontend/` directory:
```bash
npm start
```

The web application will open at `http://localhost:3000`

## 🔧 Environment Configuration

### API Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM access | Yes* | - |
| `OPENROUTER_API_MODEL` | Model to use | No | `google/gemini-2.5-pro-preview-03-25` |
| `SAMBANOVA_API_KEY` | SambaNova API key (alternative) | Yes* | - |
| `ANAKIN_API_KEY` | Anakin API key (alternative) | Yes* | - |
| `DEBUG` | Enable debug logging | No | `False` |

*At least one LLM provider API key is required

### Frontend Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:8000` |
| `REACT_APP_MAP_PROVIDER` | Map tile provider | `openstreetmap` |

## 📖 Usage

### Creating a Mission Plan

1. **Manual Planning**:
   - Click the waypoint button in the map controls
   - Click on the map to add waypoints
   - Waypoints connect automatically to form a flight path

2. **AI-Powered Planning**:
   - Click the AI button (brain icon) in the toolbar
   - Describe your mission objective: *"Survey the construction site for progress monitoring"*
   - Set operational constraints:
     - Maximum altitude
     - Maximum distance from home
     - Maximum flight time
     - Weather constraints
   - Review and modify the AI-generated plan

### API Usage Examples

#### Generate Mission Plan (Python)
```python
import httpx
import asyncio

async def generate_mission():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/v1/mission-planning/generate-plan",
            json={
                "objective": {
                    "description": "Inspect solar panels for damage",
                    "priority": "high"
                },
                "start_position": {
                    "lat": 37.7749,
                    "lng": -122.4194
                },
                "drone_capabilities": {
                    "max_altitude": 120,
                    "flight_time": 30,
                    "has_camera": True
                }
            }
        )
        return response.json()

# Run the example
plan = asyncio.run(generate_mission())
print(f"Generated plan: {plan['plan']['name']}")
```

#### Stream Mission Generation (JavaScript)
```javascript
const eventSource = new EventSource(
  'http://localhost:8000/api/v1/mission-planning/generate-plan/stream'
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === 'waypoint') {
    console.log('New waypoint:', data.data);
  } else if (data.event === 'plan') {
    console.log('Complete plan:', data.data);
  }
};
```

## 🛠️ Development

### Available Scripts

#### Frontend
```bash
npm start          # Development server
npm test           # Run tests
npm run build      # Production build
npm run lint       # ESLint
```

#### Backend
```bash
python main.py     # Development server
pytest tests/      # Run tests
black api/         # Code formatting
isort api/         # Import sorting
```

### Project Structure

```
mission_simulator/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── Map/       # Map and waypoint management
│   │   │   ├── Telemetry/ # Data visualization
│   │   │   ├── AIPlanning/# AI mission interface
│   │   │   └── Topbar/    # Navigation and controls
│   │   ├── store/         # Redux state management
│   │   ├── types/         # TypeScript definitions
│   │   └── services/      # API communication
│   └── public/            # Static assets
└── api/                   # FastAPI backend service
    ├── main.py           # API entry point
    ├── routes/           # API endpoints
    ├── services/         # Business logic
    ├── models/           # Data models
    └── tests/            # API tests
```

## 🌐 API Documentation

Once the backend is running, access interactive documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Key Endpoints

- `POST /api/v1/mission-planning/generate-plan` - Generate mission plan
- `POST /api/v1/mission-planning/generate-plan/stream` - Stream plan generation
- `POST /api/v1/mission-planning/chat` - Interactive chat interface
- `GET /api/v1/mission-planning/templates` - Mission templates

## 🔮 Future Enhancements

- [ ] Real MAVLink integration for drone communication
- [ ] 3D mission visualization with terrain analysis
- [ ] Weather data integration and constraints
- [ ] No-fly zone management and compliance
- [ ] Multi-user collaboration and mission sharing
- [ ] Mission simulation and replay capabilities
- [ ] Mobile responsive design
- [ ] Advanced AI planning with computer vision

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by Mission Planner for ArduPilot
- Built with modern web technologies for cross-platform compatibility
- AI capabilities powered by multiple LLM providers
