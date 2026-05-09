import { KNIGHT_AVATAR_ID_MAX } from './constants.js';
import type { User, ChatMessage, RoomState } from './types.js';

// Maximum concurrent users in one session (in-memory only — the database has
// no registration limit). Override with MAX_ROOM_SIZE env var; 0 = unlimited.
const MAX_ROOM_SIZE = (() => {
  const v = parseInt(process.env.MAX_ROOM_SIZE ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : 0; // 0 = unlimited
})();

// How many avatar portraits exist (0-based). Seats grow dynamically.
const AVATAR_POOL = KNIGHT_AVATAR_ID_MAX + 1; // 24 portraits (0-23)

const MAX_MESSAGES = 100;

class RoomStateManager {
  private users: Map<string, User> = new Map();
  private messages: ChatMessage[] = [];
  private occupiedSeats: Set<number> = new Set();
  private usedAvatars: Set<number> = new Set();

  /** Returns true only when MAX_ROOM_SIZE > 0 and the limit is reached. */
  isFull(): boolean {
    return MAX_ROOM_SIZE > 0 && this.users.size >= MAX_ROOM_SIZE;
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

  /** Finds the lowest free seat index (unbounded, grows with user count). */
  private findFreeSeat(): number {
    let i = 0;
    while (this.occupiedSeats.has(i)) i++;
    return i;
  }

  private findFreeAvatar(preferredId?: number): number {
    if (
      preferredId !== undefined &&
      preferredId >= 0 &&
      preferredId < AVATAR_POOL &&
      !this.usedAvatars.has(preferredId)
    ) {
      return preferredId;
    }
    // Pick any unused portrait; wrap around if all are taken.
    for (let i = 0; i < AVATAR_POOL; i++) {
      if (!this.usedAvatars.has(i)) return i;
    }
    // All portraits in use - assign a random one (visual collision, still works).
    return Math.floor(Math.random() * AVATAR_POOL);
  }

  addUser(userId: string, knightName: string, preferredAvatarId?: number): { user: User } | null {
    if (this.isFull()) {
      return null;
    }

    const seatIndex = this.findFreeSeat();
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
