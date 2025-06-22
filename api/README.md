# Mission Planning API

A FastAPI-based service that uses AI/LLM to generate intelligent drone mission plans.

## Features

- **AI-Powered Mission Planning**: Generate complete mission plans from natural language objectives
- **Streaming Support**: Real-time streaming of plan generation with SSE (Server-Sent Events)
- **Multiple LLM Providers**: Support for OpenRouter, SambaNova, and Anakin APIs
- **Structured Output**: JSON Schema validation for consistent plan formatting
- **Interactive Chat**: Conversational interface for refining mission plans
- **Mission Templates**: Pre-defined templates for common mission types

## Installation

1. **Clone the repository and navigate to API directory:**
```bash
cd api
```

2. **Create virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

## Running the API

### Development
```bash
python main.py
```

### Production
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Endpoints

### Mission Planning

#### Generate Mission Plan
`POST /api/v1/mission-planning/generate-plan`

Generate a complete mission plan based on objectives and constraints.

**Request Body:**
```json
{
  "objective": {
    "description": "Survey the construction site for progress monitoring",
    "priority": "medium",
    "constraints": ["Stay within property boundaries", "Maintain 50m altitude"]
  },
  "start_position": {
    "lat": 37.7749,
    "lng": -122.4194,
    "alt": 0
  },
  "drone_capabilities": {
    "max_altitude": 120,
    "max_speed": 15,
    "flight_time": 30,
    "has_camera": true,
    "has_gimbal": true
  }
}
```

#### Stream Mission Plan Generation
`POST /api/v1/mission-planning/generate-plan/stream`

Stream the plan generation process in real-time using Server-Sent Events.

#### Chat Interface
`POST /api/v1/mission-planning/chat`

Interactive chat for refining mission plans.

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "Create a search pattern for a missing hiker"}
  ],
  "stream": true
}
```

#### Mission Templates
`GET /api/v1/mission-planning/templates`

Get pre-defined mission templates for common scenarios.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM access | Yes |
| `OPENROUTER_API_MODEL` | Model to use (default: google/gemini-2.5-pro-preview-03-25) | No |
| `SAMBANOVA_API_KEY` | SambaNova API key (alternative provider) | No |
| `ANAKIN_API_KEY` | Anakin API key (alternative provider) | No |
| `DEBUG` | Debug mode (True/False) | No |

## Example Usage

### Python Client
```python
import httpx
import json

# Generate a mission plan
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
            }
        }
    )
    plan = response.json()
    print(f"Generated plan: {plan['plan']['name']}")
```

### JavaScript/TypeScript Client
```javascript
// Stream mission plan generation
const eventSource = new EventSource(
  'http://localhost:8000/api/v1/mission-planning/generate-plan/stream', 
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      objective: {
        description: "Patrol the perimeter of the facility",
        priority: "high"
      }
    })
  }
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

## Mission Plan Structure

Generated mission plans include:

- **Waypoints**: Ordered list with positions, types, and actions
- **Estimated Duration**: Total flight time in minutes
- **Total Distance**: Mission distance in meters
- **Metadata**: Additional information and warnings

### Waypoint Types
- `takeoff`: Initial launch point
- `waypoint`: Standard navigation point
- `loiter`: Hover at location
- `survey`: Data collection point
- `orbit`: Circular pattern
- `land`: Landing point

## Development

### Running Tests
```bash
pytest tests/
```

### Code Style
```bash
black api/
isort api/
```

## License

MIT License 