import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL;

class SocketService {
  socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      auth: { token },
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket Connected:', this.socket?.id);
    });

    this.socket.on('connect_error', (error) => {
      console.log('❌ WebSocket Error:', error.message);
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
      this.socket.on('new_transaction', callback);
    }
  }

  onTransactionUpdated(callback: (transaction: any) => void) {
    if (this.socket) {
      this.socket.off('transaction_updated');
      this.socket.on('transaction_updated', callback);
    }
  }

  onTransactionDeleted(callback: (id: string) => void) {
    if (this.socket) {
      this.socket.off('transaction_deleted');
      this.socket.on('transaction_deleted', callback);
    }
  }

  off(event: string) {
    if (this.socket) {
      this.socket.off(event);
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
