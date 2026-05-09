import type { User, ChatMessage, RoomState } from './types.js';

const MAX_SEATS = 24;
const MAX_MESSAGES = 100;

class RoomStateManager {
  private users: Map<string, User> = new Map();
  private messages: ChatMessage[] = [];
  private occupiedSeats: Set<number> = new Set();
  private usedAvatars: Set<number> = new Set();

  isFull(): boolean {
    return this.users.size >= MAX_SEATS;
  }

  getUserCount(): number {
    return this.users.size;
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  private findFreeSeat(): number {
    for (let i = 0; i < MAX_SEATS; i++) {
      if (!this.occupiedSeats.has(i)) {
        return i;
      }
    }
    return -1;
  }

  private findFreeAvatar(preferredId?: number): number {
    if (preferredId !== undefined && preferredId >= 0 && preferredId < MAX_SEATS) {
      if (!this.usedAvatars.has(preferredId)) {
        return preferredId;
      }
    }

    const availableAvatars: number[] = [];
    for (let i = 0; i < MAX_SEATS; i++) {
      if (!this.usedAvatars.has(i)) {
        availableAvatars.push(i);
      }
    }
    if (availableAvatars.length === 0) return 0;
    const randomIndex = Math.floor(Math.random() * availableAvatars.length);
    return availableAvatars[randomIndex];
  }

  addUser(userId: string, knightName: string, preferredAvatarId?: number): { user: User } | null {
    if (this.isFull()) {
      return null;
    }

    const seatIndex = this.findFreeSeat();
    if (seatIndex === -1) {
      return null;
    }

    const avatarId = this.findFreeAvatar(preferredAvatarId);

    const user: User = {
      id: userId,
      knightName: knightName.trim().slice(0, 32),
      seatIndex,
      avatarId,
      micEnabled: false,
      isSpeaking: false,
      joinedAt: Date.now(),
    };

    this.users.set(userId, user);
    this.occupiedSeats.add(seatIndex);
    this.usedAvatars.add(avatarId);

    return { user };
  }

  removeUser(userId: string): { user: User } | null {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    this.users.delete(userId);
    this.occupiedSeats.delete(user.seatIndex);
    this.usedAvatars.delete(user.avatarId);

    return { user };
  }

  updateMicStatus(userId: string, enabled: boolean): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    user.micEnabled = enabled;
    if (!enabled) {
      user.isSpeaking = false;
    }

    return true;
  }

  updateSpeakingStatus(userId: string, isSpeaking: boolean): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    user.isSpeaking = isSpeaking;
    return true;
  }

  addChatMessage(senderId: string, text: string, replyToUserId?: string): ChatMessage | null {
    const sender = this.users.get(senderId);
    if (!sender) return null;

    const trimmedText = text.trim().slice(0, 500);
    if (!trimmedText) return null;

    let replyToKnightName: string | undefined;
    if (replyToUserId) {
      if (replyToUserId === senderId) return null;
      const target = this.users.get(replyToUserId);
      if (!target) return null;
      replyToKnightName = target.knightName;
    }

    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'user',
      userId: sender.id,
      knightName: sender.knightName,
      avatarId: sender.avatarId,
      text: trimmedText,
      timestamp: Date.now(),
      replyToUserId,
      replyToKnightName,
    };

    this.messages.push(message);
    this.trimMessages();

    return message;
  }

  private trimMessages(): void {
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }
  }

  getState(): RoomState {
    return {
      users: this.getAllUsers(),
      messages: this.messages.filter((m) => m.type === 'user'),
    };
  }

  getRecentMessages(count: number = 50): ChatMessage[] {
    return this.messages.filter((m) => m.type === 'user').slice(-count);
  }
}

export const roomState = new RoomStateManager();
