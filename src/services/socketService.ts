import { io, Socket } from 'socket.io-client';

import { debugLog } from '@/src/utils/log';
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
      debugLog('[socket] connected', this.socket?.id);
    });

    this.socket.on('connect_error', (error) => {
      debugLog('[socket] error', error.message);
    });
  }

  joinGroup(groupId: string) {
    if (this.socket && groupId) {
      this.socket.emit('join_group', groupId);
    }
  }

  /**
   * The server's "something in this group changed" signal (W3-22). A signal, not a payload: the
   * listener pulls the changes feed, which is the one source of rows.
   */
  onGroupChanged(callback: (payload: { groupId: string; by: string }) => void) {
    if (this.socket) {
      this.socket.off('group_changed');
      this.socket.on('group_changed', callback);
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
