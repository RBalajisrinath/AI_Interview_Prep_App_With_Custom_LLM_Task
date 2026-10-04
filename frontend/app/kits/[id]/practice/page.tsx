"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Kit, Flashcard } from "@/lib/types";

interface CardProgress {
  flashcard_id: string;
  confidence: number;
  last_reviewed: string;
  review_count: number;
}

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [kit, setKit] = useState<Kit | null>(null);
  const [progress, setProgress] = useState<CardProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionResults, setSessionResults] = useState<Map<string, number>>(new Map());

  const kitId = params.id as string;

  const fetchData = useCallback(async () => {
    try {
      const [kitData, progressData] = await Promise.all([
        api.get<Kit>(`/kits/${kitId}`),
        api.get<{ cards: CardProgress[] }>(`/practice/${kitId}`),
      ]);
      setKit(kitData);
      setProgress(progressData.cards || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load practice data");
    } finally {
      setLoading(false);
    }
  }, [kitId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) fetchData();
  }, [user, authLoading, router, fetchData]);

  // Confidence-weighted ordering: least confident first, then least recently reviewed
  const orderedCards = useMemo(() => {
    if (!kit) return [];
    const cards = [...kit.flashcards];
    const progressMap = new Map(progress.map((p) => [p.flashcard_id, p]));

    return cards.sort((a, b) => {
      const aProg = progressMap.get(a.id);
      const bProg = progressMap.get(b.id);

      // Never reviewed first
      if (!aProg && !bProg) return 0;
      if (!aProg) return -1;
      if (!bProg) return 1;

      // Lower confidence first
      if (aProg.confidence !== bProg.confidence) {
        return aProg.confidence - bProg.confidence;
      }

      // Then least recently reviewed
      return new Date(aProg.last_reviewed).getTime() - new Date(bProg.last_reviewed).getTime();
    });
  }, [kit, progress]);

  const currentCard = orderedCards[currentIdx];
  const totalCards = orderedCards.length;
  const reviewedCount = sessionResults.size;

  const recordConfidence = async (confidence: number) => {
    if (!currentCard) return;
    setSessionResults(new Map(sessionResults).set(currentCard.id, confidence));

    // Send to backend
    try {
      await api.post("/practice/record", {
        kit_id: kitId,
        card_results: [{ flashcard_id: currentCard.id, confidence }],
      });
    } catch (err) {
      console.error("Failed to record practice:", err);
    }

    // Move to next card
    if (currentIdx < totalCards - 1) {
      setCurrentIdx(currentIdx + 1);
      setRevealed(false);
    }
  };

  const goToCard = (idx: number) => {
    setCurrentIdx(idx);
    setRevealed(false);
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

  if (!kit || totalCards === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <p className="text-gray-500 mb-4">No flashcards to practice.</p>
          <button onClick={() => router.push(`/kits/${kitId}`)} className="btn-primary">
            Back to Kit
          </button>
        </div>
      </div>
    );
  }

  const isComplete = reviewedCount === totalCards;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Practice Mode</h1>
            <p className="text-sm text-gray-500">
              {reviewedCount}/{totalCards} reviewed
            </p>
          </div>
          <button onClick={() => router.push(`/kits/${kitId}`)} className="btn-secondary text-sm">
            Back to Kit
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {isComplete ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-2xl font-semibold mb-2">Session Complete!</h2>
            <p className="text-gray-600 mb-6">You reviewed all {totalCards} flashcards.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setSessionResults(new Map());
                  setCurrentIdx(0);
                  setRevealed(false);
                }}
                className="btn-primary"
              >
                Practice Again
              </button>
              <button onClick={() => router.push(`/kits/${kitId}`)} className="btn-secondary">
                Back to Kit
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Card {currentIdx + 1} of {totalCards}</span>
                <span>{Math.round((reviewedCount / totalCards) * 100)}% complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(reviewedCount / totalCards) * 100}%` }}
                />
              </div>
            </div>

            {/* Flashcard */}
            <div className="card min-h-[300px] flex flex-col">
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-xl text-center font-medium text-gray-900">
                  {currentCard.front}
                </p>
              </div>

              {revealed && (
                <div className="border-t border-gray-200 p-6 bg-blue-50">
                  <p className="text-sm font-medium text-blue-800 mb-2">Answer:</p>
                  <p className="text-gray-800">{currentCard.back}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-4">
              {!revealed ? (
                <button
                  onClick={() => setRevealed(true)}
                  className="btn-primary w-full py-3 text-lg"
                >
                  Reveal Answer
                </button>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-3 text-center">How confident did you feel?</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => recordConfidence(level)}
                        className={`py-3 rounded-lg font-medium transition-colors ${
                          level <= 2
                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                            : level === 3
                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
                    <span>Not confident</span>
                    <span>Very confident</span>
                  </div>
                </div>
              )}
            </div>

            {/* Card navigation */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => goToCard(Math.max(0, currentIdx - 1))}
                disabled={currentIdx === 0}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <div className="flex gap-1">
                {orderedCards.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToCard(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentIdx
                        ? "bg-blue-600"
                        : sessionResults.has(orderedCards[idx].id)
                        ? "bg-green-400"
                        : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => goToCard(Math.min(totalCards - 1, currentIdx + 1))}
                disabled={currentIdx === totalCards - 1}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
