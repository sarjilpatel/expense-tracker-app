import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL;


class SocketService {
  socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket Connected:', this.socket?.id);
    });

    this.socket.on('connect_error', (error) => {
      console.log('❌ WebSocket Error:', error);
    });
  }

  joinGroup(groupId: string) {
    if (this.socket && groupId) {
      this.socket.emit('join_group', groupId);
    }
  }

  onNewTransaction(callback: (transaction: any) => void) {
    if (this.socket) {
      this.socket.off('new_transaction');
      this.socket.on('new_transaction', (transaction) => {
        callback(transaction);
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();
