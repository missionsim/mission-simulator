import axios from 'axios';
import { 
  MissionPlanRequest, 
  MissionPlanResponse, 
  StreamingChunk,
  ChatRequest 
} from '../types/missionPlanning';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:9000';

class MissionPlanningApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/v1/mission-planning`;
  }

  /**
   * Generate a mission plan (non-streaming)
   */
  async generatePlan(request: MissionPlanRequest): Promise<MissionPlanResponse> {
    const response = await axios.post(`${this.baseUrl}/generate-plan`, request);
    return response.data;
  }

  /**
   * Generate a mission plan with streaming response
   */
  async generatePlanStream(
    request: MissionPlanRequest,
    onChunk: (chunk: StreamingChunk) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    // Use fetch with ReadableStream for POST SSE
    try {
      const response = await fetch(`${this.baseUrl}/generate-plan/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(request),
        mode: 'cors',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim()) {
              try {
                const event = JSON.parse(data);
                if (event.event === 'done') {
                  return;
                }
                onChunk(event.data);
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      if (onError) {
        onError(error as Error);
      } else {
        throw error;
      }
    }
  }

  /**
   * Chat with the mission planner
   */
  async chat(request: ChatRequest): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/chat`, request);
    return response.data;
  }

  /**
   * Get mission templates
   */
  async getTemplates(): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/templates`);
    return response.data.templates;
  }

  /**
   * Export mission in drone-compatible format
   */
  async exportMission(missionId: string): Promise<void> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/export/mission/${missionId}`,
        {},
        {
          responseType: 'blob',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mission_${missionId}.plan`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Mission not found. Make sure to generate and save a mission first.');
      }
      throw new Error(`Export failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Export mission as .waypoints file (Mission Planner format)
   */
  async exportMissionWaypoints(missionId: string): Promise<void> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/export/waypoints/${missionId}`,
        {},
        {
          responseType: 'blob',
          headers: {
            'Accept': 'text/plain',
          },
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mission_${missionId}.waypoints`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Mission not found. Make sure to generate and save a mission first.');
      }
      throw new Error(`Waypoints export failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Export route as GeoTIFF
   */
  async exportRouteGeotiff(
    missionId: string, 
    zoomLevel: number = 16, 
    bufferMeters: number = 500,
    mapType: string = 'satellite'
  ): Promise<void> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/export/geotiff/${missionId}`,
        {},
        {
          params: {
            zoom_level: zoomLevel,
            buffer_meters: bufferMeters,
            map_type: mapType,
          },
          responseType: 'blob',
          headers: {
            'Accept': 'image/tiff',
          },
          timeout: 60000, // 60 second timeout for large geotiff generation
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `route_${missionId}_${mapType}.geotiff`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Mission not found. Make sure to generate and save a mission first.');
      } else if (error.response?.status === 400) {
        throw new Error(error.response?.data?.detail || 'Invalid export parameters');
      }
      throw new Error(`GeoTIFF export failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Export route as PNG image
   */
  async exportRoutePng(
    missionId: string, 
    zoomLevel: number = 16, 
    bufferMeters: number = 500,
    mapType: string = 'satellite'
  ): Promise<void> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/export/png/${missionId}`,
        {},
        {
          params: {
            zoom_level: zoomLevel,
            buffer_meters: bufferMeters,
            map_type: mapType,
          },
          responseType: 'blob',
          headers: {
            'Accept': 'image/png',
          },
          timeout: 60000, // 60 second timeout for large image generation
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `route_${missionId}_${mapType}.png`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Mission not found. Make sure to generate and save a mission first.');
      } else if (error.response?.status === 400) {
        throw new Error(error.response?.data?.detail || 'Invalid export parameters');
      }
      throw new Error(`PNG export failed: ${error.response?.data?.detail || error.message}`);
    }
  }

  /**
   * Export TAK mission package (zip)
   */
  async exportTakMission(missionId: string): Promise<void> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/export/tak/${missionId}`,
        {},
        {
          responseType: 'blob',
          headers: {
            'Accept': 'application/zip',
          },
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tak_mission_${missionId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Mission not found. Make sure to generate and save a mission first.');
      }
      throw new Error(`TAK mission export failed: ${error.response?.data?.detail || error.message}`);
    }
  }
}

export default new MissionPlanningApi(); 