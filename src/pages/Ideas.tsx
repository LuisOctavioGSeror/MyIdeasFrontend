import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  ideasApi,
  uploadsApi,
  CreateIdeaRequest,
  UpdateIdeaRequest,
  IdeaStatus,
} from "@/services/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LogOut,
  MessageCircle,
  Plus,
  Lightbulb,
  Trash2,
  Pencil,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const statusLabel: Record<IdeaStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed",
};

const statusColor: Record<IdeaStatus, string> = {
  open: "bg-idea-open/15 text-idea-open border-idea-open/30",
  in_progress: "bg-idea-progress/15 text-idea-progress border-idea-progress/30",
  closed: "bg-idea-closed/15 text-idea-closed border-idea-closed/30",
};

const Ideas = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<IdeaStatus>("open");
  const [editImageUrl, setEditImageUrl] = useState("");

  const PAGE_SIZE = 9; // 3 cols x 3 rows
  const [page, setPage] = useState(0);
  const skip = useMemo(() => page * PAGE_SIZE, [page]);

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["ideas", page],
    queryFn: () => ideasApi.list({ skip, limit: PAGE_SIZE }),
  });

  const createMutation = useMutation({
    mutationFn: ideasApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      setTitle("");
      setDescription("");
      setImageUrl("");
      setShowForm(false);
      toast({ title: "Idea created successfully!" });
    },
    onError: (err: unknown) => {
      toast({
        title: "Error creating idea",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ideasApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      // se apagou o último item da página, volta uma página pra não ficar “vazio”
      if (ideas.length === 1 && page > 0) setPage((p) => p - 1);
      toast({ title: "Idea removed." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIdeaRequest }) =>
      ideasApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      setEditOpen(false);
      setEditingId(null);
      toast({ title: "Idea updated." });
    },
    onError: (err: unknown) => {
      toast({
        title: "Error updating idea",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ title, description, image_url: imageUrl || undefined } satisfies CreateIdeaRequest);
  };

  const openEdit = (idea: { id: string; title: string; description: string; status: IdeaStatus }) => {
    setEditingId(idea.id);
    setEditTitle(idea.title);
    setEditDescription(idea.description);
    setEditStatus(idea.status);
    setEditImageUrl((idea as any).image_url ?? "");
    setEditOpen(true);
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      data: {
        title: editTitle,
        description: editDescription,
        status: editStatus,
        image_url: editImageUrl || undefined,
      },
    });
  };

  const handleFileUpload = async (file: File, mode: "create" | "edit") => {
    try {
      const { url } = await uploadsApi.uploadImage(file);
      if (mode === "create") {
        setImageUrl(url);
      } else {
        setEditImageUrl(url);
      }
      toast({ title: "Image uploaded.", description: "The image URL was attached to the idea." });
    } catch (err: unknown) {
      toast({
        title: "Error uploading image",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Lightbulb className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">MyIdeas</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 hover:bg-primary/10 hover:text-primary"
              onClick={() => navigate("/chat")}
            >
              <MessageCircle className="h-3 w-3" />
              <span className="hidden xs:inline sm:inline">Chat</span>
            </Button>
            <span className="text-sm text-muted-foreground">
              {user?.full_name || user?.email}
            </span>
            <Button variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Ideas</h1>
            <p className="text-sm text-muted-foreground">Page {page + 1}</p>
          </div>
          <Button className="hover:bg-primary/90" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            New Idea
          </Button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 animate-fade-in rounded-lg border bg-card p-5 shadow-card"
          >
            <h2 className="mb-4 text-lg font-semibold text-card-foreground">
              New Idea
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Briefly describe the idea"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the idea..."
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image (drag &amp; drop or paste URL)</Label>
                <div
                  id="imageUrl"
                  className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      void handleFileUpload(file, "create");
                      return;
                    }
                    const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
                    if (uri) setImageUrl(uri);
                  }}
                  onPaste={(e) => {
                    const uri = e.clipboardData.getData("text/plain");
                    if (uri) setImageUrl(uri);
                  }}
                >
                  <span className="font-medium text-foreground">Drop an image link here</span>
                  <span>or paste / type the URL below</span>
                  <Input
                    className="mt-2 cursor-pointer"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file, "create");
                    }}
                  />
                  <Input
                    className="mt-2"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    type="url"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Idea"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        )}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit idea</DialogTitle>
              <DialogDescription>Update the idea information.</DialogDescription>
            </DialogHeader>

            <form onSubmit={submitEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-image-url">Image (drag &amp; drop or paste URL)</Label>
                <div
                  id="edit-image-url"
                  className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/40 px-3 py-3 text-center text-xs text-muted-foreground"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      void handleFileUpload(file, "edit");
                      return;
                    }
                    const uri = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
                    if (uri) setEditImageUrl(uri);
                  }}
                  onPaste={(e) => {
                    const uri = e.clipboardData.getData("text/plain");
                    if (uri) setEditImageUrl(uri);
                  }}
                >
                  <span className="font-medium text-foreground">Drop an image link here</span>
                  <span>or paste / type the URL below</span>
                  <Input
                    className="mt-2 cursor-pointer"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file, "edit");
                    }}
                  />
                  <Input
                    className="mt-2"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="https://..."
                    type="url"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as IdeaStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Loading ideas...</p>
          </div>
        ) : ideas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <Lightbulb className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">No ideas yet</p>
            <p className="text-sm text-muted-foreground/70">
              Create your first idea to get started
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ideas.map((idea, i) => (
                <Card
                  key={idea.id}
                  className="group animate-fade-in overflow-hidden transition-shadow hover:shadow-elevated"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {(idea.image_url ?? "") && (
                    <div className="h-40 w-full bg-muted">
                      <img
                        src={idea.image_url as string}
                        alt={idea.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-semibold text-card-foreground">
                        {idea.title}
                      </h3>
                      <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="group/edit h-8 w-8 p-0 hover:bg-primary/10"
                            onClick={() => openEdit(idea as any)}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground group-hover/edit:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="group/del h-8 w-8 p-0 hover:bg-primary/10"
                            onClick={() => deleteMutation.mutate(idea.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground group-hover/del:text-primary" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {idea.description}
                    </p>
                  </CardContent>

                  <CardFooter className="flex items-center justify-between px-4 pb-4 pt-0">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor[idea.status]}`}
                    >
                      {statusLabel[idea.status]}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {new Date(idea.created_at).toLocaleDateString("en-US")}
                    </span>
                  </CardFooter>
                </Card>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1}</span>
              <Button
                variant="outline"
                disabled={ideas.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Ideas;

