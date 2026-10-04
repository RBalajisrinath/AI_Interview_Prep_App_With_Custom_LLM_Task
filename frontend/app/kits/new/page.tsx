"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function NewKitPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(14);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    companyUrl?: string;
    days?: string;
    jobDescription?: string;
  }>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const validate = () => {
    const errors: typeof validationErrors = {};

    if (!companyUrl.trim()) {
      errors.companyUrl = "Company URL is required";
    } else {
      try {
        new URL(companyUrl);
      } catch {
        errors.companyUrl = "Please enter a valid URL";
      }
    }

    if (!days || days < 1 || days > 60) {
      errors.days = "Days must be between 1 and 60";
    }

    if (!jobDescription.trim() || jobDescription.trim().length < 10) {
      errors.jobDescription = "Job description must be at least 10 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    try {
      setLoading(true);
      const kit = await api.post<{ id: string }>("/kits", {
        company_url: companyUrl.trim(),
        days,
        jd: jobDescription.trim(),
      });
      router.push(`/kits/${kit.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create kit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Create New Kit</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="companyUrl"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Company URL
            </label>
            <input
              type="url"
              id="companyUrl"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="https://example.com"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.companyUrl ? "border-red-300" : "border-gray-300"
              }`}
            />
            {validationErrors.companyUrl && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.companyUrl}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="days"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Preparation Days
            </label>
            <input
              type="number"
              id="days"
              value={days}
              onChange={(e) => setDays(e.target.value === "" ? 1 : parseInt(e.target.value, 10))}
              min={1}
              max={60}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.days ? "border-red-300" : "border-gray-300"
              }`}
            />
            {validationErrors.days && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.days}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="jobDescription"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Job Description
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={8}
              placeholder="Paste the full job description here..."
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.jobDescription
                  ? "border-red-300"
                  : "border-gray-300"
              }`}
            />
            {validationErrors.jobDescription && (
              <p className="mt-1 text-sm text-red-600">
                {validationErrors.jobDescription}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Creating...
                </span>
              ) : (
                "Create Kit"
              )}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
