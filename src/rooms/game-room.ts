import { HttpError, readBody } from "../http";
import {
  clientMessage,
  IDLE_TTL_MS,
  createRoomInput,
  isAccepted,
  MAX_PLAYERS,
  questionDuration,
  REVEAL_MS,
  ROOM_TTL_MS,
  scoreFor,
  TICKET_TTL_MS,
  type CreateRoomInput,
} from "./protocol";

export interface RoomSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

/** The parts of DurableObjectState the room uses, so tests can stand in for it. */
export interface GameRoomState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
    deleteAll(): Promise<void>;
    setAlarm(at: number): Promise<void>;
  };
  acceptWebSocket(socket: RoomSocket, tags?: string[]): void;
  getWebSockets(tag?: string): RoomSocket[];
}

type Phase = "lobby" | "question" | "reveal" | "ended";
interface Player {
  uid: string;
  name: string;
  score: number;
}
interface Answer {
  choice: number;
  /** Ms after the question opened; points are settled when it closes. */
  elapsedMs?: number;
  correct?: boolean;
  gained: number;
}
interface Room {
  code: string;
  hostUid: string;
  title: string;
  seconds?: number;
  questions: CreateRoomInput["questions"];
  players: Player[];
  phase: Phase;
  index: number;
  /** When the current phase ends; the alarm is what moves the room on. */
  endsAt: number | null;
  answers: Record<number, Record<string, Answer>>;
  expiresAt: number;
}
interface Ticket {
  uid: string;
  name: string;
  expiresAt: number;
}

const OPEN = 1;

/**
 * One live room. The server owns the clock: questions advance on alarms and
 * never wait for anyone, so a player who drops out simply scores nothing for
 * what they missed and lands on the current question when they come back.
 * Answers stay here; players only ever receive the question's display.
 */
export class GameRoom {
  private room: Room | null | undefined;
  constructor(
    private ctx: GameRoomState,
    _env?: unknown,
    private now: () => number = Date.now,
  ) {}

  private async load() {
    if (this.room === undefined)
      this.room = (await this.ctx.storage.get<Room>("room")) ?? null;
    if (this.room && this.room.expiresAt <= this.now()) await this.destroy();
    return this.room;
  }
  private async save(room: Room) {
    this.room = room;
    await this.ctx.storage.put("room", room);
    await this.ctx.storage.setAlarm(
      Math.min(room.endsAt ?? Infinity, room.expiresAt),
    );
  }
  private async destroy() {
    for (const socket of this.ctx.getWebSockets())
      socket.close(4404, "room_closed");
    this.room = null;
    await this.ctx.storage.deleteAll();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/init" && request.method === "POST") {
        const body = JSON.parse(await readBody(request, 2_000_000)) as {
          code: string;
          hostUid: string;
          input: unknown;
        };
        await this.init(
          body.code,
          body.hostUid,
          createRoomInput.parse(body.input),
        );
        return Response.json({ code: body.code }, { status: 201 });
      }
      if (url.pathname === "/ticket" && request.method === "POST") {
        const body = JSON.parse(await readBody(request, 2000)) as {
          uid: string;
          name: string;
        };
        return Response.json({
          ticket: await this.issueTicket(body.uid, body.name),
        });
      }
      if (url.pathname === "/ws") {
        if (request.headers.get("upgrade")?.toLowerCase() !== "websocket")
          throw new HttpError(426, "upgrade_required");
        const uid = await this.admit(url.searchParams.get("ticket") ?? "");
        const pair = new (
          globalThis as unknown as {
            WebSocketPair: new () => [unknown, RoomSocket];
          }
        ).WebSocketPair();
        await this.attach(pair[1], uid);
        return new Response(null, {
          status: 101,
          webSocket: pair[0],
        } as ResponseInit);
      }
      if (url.pathname === "/status" && request.method === "GET") {
        const room = await this.load();
        return Response.json(
          room
            ? {
                code: room.code,
                title: room.title,
                hostUid: room.hostUid,
                phase: room.phase,
                expiresAt: room.expiresAt,
              }
            : null,
        );
      }
      // The same namespace keeps, per host, which room they opened last.
      if (url.pathname === "/pin") {
        if (request.method === "POST") {
          const { code } = JSON.parse(await readBody(request, 200)) as { code: string };
          await this.ctx.storage.put("pin", { code });
          return Response.json({ ok: true });
        }
        return Response.json((await this.ctx.storage.get("pin")) ?? null);
      }
      throw new HttpError(404, "not_found");
    } catch (reason) {
      if (reason instanceof HttpError)
        return Response.json(
          { error: { code: reason.code } },
          { status: reason.status },
        );
      throw reason;
    }
  }

  async init(code: string, hostUid: string, input: CreateRoomInput) {
    if (await this.load()) throw new HttpError(409, "room_exists");
    await this.save({
      code,
      hostUid,
      title: input.title,
      seconds: input.seconds,
      questions: input.questions,
      players: [{ uid: hostUid, name: input.name, score: 0 }],
      phase: "lobby",
      index: 0,
      endsAt: null,
      answers: {},
      expiresAt: this.now() + ROOM_TTL_MS,
    });
  }

  async issueTicket(uid: string, name: string) {
    const room = await this.load();
    if (!room) throw new HttpError(404, "room_not_found");
    const member = room.players.some((player) => player.uid === uid);
    if (!member && room.phase === "ended")
      throw new HttpError(409, "room_ended");
    if (!member && room.players.length >= MAX_PLAYERS)
      throw new HttpError(409, "room_full");
    const ticket = crypto.randomUUID();
    await this.ctx.storage.put(`ticket:${ticket}`, {
      uid,
      name: name.trim().slice(0, 40) || "Player",
      expiresAt: this.now() + TICKET_TTL_MS,
    } satisfies Ticket);
    return ticket;
  }

  /** Spends a ticket and seats its holder; returns who they are. */
  async admit(ticket: string) {
    const key = `ticket:${ticket}`;
    const stored = await this.ctx.storage.get<Ticket>(key);
    await this.ctx.storage.delete(key);
    const room = await this.load();
    if (!stored || stored.expiresAt <= this.now() || !room)
      throw new HttpError(403, "ticket_invalid");
    const existing = room.players.find((player) => player.uid === stored.uid);
    if (existing) existing.name = stored.name;
    else {
      if (room.players.length >= MAX_PLAYERS)
        throw new HttpError(409, "room_full");
      room.players.push({ uid: stored.uid, name: stored.name, score: 0 });
    }
    await this.save(room);
    return stored.uid;
  }

  /**
   * Seats a socket. One player is one seat: a device joining as someone
   * already connected takes over, and the older device is told it was replaced.
   */
  async attach(socket: RoomSocket, uid: string) {
    for (const previous of this.ctx.getWebSockets(uid)) {
      const owner = (previous.deserializeAttachment() as { uid?: string } | null)?.uid;
      if (previous !== socket && owner === uid && previous.readyState === OPEN)
        previous.close(4409, "replaced");
    }
    socket.serializeAttachment({ uid });
    this.ctx.acceptWebSocket(socket, [uid]);
    const room = await this.load();
    if (room && room.phase !== "ended") {
      room.expiresAt = Math.max(room.expiresAt, this.now() + ROOM_TTL_MS);
      await this.save(room);
    }
    this.broadcast();
  }

  async webSocketMessage(socket: RoomSocket, data: string | ArrayBuffer) {
    const { uid } = socket.deserializeAttachment() as { uid: string };
    let message;
    try {
      message = clientMessage.parse(
        JSON.parse(typeof data === "string" ? data : ""),
      );
    } catch {
      socket.send(JSON.stringify({ type: "error", code: "invalid_message" }));
      return;
    }
    const room = await this.load();
    if (!room) {
      socket.close(4404, "room_closed");
      return;
    }
    if (message.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", serverNow: this.now() }));
      return;
    }
    if (message.type === "start" && uid === room.hostUid && room.phase === "lobby")
      await this.beginQuestion(room, 0);
    else if (
      message.type === "end" &&
      uid === room.hostUid &&
      room.phase !== "ended"
    )
      await this.finish(room);
    else if (message.type === "answer")
      await this.answer(room, uid, message.index, message.choice);
  }

  async webSocketClose(socket: RoomSocket) {
    socket.close();
    const room = await this.load();
    if (room && this.connectedUids().length === 0) {
      room.expiresAt = Math.min(room.expiresAt, this.now() + IDLE_TTL_MS);
      await this.save(room);
    }
    this.broadcast();
  }
  async webSocketError(socket: RoomSocket) {
    await this.webSocketClose(socket);
  }

  async alarm() {
    const room = await this.load();
    if (!room) return;
    if (room.endsAt !== null && room.endsAt <= this.now()) {
      if (room.phase === "question") return this.reveal(room);
      if (room.phase === "reveal")
        return room.index + 1 < room.questions.length
          ? this.beginQuestion(room, room.index + 1)
          : this.finish(room);
    }
    await this.save(room);
  }

  private async beginQuestion(room: Room, index: number) {
    room.phase = "question";
    room.index = index;
    room.endsAt = this.now() + questionDuration(room.questions[index].display, room.seconds);
    room.answers[index] ??= {};
    room.expiresAt = this.now() + ROOM_TTL_MS;
    await this.save(room);
    this.broadcast();
  }

  private async answer(
    room: Room,
    uid: string,
    index: number,
    choice: number,
  ) {
    const question = room.questions[index];
    const answers = room.answers[index];
    if (
      room.phase !== "question" ||
      room.index !== index ||
      !answers ||
      answers[uid] ||
      !room.players.some((player) => player.uid === uid) ||
      choice >= question.display.options.length
    )
      return;
    answers[uid] = {
      choice,
      elapsedMs: this.now() - this.openedAt(room),
      correct: isAccepted(question, choice),
      gained: 0,
    };
    // Only people still here are waited for; anyone gone simply scores nothing.
    const present = new Set(this.connectedUids());
    const everyone = room.players.every(
      (player) => !present.has(player.uid) || answers[player.uid],
    );
    if (everyone) return this.reveal(room);
    await this.save(room);
    this.broadcast();
  }

  private async reveal(room: Room) {
    const answers = room.answers[room.index] ?? {};
    // Speed counts against how long the question was really open. A lone
    // answer has nobody to race, so it is measured against the full timer.
    const duration = questionDuration(room.questions[room.index].display, room.seconds);
    const timed = Object.values(answers).filter((answer) => answer.elapsedMs !== undefined);
    const window =
      timed.length > 1 ? Math.min(this.now() - this.openedAt(room), duration) : duration;
    for (const answer of timed)
      answer.gained = scoreFor(answer.correct ?? false, answer.elapsedMs ?? 0, window);
    for (const player of room.players)
      player.score += answers[player.uid]?.gained ?? 0;
    room.phase = "reveal";
    room.endsAt = this.now() + REVEAL_MS;
    await this.save(room);
    this.broadcast();
  }

  /** When the current question opened, derived from its deadline. */
  private openedAt(room: Room) {
    const duration = questionDuration(room.questions[room.index].display, room.seconds);
    return (room.endsAt ?? this.now()) - duration;
  }

  private async finish(room: Room) {
    room.phase = "ended";
    room.endsAt = null;
    room.expiresAt = this.now() + ROOM_TTL_MS;
    await this.save(room);
    this.broadcast();
  }

  private connectedUids() {
    return this.ctx
      .getWebSockets()
      .filter((socket) => socket.readyState === OPEN)
      .map((socket) => (socket.deserializeAttachment() as { uid: string }).uid);
  }

  private broadcast() {
    const room = this.room;
    if (!room) return;
    const connected = new Set(this.connectedUids());
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState !== OPEN) continue;
      const { uid } = socket.deserializeAttachment() as { uid: string };
      socket.send(JSON.stringify(this.view(room, uid, connected)));
    }
  }

  /**
   * Every question this player got wrong or missed, once the game is over. A
   * passage is sent once and referenced, so a long reading isn't repeated.
   */
  private review(room: Room, uid: string) {
    const passages: Record<string, { title: string; text: string }> = {};
    const items = room.questions.flatMap((question, index) => {
      if (index > room.index) return [];
      const answer = room.answers[index]?.[uid];
      if (answer && isAccepted(question, answer.choice)) return [];
      const { passage, ...display } = question.display;
      if (passage) passages[passage.id] = { title: passage.title, text: passage.text };
      return [
        {
          index,
          question: { ...display, passageId: passage?.id ?? null },
          choice: answer?.choice ?? null,
          accepted: [...new Set([question.answerIndex, ...(question.accepted ?? [])])],
          explanation: question.explanation ?? null,
        },
      ];
    });
    return { items, passages };
  }

  /** One player's view. The answer appears only once the question is over. */
  view(room: Room, uid: string, connected: ReadonlySet<string>) {
    const current = room.questions[room.index];
    const answers = room.answers[room.index] ?? {};
    const showing = room.phase === "question" || room.phase === "reveal";
    const revealing = room.phase === "reveal";
    const passageId = current?.display.passage?.id;
    // Blanks of the same passage already settled, so the shared bank can mark
    // which options are used up.
    const revealedBlanks: Record<number, string> = {};
    if (showing && passageId)
      room.questions
        .slice(0, room.index + (revealing ? 1 : 0))
        .forEach((item) => {
          if (item.display.passage?.id === passageId && item.display.blank)
            revealedBlanks[item.display.blank] =
              item.display.options[item.answerIndex];
        });
    return {
      type: "state",
      serverNow: this.now(),
      code: room.code,
      title: room.title,
      hostUid: room.hostUid,
      you: uid,
      phase: room.phase,
      index: room.index,
      total: room.questions.length,
      endsAt: room.endsAt,
      duration: showing ? questionDuration(current.display, room.seconds) : null,
      players: room.players
        .map((player) => ({
          uid: player.uid,
          name: player.name,
          score: player.score,
          connected: connected.has(player.uid),
          answered: showing && Boolean(answers[player.uid]),
        }))
        .sort((a, b) => b.score - a.score),
      question: showing ? current.display : null,
      yourChoice: showing ? (answers[uid]?.choice ?? null) : null,
      revealedBlanks,
      review: room.phase === "ended" ? this.review(room, uid) : null,
      reveal: revealing
        ? {
            answerIndex: current.answerIndex,
            accepted: [
              ...new Set([current.answerIndex, ...(current.accepted ?? [])]),
            ],
            explanation: current.explanation ?? null,
            gained: Object.fromEntries(
              Object.entries(answers).map(([player, answer]) => [
                player,
                answer.gained,
              ]),
            ),
            choices: Object.fromEntries(
              Object.entries(answers).map(([player, answer]) => [
                player,
                answer.choice,
              ]),
            ),
          }
        : null,
    };
  }
}
