import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, MessageCircle, Send, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NavLink } from "@/components/NavLink";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const Chat = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm the MyIdeas assistant. You can talk to me in natural language to create and view ideas.\n\n" +
        "Examples:\n" +
        "- \"Create an idea saying the system is down\"\n" +
        "- \"List my open ideas\"\n" +
        "- \"Show details for my most recent idea\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingTextRef = useRef<string>("");
  const typingTimerRef = useRef<number | null>(null);

  const startTypingLoop = () => {
    if (typingTimerRef.current !== null) return;
    const CHARS_PER_TICK = 6;
    const INTERVAL_MS = 40;

    typingTimerRef.current = window.setInterval(() => {
      if (!pendingTextRef.current.length) {
        if (!isStreaming) {
          window.clearInterval(typingTimerRef.current!);
          typingTimerRef.current = null;
        }
        return;
      }

      const chunk = pendingTextRef.current.slice(0, CHARS_PER_TICK);
      pendingTextRef.current = pendingTextRef.current.slice(CHARS_PER_TICK);

      setMessages((prev) => {
        if (!prev.length) return prev;
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (!last || last.role !== "assistant") return prev;
        updated[updated.length - 1] = {
          ...last,
          content: last.content + chunk,
        };
        return updated;
      });
    }, INTERVAL_MS);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");

    const systemMessage = {
      role: "system" as const,
      content:
        "You are the idea assistant inside MyIdeas. The user is already authenticated via JWT; " +
        "never ask for email or password. Always use the available MCP tools to create, list and " +
        "inspect ideas on behalf of the current user. When the user asks to create an idea, " +
        "call the appropriate tool and then explain in natural language what you did.\n\n" +
        "FORMATTING: Whenever you list ideas, respond using a valid Markdown GFM TABLE, " +
        "without code blocks, with this exact header: `| # | Title | Status | Created at |` " +
        "and the separator line `| --- | --- | --- | --- |`. Each idea must be one row of the table.",
    };

    const payload = {
      messages: [
        systemMessage,
        ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);

    // cria a bolha vazia do assistente que será preenchida aos poucos
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // token já está no cookie/Authorization via backend; aqui o backend usa OAuth2PasswordBearer,
            // então o token foi enviado no header Authorization pelo fetch anterior via api.ts.
            // Nesta chamada específica, o token está em localStorage, então reaplicamos aqui.
            ...(localStorage.getItem("token")
              ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
              : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Erro ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            const isError = lines[0].startsWith("event: error");
            const dataLine = lines.find((l) => l.startsWith("data:"));
            if (!dataLine) continue;

            // remove apenas o prefixo "data:" (e um espaço opcional),
            // sem fazer trim no resto para não colar as palavras
            let data = dataLine.slice("data:".length);
            if (data.startsWith(" ")) {
              data = data.slice(1);
            }
            if (isError) {
              // Alguns erros de TaskGroup do MCP são inofensivos (por exemplo,
              // quando o tool já executou com sucesso mas o streaming falha depois).
              // Evitamos mostrar um toast vermelho nesses casos específicos.
              const normalized = data.toLowerCase();
              const isBenignTaskGroupError =
                normalized.includes("unhandled errors in a taskgroup") &&
                normalized.includes("1 sub-exception");

              setIsStreaming(false);

              if (!isBenignTaskGroupError) {
                toast({
                  title: "Erro no streaming do chat",
                  description: data,
                  variant: "destructive",
                });
              }
              return;
            }

            if (data === "[DONE]") {
              setIsStreaming(false);
              return;
            }

            // coloca o chunk em uma fila e deixa o loop de digitação
            // cuidar de exibir aos poucos
            pendingTextRef.current += data;
            startTypingLoop();
          }
        }

        setIsStreaming(false);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setIsStreaming(false);
        toast({
          title: "Erro ao enviar mensagem",
          description: err instanceof Error ? err.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    })();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <MessageCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">MyIdeas • Chat</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex gap-2 text-sm font-medium text-muted-foreground">
              <NavLink
                to="/ideas"
                className="px-2 py-1 hover:text-foreground"
                activeClassName="text-foreground"
              >
                Ideas
              </NavLink>
              <NavLink
                to="/chat"
                className="px-2 py-1 hover:text-foreground"
                activeClassName="text-foreground border-b-2 border-primary"
              >
                Chat
              </NavLink>
            </nav>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user?.full_name || user?.email}
              </span>
              <Button variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Lightbulb className="h-3 w-3 text-primary" />
          </div>
          <span>
            Talk to me to <span className="font-semibold text-foreground">create</span> and{" "}
            <span className="font-semibold text-foreground">view</span> ideas using MCP tools.
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-4 rounded-lg border bg-card p-4 shadow-card">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={
                  m.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                  }
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      className="prose prose-sm dark:prose-invert max-w-none"
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    m.content.split("\n").map((line, i) => (
                      <p key={i} className={i > 0 ? "mt-1" : undefined}>
                        {line}
                      </p>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-2 space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to do with ideas. E.g. 'Create an idea saying the site is down'."
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                The assistant will use MCP tools to call the idea endpoints for you.
              </span>
              <Button type="submit" disabled={isStreaming}>
                <Send className="mr-2 h-4 w-4" />
                {isStreaming ? "Responding..." : "Send"}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Chat;

