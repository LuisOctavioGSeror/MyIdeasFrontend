export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function withAuthJson(options: RequestInit = {}): RequestInit {
  const token = localStorage.getItem("token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return { ...options, headers };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, withAuthJson(options));

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Erro desconhecido" }));
    const detail = error.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? JSON.stringify(detail)
        : `Erro ${res.status}`;
    throw new Error(message);
  }

  return res.json();
}

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  status?: string | null;
}

export const authApi = {
  login: (data: LoginRequest) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  register: (data: RegisterRequest) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => request<User>("/auth/me"),
};

// Ideas
export type IdeaStatus = "open" | "in_progress" | "closed";

type BackendIdeaStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

interface BackendIdea {
  id: string;
  title: string;
  description: string | null;
  status: BackendIdeaStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
  image_url: string | null;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  classification?: string;
  created_at: string;
  updated_at: string;
  image_url?: string | null;
}

export interface CreateIdeaRequest {
  title: string;
  description: string;
  image_url?: string;
}

export interface UpdateIdeaRequest {
  title?: string;
  description?: string;
  status?: IdeaStatus;
  image_url?: string;
}

function mapStatusFromBackend(status: BackendIdeaStatus): IdeaStatus {
  switch (status) {
    case "OPEN":
      return "open";
    case "IN_PROGRESS":
      return "in_progress";
    case "RESOLVED":
    case "CLOSED":
      return "closed";
    default:
      return "open";
  }
}

function mapStatusToBackend(status: IdeaStatus): BackendIdeaStatus {
  switch (status) {
    case "open":
      return "OPEN";
    case "in_progress":
      return "IN_PROGRESS";
    case "closed":
      return "CLOSED";
    default:
      return "OPEN";
  }
}

function fromBackendIdea(idea: BackendIdea): Idea {
  return {
    id: idea.id,
    title: idea.title,
    description: idea.description ?? "",
    status: mapStatusFromBackend(idea.status),
    created_at: idea.created_at,
    updated_at: idea.updated_at,
    image_url: idea.image_url,
  };
}

export const ideasApi = {
  list: (params?: { skip?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.skip !== undefined) qs.set("skip", String(params.skip));
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<BackendIdea[]>(`/ideas/${suffix}`).then((ideas) =>
      ideas.map(fromBackendIdea),
    );
  },

  create: (data: CreateIdeaRequest) =>
    request<BackendIdea>("/ideas/", {
      method: "POST",
      body: JSON.stringify(data),
    }).then(fromBackendIdea),

  get: (id: string) =>
    request<BackendIdea>(`/ideas/${id}`).then(fromBackendIdea),

  update: (id: string, data: UpdateIdeaRequest) => {
    const payload: Record<string, unknown> = { ...data };
    if (data.status) payload.status = mapStatusToBackend(data.status);
    return request<BackendIdea>(`/ideas/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }).then(fromBackendIdea);
  },

  delete: (id: string) =>
    request<void>(`/ideas/${id}`, { method: "DELETE" }),
};

// Uploads (images)
export const uploadsApi = {
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const token = localStorage.getItem("token");
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API_BASE_URL}/uploads/images`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Erro ${res.status}`);
    }

    return res.json();
  },
};

// Chat (LLM + MCP)
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  provider?: string | null;
  model?: string | null;
}

export interface ChatResponse {
  provider: string;
  model: string;
  answer: string;
}

export const chatApi = {
  chat: (data: ChatRequest) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // streaming é consumido diretamente no componente via fetch/SSE
};
