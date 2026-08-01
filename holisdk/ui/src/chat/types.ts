// The shared conversational-AI building block's data model + host contract.
//
// ONE chat, many consumers: instead of every service re-building a chat (a full one here, a
// poorer copy there — the "similar siblings" the axioms forbid), the whole chat experience —
// many conversations, engine/model choice, model-tagged answers, reload-surviving history —
// lives once in @holisdk/ui and is driven by an injected `ChatAdapter`. Each service supplies
// its OWN adapter, so the chat renders identically while the data (and any grounding, e.g. a
// document pool) stays server-side in that service. There is never a second data path to the
// same conversations: the adapter is the single source of truth.

/** One selectable model within an engine (e.g. a specific Claude model). */
export interface ChatModel {
  /** Stable id sent to the backend. */
  id: string;
  /** Human label shown in the picker AND stamped on each answer this model produces. */
  label: string;
}

/** A "machine": a backend/provider that offers a set of models. Mirrors aigentic's engine +
 *  model choice so the shared picker covers both machine and model in one control. */
export interface ChatEngine {
  id: string;
  label: string;
  models: ChatModel[];
}

/** The engine+model a turn was (or will be) run with. */
export interface EngineChoice {
  engineId: string;
  modelId: string;
}

/** One message in a conversation. Assistant messages carry the model that produced them so the
 *  UI can label every AI answer (Kennzeichnungspflicht für KI-Modellantworten). */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** Markdown source; rendered wrapped (never a single horizontally-scrolling line). */
  content: string;
  /** For an assistant message: the label of the model that generated it. Denormalised so an
   *  answer keeps its correct tag even if the model list later changes. */
  model?: string;
  /** Epoch ms; optional (adapters that don't track time simply omit it). */
  createdAt?: number;
}

/** A conversation header (list entry). Full messages are loaded on demand via the adapter. */
export interface Conversation {
  id: string;
  title: string;
  updatedAt?: number;
  /** The engine/model last used in this conversation, restored when it is reopened. */
  engineId?: string;
  modelId?: string;
}

/** Fields to seed a new conversation with. */
export interface NewConversation {
  title?: string;
  engineId?: string;
  modelId?: string;
}

/** A single user turn to run. This is where a service injects its own behaviour: presentr's
 *  adapter grounds the answer in the room's document pool, aigentic's answers plainly — same
 *  shape, same conversation, one data path. */
export interface SendInput {
  conversationId: string;
  text: string;
  engineId: string;
  modelId: string;
  /** Aborts an in-flight turn (e.g. the user navigates away). */
  signal?: AbortSignal;
  /** Streaming hook: an adapter MAY call this with incremental assistant text as it arrives; the
   *  chat renders it live in the pending bubble. A non-streaming adapter just ignores it and
   *  resolves with the final message. */
  onToken?: (chunk: string) => void;
}

/** THE HOST CONTRACT. A service passes one of these to <Chat>; the chat owns no storage of its
 *  own, so history belongs to the user and survives a restart wherever the adapter persists it
 *  (i.e. the service backend). Every method may be async. */
export interface ChatAdapter {
  /** The engines (machines) + models the user may pick from. */
  engines(): ChatEngine[] | Promise<ChatEngine[]>;
  /** The user's conversations, most-recently-updated first. */
  listConversations(): Promise<Conversation[]>;
  /** Full message history for one conversation, oldest first. */
  loadMessages(conversationId: string): Promise<ChatMessage[]>;
  /** Create a new, empty conversation and return its header. */
  createConversation(init?: NewConversation): Promise<Conversation>;
  /** Delete a conversation and its messages. */
  deleteConversation(conversationId: string): Promise<void>;
  /** Run a user turn and resolve with the assistant's answer. */
  send(input: SendInput): Promise<ChatMessage>;
}
