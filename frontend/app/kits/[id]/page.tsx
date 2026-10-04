"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Kit, Question, Flashcard } from "@/lib/types";

type Tab = "brief" | "role" | "questions" | "flashcards" | "schedule";

export default function KitBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [kit, setKit] = useState<Kit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("brief");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const kitId = params.id as string;

  const fetchKit = useCallback(async () => {
    try {
      const data = await api.get<Kit>(`/kits/${kitId}`);
      setKit(data);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load kit");
    } finally {
      setLoading(false);
    }
  }, [kitId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) fetchKit();
  }, [user, authLoading, router, fetchKit]);

  const saveField = async (field: string, value: any) => {
    if (!kit) return;
    try {
      const updated = await api.patch<Kit>(`/kits/${kitId}`, { [field]: value });
      setKit(updated);
      setEditingField(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const regenerateSection = async (section: string) => {
    setRegenerating(section);
    try {
      const updated = await api.post<Kit>(`/kits/${kitId}/regenerate/${section}`, {});
      setKit(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegenerating(null);
    }
  };

  const updateQuestion = async (qId: string, updates: Partial<Question>) => {
    if (!kit) return;
    const newQuestions = kit.questions.map((q) =>
      q.id === qId ? { ...q, ...updates, origin: "edited" as const } : q
    );
    setKit({ ...kit, questions: newQuestions });
    try {
      const updated = await api.patch<Kit>(`/kits/${kitId}`, { questions: newQuestions });
      setKit(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteQuestion = async (qId: string) => {
    if (!kit) return;
    const newQuestions = kit.questions.filter((q) => q.id !== qId);
    setKit({ ...kit, questions: newQuestions });
    try {
      const updated = await api.patch<Kit>(`/kits/${kitId}`, { questions: newQuestions });
      setKit(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addQuestion = async () => {
    if (!kit) return;
    const newQ: Question = {
      id: `q_${Date.now()}`,
      requirement_ids: [],
      category: "technical",
      prompt: "New question",
      answer_outline: "Answer outline",
      difficulty: 2,
      origin: "pinned",
    };
    const newQuestions = [...kit.questions, newQ];
    setKit({ ...kit, questions: newQuestions });
    try {
      const updated = await api.patch<Kit>(`/kits/${kitId}`, { questions: newQuestions });
      setKit(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateFlashcard = async (fId: string, updates: Partial<Flashcard>) => {
    if (!kit) return;
    const newCards = kit.flashcards.map((f) =>
      f.id === fId ? { ...f, ...updates, origin: "edited" as const } : f
    );
    setKit({ ...kit, flashcards: newCards });
    try {
      const updated = await api.patch<Kit>(`/kits/${kitId}`, { flashcards: newCards });
      setKit(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteFlashcard = async (fId: string) => {
    if (!kit) return;
    const newCards = kit.flashcards.filter((f) => f.id !== fId);
    setKit({ ...kit, flashcards: newCards });
    try {
      const updated = await api.patch<Kit>(`/kits/${kitId}`, { flashcards: newCards });
      setKit(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addFlashcard = async () => {
    if (!kit) return;
    const newF: Flashcard = {
      id: `f_${Date.now()}`,
      front: "New flashcard",
      back: "Answer",
      requirement_ids: [],
      origin: "pinned",
    };
    const newCards = [...kit.flashcards, newF];
    setKit({ ...kit, flashcards: newCards });
    try {
      const updated = await api.patch<Kit>(`/kits/${kitId}`, { flashcards: newCards });
      setKit(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteKit = async () => {
    setDeleting(true);
    try {
      await api.delete(`/kits/${kitId}`);
      router.push("/kits");
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const moveQuestion = async (qId: string, direction: "up" | "down") => {
    if (!kit) return;
    const idx = kit.questions.findIndex((q) => q.id === qId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= kit.questions.length) return;
    const newQuestions = [...kit.questions];
    [newQuestions[idx], newQuestions[newIdx]] = [newQuestions[newIdx], newQuestions[idx]];
    setKit({ ...kit, questions: newQuestions });
    try {
      const updated = await api.patch<Kit>(`/kits/${kitId}`, { questions: newQuestions });
      setKit(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error && !kit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => router.push("/kits")} className="btn-primary">
            Back to Kits
          </button>
        </div>
      </div>
    );
  }

  if (!kit) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "brief", label: "Company Brief" },
    { id: "role", label: "Role" },
    { id: "questions", label: `Questions (${kit.questions.length})` },
    { id: "flashcards", label: `Flashcards (${kit.flashcards.length})` },
    { id: "schedule", label: "Schedule" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {kit.source.company || "Company"} — {kit.role.title}
            </h1>
            <p className="text-sm text-gray-500">
              {kit.source.location} · {kit.schedule.days_available} days to prepare
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/kits/${kitId}/practice`)}
              className="btn-primary text-sm"
            >
              Practice
            </button>
            <button onClick={() => setDeleteConfirm(true)} className="btn-danger text-sm">
              Delete
            </button>
            <button onClick={() => router.push("/kits")} className="btn-secondary text-sm">
              Back
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {activeTab === "brief" && (
          <BriefSection
            kit={kit}
            editingField={editingField}
            editValue={editValue}
            setEditingField={setEditingField}
            setEditValue={setEditValue}
            saveField={saveField}
            regenerating={regenerating}
            regenerateSection={regenerateSection}
          />
        )}

        {activeTab === "role" && <RoleSection kit={kit} />}

        {activeTab === "questions" && (
          <QuestionsSection
            kit={kit}
            updateQuestion={updateQuestion}
            deleteQuestion={deleteQuestion}
            addQuestion={addQuestion}
            moveQuestion={moveQuestion}
            regenerating={regenerating}
            regenerateSection={regenerateSection}
          />
        )}

        {activeTab === "flashcards" && (
          <FlashcardsSection
            kit={kit}
            updateFlashcard={updateFlashcard}
            deleteFlashcard={deleteFlashcard}
            addFlashcard={addFlashcard}
            regenerating={regenerating}
            regenerateSection={regenerateSection}
          />
        )}

        {activeTab === "schedule" && (
          <ScheduleSection
            kit={kit}
            regenerating={regenerating}
            regenerateSection={regenerateSection}
          />
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Kit?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This action cannot be undone. All questions, flashcards, and progress will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteKit}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Section Components

function BriefSection({ kit, editingField, editValue, setEditingField, setEditValue, saveField, regenerating, regenerateSection }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Company Brief</h2>
        <button
          onClick={() => regenerateSection("company_brief")}
          disabled={regenerating === "company_brief"}
          className="btn-secondary text-sm"
        >
          {regenerating === "company_brief" ? "Regenerating..." : "Regenerate"}
        </button>
      </div>

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
        {editingField === "summary" ? (
          <div>
            <textarea
              className="input min-h-[100px]"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => saveField("company_brief", { ...kit.company_brief, summary: editValue })} className="btn-primary text-sm">Save</button>
              <button onClick={() => setEditingField(null)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <p
            className="text-gray-800 cursor-pointer hover:bg-gray-50 p-2 rounded"
            onClick={() => { setEditingField("summary"); setEditValue(kit.company_brief.summary); }}
          >
            {kit.company_brief.summary || "Click to edit"}
          </p>
        )}
      </div>

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">What They Do</label>
        {editingField === "what_they_do" ? (
          <div>
            <textarea
              className="input min-h-[100px]"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => saveField("company_brief", { ...kit.company_brief, what_they_do: editValue })} className="btn-primary text-sm">Save</button>
              <button onClick={() => setEditingField(null)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <p
            className="text-gray-800 cursor-pointer hover:bg-gray-50 p-2 rounded"
            onClick={() => { setEditingField("what_they_do"); setEditValue(kit.company_brief.what_they_do); }}
          >
            {kit.company_brief.what_they_do || "Click to edit"}
          </p>
        )}
      </div>

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">Sources</label>
        <ul className="space-y-1">
          {kit.company_brief.sources.map((s: string, i: number) => (
            <li key={i}>
              <a href={s} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                {s}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RoleSection({ kit }: { kit: Kit }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Role Breakdown</h2>
      <div className="card">
        <p><strong>Title:</strong> {kit.role.title}</p>
        <p><strong>Seniority:</strong> {kit.role.seniority}</p>
        <p><strong>Location:</strong> {kit.source.location}</p>
      </div>
      <div className="card">
        <h3 className="font-medium mb-2">Responsibilities</h3>
        <ul className="list-disc list-inside space-y-1">
          {kit.role.responsibilities.map((r: string, i: number) => (
            <li key={i} className="text-gray-700">{r}</li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3 className="font-medium mb-3">Requirements</h3>
        <div className="space-y-2">
          {kit.role.requirements.map((r) => (
            <div key={r.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <span className={`badge ${r.priority === "must" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {r.priority}
              </span>
              <span className="badge bg-blue-100 text-blue-700">{r.kind}</span>
              <span className="text-sm text-gray-800">{r.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionsSection({ kit, updateQuestion, deleteQuestion, addQuestion, moveQuestion, regenerating, regenerateSection }: any) {
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Questions ({kit.questions.length})</h2>
        <div className="flex gap-2">
          <button onClick={addQuestion} className="btn-secondary text-sm">+ Add Question</button>
          <button
            onClick={() => regenerateSection("questions")}
            disabled={regenerating === "questions"}
            className="btn-secondary text-sm"
          >
            {regenerating === "questions" ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>

      {kit.questions.length === 0 && (
        <div className="card text-center text-gray-500">
          No questions yet. Add one or regenerate.
        </div>
      )}

      {kit.questions.map((q: Question, idx: number) => (
        <div key={q.id} className="card">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="badge bg-purple-100 text-purple-700">{q.category}</span>
                <span className="badge bg-gray-100 text-gray-600">Difficulty: {q.difficulty}/3</span>
                {q.origin === "edited" && <span className="badge bg-yellow-100 text-yellow-700">edited</span>}
                {q.origin === "pinned" && <span className="badge bg-green-100 text-green-700">pinned</span>}
              </div>
              <p className="font-medium text-gray-900">{q.prompt}</p>
              {expandedQ === q.id && (
                <div className="mt-3 p-3 bg-gray-50 rounded">
                  <p className="text-sm font-medium text-gray-700 mb-1">Answer Outline:</p>
                  <p className="text-sm text-gray-600">{q.answer_outline}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Requirements: {q.requirement_ids.join(", ")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => moveQuestion(q.id, "up")} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">▲</button>
              <button onClick={() => moveQuestion(q.id, "down")} disabled={idx === kit.questions.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs">▼</button>
            </div>
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
            <button onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)} className="text-sm text-blue-600 hover:underline">
              {expandedQ === q.id ? "Hide" : "Show"} Answer
            </button>
            <select
              value={q.category}
              onChange={(e) => updateQuestion(q.id, { category: e.target.value as Question["category"] })}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="technical">Technical</option>
              <option value="behavioural">Behavioural</option>
              <option value="system-design">System Design</option>
              <option value="company-fit">Company Fit</option>
            </select>
            <button onClick={() => deleteQuestion(q.id)} className="text-sm text-red-600 hover:underline ml-auto">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FlashcardsSection({ kit, updateFlashcard, deleteFlashcard, addFlashcard, regenerating, regenerateSection }: any) {
  const [editingF, setEditingF] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Flashcards ({kit.flashcards.length})</h2>
        <div className="flex gap-2">
          <button onClick={addFlashcard} className="btn-secondary text-sm">+ Add Flashcard</button>
          <button
            onClick={() => regenerateSection("flashcards")}
            disabled={regenerating === "flashcards"}
            className="btn-secondary text-sm"
          >
            {regenerating === "flashcards" ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>

      {kit.flashcards.map((f: Flashcard) => (
        <div key={f.id} className="card">
          {editingF === f.id ? (
            <div className="space-y-2">
              <input className="input" value={editFront} onChange={(e) => setEditFront(e.target.value)} placeholder="Front" />
              <textarea className="input" value={editBack} onChange={(e) => setEditBack(e.target.value)} placeholder="Back" />
              <div className="flex gap-2">
                <button onClick={() => { updateFlashcard(f.id, { front: editFront, back: editBack }); setEditingF(null); }} className="btn-primary text-sm">Save</button>
                <button onClick={() => setEditingF(null)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="font-medium">{f.front}</p>
              <p className="text-gray-600 text-sm mt-1">{f.back}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setEditingF(f.id); setEditFront(f.front); setEditBack(f.back); }} className="text-sm text-blue-600 hover:underline">Edit</button>
                <button onClick={() => deleteFlashcard(f.id)} className="text-sm text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScheduleSection({ kit, regenerating, regenerateSection }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Study Schedule ({kit.schedule.days_available} days)</h2>
        <button
          onClick={() => regenerateSection("schedule")}
          disabled={regenerating === "schedule"}
          className="btn-secondary text-sm"
        >
          {regenerating === "schedule" ? "Regenerating..." : "Regenerate"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kit.schedule.days.map((day: any) => (
          <div key={day.day} className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Day {day.day}</h3>
              <span className="badge bg-blue-100 text-blue-700">{day.minutes} min</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{day.focus}</p>
            <p className="text-xs text-gray-500">{day.question_ids.length} questions</p>
          </div>
        ))}
      </div>

      {kit.coverage.uncovered_requirement_ids.length > 0 && (
        <div className="card bg-yellow-50 border-yellow-200">
          <p className="text-sm text-yellow-800">
            <strong>Coverage gaps:</strong> {kit.coverage.uncovered_requirement_ids.length} requirements not covered by questions.
          </p>
        </div>
      )}
    </div>
  );
}
