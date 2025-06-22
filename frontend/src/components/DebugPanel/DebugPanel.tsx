import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Button,
} from '@mui/material';
import {
  BugReport,
  ExpandLess,
  ExpandMore,
  Clear,
  Download,
} from '@mui/icons-material';

interface DebugMessage {
  timestamp: string;
  level: string;
  message: string;
}

const DebugPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<DebugMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const websocketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = `ws://localhost:9000/ws/debug`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Debug WebSocket connected');
        setConnected(true);
        setMessages(prev => [...prev, {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: '🔌 Connected to debug stream'
        }]);
      };

      ws.onmessage = (event) => {
        try {
          const debugData: DebugMessage = JSON.parse(event.data);
          setMessages(prev => [...prev, debugData]);
        } catch (e) {
          console.error('Failed to parse debug message:', e);
        }
      };

      ws.onclose = () => {
        console.log('Debug WebSocket disconnected');
        setConnected(false);
        setMessages(prev => [...prev, {
          timestamp: new Date().toISOString(),
          level: 'warning',
          message: '⚠️ Debug stream disconnected'
        }]);
        
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('Debug WebSocket error:', error);
        setConnected(false);
      };

      websocketRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  const clearMessages = () => {
    setMessages([]);
  };

  const downloadLogs = () => {
    const logText = messages.map(msg => 
      `[${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.level.toUpperCase()}: ${msg.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-log-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      case 'debug': return 'default';
      default: return 'default';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      case 'debug': return '⚪';
      default: return '⚪';
    }
  };

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 16,
        width: expanded ? 500 : 200,
        maxHeight: expanded ? 400 : 'auto',
        zIndex: 1300,
        transition: 'all 0.3s ease-in-out',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          backgroundColor: 'primary.main',
          color: 'white',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReport fontSize="small" />
          <Typography variant="subtitle2">
            Console 
          </Typography>
          <Chip
            size="small"
            label={connected ? 'LIVE' : 'OFFLINE'}
            color={connected ? 'success' : 'error'}
            sx={{ 
              height: 20, 
              fontSize: '0.7rem',
              backgroundColor: connected ? 'success.main' : 'error.main',
              color: 'white'
            }}
          />
        </Box>
        <IconButton size="small" sx={{ color: 'white' }}>
          {expanded ? <ExpandMore /> : <ExpandLess />}
        </IconButton>
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box sx={{ height: 320, display: 'flex', flexDirection: 'column' }}>
          {/* Controls */}
          <Box sx={{ p: 1, backgroundColor: 'background.default' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                startIcon={<Clear />}
                onClick={clearMessages}
                variant="outlined"
              >
                Clear
              </Button>
              <Button
                size="small"
                startIcon={<Download />}
                onClick={downloadLogs}
                variant="outlined"
                disabled={messages.length === 0}
              >
                Export
              </Button>
            </Box>
          </Box>

          <Divider />

          {/* Messages */}
          <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#1e1e1e' }}>
            <List dense sx={{ p: 0 }}>
              {messages.map((msg, index) => (
                <ListItem key={index} sx={{ py: 0.5, px: 1 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: '#888', minWidth: '60px' }}>
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#fff', fontFamily: 'monospace' }}>
                          {getLevelIcon(msg.level)} {msg.message}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
            <div ref={messagesEndRef} />
          </Box>

          {/* Status */}
          <Box sx={{ p: 1, backgroundColor: 'background.paper' }}>
            <Typography variant="caption" color="text.secondary">
              {messages.length} messages • {connected ? 'Connected' : 'Disconnected'}
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default DebugPanel; 