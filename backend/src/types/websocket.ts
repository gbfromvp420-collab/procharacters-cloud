import type { AvatarState } from "./session.js";
import type { GiftSendEvent, CommandRequest, Tip } from "./livecam.js";

/** Client → server WebSocket events. */
export type ClientEventType =
  | "user_message"
  | "ping"
  | "end_session"
  | "send_tip"
  | "send_gift"
  | "send_command"
  | "join_room"
  | "leave_room"
  | "request_media";

export interface ClientEventBase {
  type: ClientEventType;
}

export interface UserMessageEvent extends ClientEventBase {
  type: "user_message";
  content: string;
}

export interface PingEvent extends ClientEventBase {
  type: "ping";
}

export interface EndSessionEvent extends ClientEventBase {
  type: "end_session";
}

export interface SendTipEvent extends ClientEventBase {
  type: "send_tip";
  roomId: string;
  userId: string;
  displayName: string;
  amount: number;
  message?: string;
}

export interface SendGiftEvent extends ClientEventBase {
  type: "send_gift";
  roomId: string;
  userId: string;
  displayName: string;
  giftId: string;
}

export interface SendCommandEvent extends ClientEventBase {
  type: "send_command";
  roomId: string;
  userId: string;
  displayName: string;
  commandId: string;
  customPrompt?: string;
}

export interface JoinRoomEvent extends ClientEventBase {
  type: "join_room";
  roomId: string;
  userId: string;
}

export interface LeaveRoomEvent extends ClientEventBase {
  type: "leave_room";
  roomId: string;
  userId: string;
}

export interface RequestMediaEvent extends ClientEventBase {
  type: "request_media";
  mediaType: "image" | "video";
  prompt?: string;
}

export type ClientEvent =
  | UserMessageEvent
  | PingEvent
  | EndSessionEvent
  | SendTipEvent
  | SendGiftEvent
  | SendCommandEvent
  | JoinRoomEvent
  | LeaveRoomEvent
  | RequestMediaEvent;

/** Server → client WebSocket events. */
export type ServerEventType =
  | "session_ready"
  | "assistant_stream"
  | "assistant_complete"
  | "avatar_update"
  | "pong"
  | "session_ended"
  | "error"
  | "tip_received"
  | "gift_received"
  | "command_executed"
  | "viewer_count"
  | "media_generated"
  | "show_starting"
  | "show_ending"
  | "paired_avatar_update";

export interface ServerEventBase {
  type: ServerEventType;
}

export interface SessionReadyEvent extends ServerEventBase {
  type: "session_ready";
  sessionId: string;
  characterId: string;
  characterName: string;
  avatarState: AvatarState;
}

export interface AssistantStreamEvent extends ServerEventBase {
  type: "assistant_stream";
  chunk: string;
  messageId: string;
}

export interface AssistantCompleteEvent extends ServerEventBase {
  type: "assistant_complete";
  messageId: string;
  content: string;
  avatarIntent: AvatarState;
}

export interface AvatarUpdateEvent extends ServerEventBase {
  type: "avatar_update";
  avatarState: AvatarState;
}

export interface PongEvent extends ServerEventBase {
  type: "pong";
}

export interface SessionEndedEvent extends ServerEventBase {
  type: "session_ended";
  reason: string;
}

export interface ErrorEvent extends ServerEventBase {
  type: "error";
  code: string;
  message: string;
}

export interface TipReceivedEvent extends ServerEventBase {
  type: "tip_received";
  tip: Tip;
}

export interface GiftReceivedEvent extends ServerEventBase {
  type: "gift_received";
  gift: GiftSendEvent;
}

export interface CommandExecutedEvent extends ServerEventBase {
  type: "command_executed";
  command: CommandRequest;
}

export interface ViewerCountEvent extends ServerEventBase {
  type: "viewer_count";
  count: number;
}

export interface MediaGeneratedEvent extends ServerEventBase {
  type: "media_generated";
  mediaType: "image" | "video";
  url: string;
  width: number;
  height: number;
  durationSeconds?: number;
}

export interface ShowStartingEvent extends ServerEventBase {
  type: "show_starting";
  showId: string;
  roomId: string;
  title: string;
}

export interface ShowEndingEvent extends ServerEventBase {
  type: "show_ending";
  showId: string;
  reason: string;
}

export interface PairedAvatarUpdateEvent extends ServerEventBase {
  type: "paired_avatar_update";
  avatarState: AvatarState;
}

export type ServerEvent =
  | SessionReadyEvent
  | AssistantStreamEvent
  | AssistantCompleteEvent
  | AvatarUpdateEvent
  | PongEvent
  | SessionEndedEvent
  | ErrorEvent
  | TipReceivedEvent
  | GiftReceivedEvent
  | CommandExecutedEvent
  | ViewerCountEvent
  | MediaGeneratedEvent
  | ShowStartingEvent
  | ShowEndingEvent
  | PairedAvatarUpdateEvent;