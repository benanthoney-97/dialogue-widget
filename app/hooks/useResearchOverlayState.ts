"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentResearchRecord } from "@/app/components/ResearchOverlayContent";

const normalizeTargetSources = (entries: unknown): string[] =>
  Array.isArray(entries)
    ? Array.from(
        new Set(
          entries
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter((value) => value.length > 0)
        )
      )
    : [];

export function useResearchOverlayState(clientId: string | null) {
  const [agentResearch, setAgentResearch] = useState<AgentResearchRecord[]>([]);
  const [agentResearchLoading, setAgentResearchLoading] = useState(false);
  const [agentResearchError, setAgentResearchError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentResearchRecord | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [isPromptDirty, setIsPromptDirty] = useState(false);
  const [isPromptSaving, setIsPromptSaving] = useState(false);
  const [promptSaveError, setPromptSaveError] = useState<string | null>(null);
  const [targetSources, setTargetSources] = useState<string[]>([]);

  const selectAgentById = useCallback(
    (agentId: string | null) => {
      if (!agentId) {
        setSelectedAgent(null);
        return;
      }
      const match = agentResearch.find((record) => record.agentId === agentId) ?? null;
      setSelectedAgent(match);
      if (match) {
        setPromptValue(match.watchlistQuery ?? "");
        setIsPromptDirty(false);
        setPromptSaveError(null);
      }
    },
    [agentResearch]
  );

  const handlePromptChange = useCallback((value: string) => {
    setPromptValue(value);
    setIsPromptDirty(true);
  }, []);

  const handleClearPrompt = useCallback(() => {
    if (!selectedAgent) return;
    const current = selectedAgent.watchlistQuery ?? "";
    setPromptValue(current);
    setPromptSaveError(null);
    setIsPromptDirty(false);
  }, [selectedAgent]);

  const handlePromptSave = useCallback(
    async (value: string) => {
      if (!clientId || !selectedAgent) return;
      const trimmed = value.trim();
      const current = selectedAgent.watchlistQuery ?? "";
      if (trimmed === current) {
        setPromptValue(value);
        setIsPromptDirty(false);
        return;
      }
      setIsPromptSaving(true);
      setPromptSaveError(null);
      try {
        const response = await fetch(`/api/clients/${clientId}/watchlist`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: selectedAgent.agentId, query: trimmed || null }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const errorMessage =
            payload?.error ?? payload?.message ?? `Unable to save prompt (${response.status})`;
          setPromptSaveError(errorMessage);
          return;
        }
        if (payload?.error) {
          setPromptSaveError(payload.error);
          return;
        }
        const savedQuery = typeof payload?.query === "string" ? payload.query.trim() : null;
        setAgentResearch((prev) =>
          prev.map((record) =>
            record.agentId === selectedAgent.agentId ? { ...record, watchlistQuery: savedQuery } : record
          )
        );
        setSelectedAgent((prev) => (prev ? { ...prev, watchlistQuery: savedQuery } : prev));
        setPromptValue(savedQuery ?? "");
        setIsPromptDirty(false);
      } catch (error) {
        console.error("[Research] Failed to save prompt", error);
        setPromptSaveError("Unable to save prompt.");
      } finally {
        setIsPromptSaving(false);
      }
    },
    [clientId, selectedAgent]
  );

  const handleRemoveSourcedArticle = useCallback(
    (articleUrl: string) => {
      if (!selectedAgent) return;
      setAgentResearch((prev) =>
        prev.map((record) =>
          record.agentId === selectedAgent.agentId
            ? {
                ...record,
                sourcedArticles: record.sourcedArticles.filter((article) => article.url !== articleUrl),
              }
            : record
        )
      );
      setSelectedAgent((prev) =>
        prev
          ? {
              ...prev,
              sourcedArticles: prev.sourcedArticles.filter((article) => article.url !== articleUrl),
            }
          : prev
      );
    },
    [selectedAgent]
  );

  const addArticleToAgent = useCallback(
    (agentId: string, article: { title: string | null; url: string | null }) => {
      const normalizedUrl = article.url?.trim();
      if (!normalizedUrl) return;
      const normalizedTitle =
        typeof article.title === "string" && article.title.trim().length > 0
          ? article.title.trim()
          : "Untitled article";
      setAgentResearch((prev) =>
        prev.map((record) => {
          if (record.agentId !== agentId) return record;
          const updatedSourced = record.sourcedArticles.filter((item) => item.url !== normalizedUrl);
          const newAdded = [...record.addedArticles, { title: normalizedTitle, url: normalizedUrl }];
          const uniqueAdded = newAdded.filter(
            (item, index) => newAdded.findIndex((candidate) => candidate.url === item.url) === index
          );
          return { ...record, sourcedArticles: updatedSourced, addedArticles: uniqueAdded };
        })
      );
      setSelectedAgent((prev) => {
        if (!prev || prev.agentId !== agentId) return prev;
        const updatedSourced = prev.sourcedArticles.filter((item) => item.url !== normalizedUrl);
        const newAdded = [...prev.addedArticles, { title: normalizedTitle, url: normalizedUrl }];
        const uniqueAdded = newAdded.filter(
          (item, index) => newAdded.findIndex((candidate) => candidate.url === item.url) === index
        );
        return { ...prev, sourcedArticles: updatedSourced, addedArticles: uniqueAdded };
      });
    },
    []
  );

  useEffect(() => {
    if (!clientId) {
      setAgentResearch([]);
      setAgentResearchError(null);
      setAgentResearchLoading(false);
      return;
    }
    let isMounted = true;
    const controller = new AbortController();

    async function fetchAgentResearch() {
      setAgentResearchLoading(true);
      setAgentResearchError(null);
      try {
  const response = await fetch(`/api/clients/${clientId}/agent-research`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const message = `Request failed with status ${response.status}`;
          console.error("[Research] Failed to load agent research", message);
          if (isMounted) {
            setAgentResearchError("Unable to load agent research data");
            setAgentResearch([]);
          }
          return;
        }
        const payload = (await response.json()) as {
          records?: Array<{
            agent_id?: string | null;
            persona_name?: string | null;
            knowledge_text?: string | null;
            updated_at?: string | null;
            sourced_articles?: Array<{ title?: string | null; url?: string | null }>;
            sourced_articles_count?: number | null;
            added_articles?: Array<{ title?: string | null; url?: string | null }>;
            watchlist_query?: string | null;
            current_job_status?: string | null;
          }>;
        };
        if (!isMounted) return;
        const records = Array.isArray(payload.records) ? payload.records : [];
        const normalized: AgentResearchRecord[] = records
          .reduce<AgentResearchRecord[]>((acc, record) => {
            const agentId = typeof record.agent_id === "string" ? record.agent_id.trim() : "";
            if (!agentId) {
              return acc;
            }
            const personaName =
              typeof record.persona_name === "string" && record.persona_name.trim().length > 0
                ? record.persona_name.trim()
                : "Unnamed agent";
            const knowledgeText =
              typeof record.knowledge_text === "string" && record.knowledge_text.trim().length > 0
                ? record.knowledge_text.trim()
                : null;
            const updatedAt =
              typeof record.updated_at === "string" && record.updated_at.trim().length > 0
                ? record.updated_at
                : null;
            const sourcedArticles =
              Array.isArray(record.sourced_articles) && record.sourced_articles.length > 0
                ? record.sourced_articles
                    .map((article) => ({
                      title:
                        typeof article?.title === "string" && article.title.trim().length > 0
                          ? article.title.trim()
                          : "Untitled article",
                      url: typeof article?.url === "string" ? article.url : "",
                    }))
                    .filter((article) => article.url.length > 0)
                : [];
            const addedArticles =
              Array.isArray(record.added_articles) && record.added_articles.length > 0
                ? record.added_articles
                    .map((article) => ({
                      title:
                        typeof article?.title === "string" && article.title.trim().length > 0
                          ? article.title.trim()
                          : "Untitled article",
                      url: typeof article?.url === "string" ? article.url : "",
                    }))
                    .filter((article) => article.url.length > 0)
                : [];
            const watchlistQuery =
              typeof record.watchlist_query === "string" && record.watchlist_query.trim().length > 0
                ? record.watchlist_query.trim()
                : null;
            const rawSourcedArticleCount =
              typeof record.sourced_articles_count === "number" && !Number.isNaN(record.sourced_articles_count)
                ? Math.max(0, Math.floor(record.sourced_articles_count))
                : null;
            const sourcedArticlesCount =
              rawSourcedArticleCount !== null
                ? Math.max(rawSourcedArticleCount, sourcedArticles.length)
                : sourcedArticles.length;
            const currentJobStatus =
              typeof record.current_job_status === "string" && record.current_job_status.trim().length > 0
                ? record.current_job_status.trim().toLowerCase()
                : null;
            acc.push({
              agentId,
              personaName,
              knowledgeText,
              updatedAt,
              sourcedArticles,
              addedArticles,
              sourcedArticlesCount,
              watchlistQuery,
              currentJobStatus,
            });
            return acc;
          }, [])
          .sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return dateB - dateA;
          });
        setAgentResearch(normalized);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Research] Unexpected error loading agent research", error);
        if (isMounted) {
          setAgentResearchError("Unexpected error loading agent research");
          setAgentResearch([]);
        }
      } finally {
        if (isMounted) {
          setAgentResearchLoading(false);
        }
      }
    }

    void fetchAgentResearch();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientId) {
      setTargetSources([]);
      return;
    }
    let isMounted = true;
    const controller = new AbortController();

    async function fetchPriorities() {
      try {
  const response = await fetch(`/api/clients/${clientId}/research-priorities`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          console.error("[Research] Failed to load research priorities", response.status);
          return;
        }
        const payload = (await response.json()) as {
          id?: string | null;
          client_id?: string | null;
          priority?: { target_sources?: unknown[] | null } | null;
        };
        if (!isMounted) return;
        const sourcesRaw = payload.priority?.target_sources ?? null;
        console.log("[Research] priorities payload", {
          clientId,
          priorityRow: payload,
          sourcesRaw,
        });
        setTargetSources(normalizeTargetSources(sourcesRaw));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Research] Unexpected error loading priorities", error);
      }
    }

    void fetchPriorities();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientId]);

  const toggleTargetSource = useCallback(
    async (sourceName: string) => {
      if (!clientId) return;
      const normalizedName = sourceName.trim();
      if (!normalizedName) return;
      const previousTargets = targetSources;
      const normalizedKey = normalizedName.toLowerCase();
      const isSelected = previousTargets.some(
        (entry) => entry.trim().toLowerCase() === normalizedKey
      );
      const nextTargets = isSelected
        ? previousTargets.filter((entry) => entry.trim().toLowerCase() !== normalizedKey)
        : [...previousTargets, normalizedName];
      setTargetSources(nextTargets);

      try {
  const response = await fetch(`/api/clients/${clientId}/research-priorities`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_sources: nextTargets }),
        });
        if (!response.ok) {
          console.error("[Research] Failed to update target sources", response.status);
          setTargetSources(previousTargets);
          return;
        }
        const payload = await response.json().catch(() => null);
        const payloadTargets = payload?.priority?.target_sources;
        if (Array.isArray(payloadTargets)) {
          setTargetSources(normalizeTargetSources(payloadTargets));
        }
      } catch (error) {
        console.error("[Research] Unexpected error updating target sources", error);
        setTargetSources(previousTargets);
      }
    },
    [clientId, targetSources]
  );

  return {
    agentResearch,
    agentResearchLoading,
    agentResearchError,
    selectedAgent,
    selectAgentById,
    promptValue,
    isPromptDirty,
    isPromptSaving,
    promptSaveError,
    handlePromptChange,
    handlePromptSave,
    handleClearPrompt,
    handleRemoveSourcedArticle,
    addArticleToAgent,
    setSelectedAgent,
    targetSources,
    toggleTargetSource,
  };
}
