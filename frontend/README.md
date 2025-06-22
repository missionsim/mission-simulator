# Drone Mission Planner

A modern web-based ground control station for drone operations, inspired by Mission Planner for ArduPilot, with AI-powered mission planning capabilities.

## Features

- **Interactive Map Interface**: Click to add waypoints and plan missions
- **Real-time Telemetry**: Monitor drone status, battery, altitude, speed, and GPS data
- **AI Mission Planning**: Generate optimized flight plans based on objectives and constraints
- **Dark Theme UI**: Modern, professional interface optimized for extended use
- **Multi-Drone Support**: Connect and manage multiple drones simultaneously
- **Mission Management**: Create, save, and load mission plans

## Getting Started

### Prerequisites

- Node.js 14+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd mission_simulator/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Creating a Mission

1. Click the waypoint button in the map controls
2. Click on the map to add waypoints
3. Waypoints will be connected automatically to form a flight path

### AI Mission Planning

1. Click the AI button (brain icon) in the top toolbar
2. Define your mission objective (e.g., "Survey the perimeter of a facility")
3. Set operational constraints:
   - Maximum altitude
   - Maximum distance from home
   - Maximum flight time
   - Weather constraints
4. Review the AI-generated plan
5. Accept or modify the plan before execution

### Connecting to a Drone

The application is designed to connect to drones via MAVLink protocol. Currently, it operates in simulation mode with mock data.

## Architecture

### Technology Stack

- **React** with TypeScript for type safety
- **Redux Toolkit** for state management
- **Material-UI** for UI components
- **Leaflet** for interactive maps
- **Recharts** for telemetry visualization
- **Socket.io** (ready for real-time drone communication)

### Project Structure

```
src/
├── components/         # React components
│   ├── Map/           # Map view and waypoint management
│   ├── Telemetry/     # Real-time data visualization
│   ├── AIPlanning/    # AI mission planning interface
│   ├── Topbar/        # Main navigation and controls
│   └── Sidebar/       # Mission and drone management
├── store/             # Redux store configuration
│   └── slices/        # Redux slices for different features
├── types/             # TypeScript type definitions
├── services/          # API and drone communication services
└── utils/             # Helper functions
```

## Development

### Available Scripts

- `npm start` - Run the development server
- `npm test` - Run tests
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

### Adding New Features

1. Create new components in `src/components/`
2. Add Redux slices for state management in `src/store/slices/`
3. Define types in `src/types/`
4. Follow the existing patterns for consistency

## Future Enhancements

- [ ] Real MAVLink integration for drone communication
- [ ] 3D mission visualization
- [ ] Weather data integration
- [ ] No-fly zone management
- [ ] Multi-user collaboration
- [ ] Mission simulation and replay
- [ ] Advanced AI planning with terrain analysis
- [ ] Mobile responsive design

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by Mission Planner for ArduPilot
- Built with modern web technologies for cross-platform compatibility
