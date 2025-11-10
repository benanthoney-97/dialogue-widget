"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import QuestionnaireModal from "@/app/components/QuestionnaireModal";
import { supabase } from "@/app/lib/supabaseClient";
import QuestionnairePanel from "./QuestionnairePanel";

const QUESTIONNAIRE_STORAGE_BUCKET = "questionnaires";

function decodeStorageFileName(path: string | null): string | null {
  if (!path) return null;
  const segments = path.split("/");
  if (segments.length === 0) return null;
  try {
    const decoded = segments[segments.length - 1];
    return decodeURIComponent(decoded);
  } catch {
    return segments[segments.length - 1] ?? null;
  }
}

function inferMimeTypeFromFilename(fileName: string | null): string | null {
  if (!fileName) return null;
  const lowered = fileName.toLowerCase();
  if (lowered.endsWith(".pdf")) return "application/pdf";
  if (lowered.endsWith(".doc")) return "application/msword";
  if (lowered.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lowered.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lowered.endsWith(".csv")) return "text/csv";
  if (lowered.endsWith(".txt")) return "text/plain";
  return null;
}

export type QuestionnaireExperienceJob = {
  jobId: string | null;
  status: string | null;
  createdAt: string | null;
  filePath: string | null;
  extractionResult: string | null;
};

type QuestionnaireExperienceProps = {
  agentId: string;
  personaName: string;
  personaUpdatedAt?: string | null;
  personaResearchType?: string | null;
  personaOwnerName?: string | null;
  initialJob: QuestionnaireExperienceJob | null;
};

export default function QuestionnaireExperience({
  agentId,
  personaName,
  personaUpdatedAt,
  personaResearchType,
  personaOwnerName,
  initialJob,
}: QuestionnaireExperienceProps) {
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const quantUploadInputRef = useRef<HTMLInputElement | null>(null);

  const [quantFile, setQuantFile] = useState<File | null>(null);
  const [quantFileURL, setQuantFileURL] = useState<string | null>(null);
  const [quantFileName, setQuantFileName] = useState<string | null>(null);
  const [quantFileType, setQuantFileType] = useState<string | null>(null);

  const [questionnaireJobId, setQuestionnaireJobId] = useState<string | null>(initialJob?.jobId ?? null);
  const [questionnaireJobStatus, setQuestionnaireJobStatus] = useState<string | null>(initialJob?.status ?? null);
  const [questionnaireJobError, setQuestionnaireJobError] = useState<string | null>(null);
  const [questionnaireExtractionResult, setQuestionnaireExtractionResult] = useState<string | null>(
    initialJob?.extractionResult ?? null,
  );
  const [lastRunAt, setLastRunAt] = useState<string | null>(initialJob?.createdAt ?? null);

  const [isCreatingQuestionnaireJob, setIsCreatingQuestionnaireJob] = useState(false);
  const [isHydratingQuestionnaireJob, setIsHydratingQuestionnaireJob] = useState(false);

  const resetFileState = useCallback(() => {
    setQuantFile(null);
    setQuantFileName(null);
    setQuantFileType(null);
    setQuantFileURL(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromInitialJob = async () => {
      const jobSnapshot = initialJob;
      if (!jobSnapshot) {
        resetFileState();
        setQuestionnaireJobId(null);
        setQuestionnaireJobStatus(null);
        setQuestionnaireExtractionResult(null);
        setLastRunAt(null);
        return;
      }

      setIsHydratingQuestionnaireJob(true);
      setQuestionnaireJobId(jobSnapshot.jobId ?? null);
  setQuestionnaireJobStatus(jobSnapshot.status ?? null);
  setQuestionnaireExtractionResult(jobSnapshot.extractionResult ?? null);
  setLastRunAt(jobSnapshot.createdAt ?? null);
  setQuestionnaireJobError(null);

      if (!jobSnapshot.filePath) {
        setQuantFileName(null);
        setQuantFileType(null);
        setQuantFileURL(null);
        setIsHydratingQuestionnaireJob(false);
        return;
      }

      const derivedName = decodeStorageFileName(jobSnapshot.filePath) ?? "questionnaire";
      setQuantFileName(derivedName);
      setQuantFileType(inferMimeTypeFromFilename(derivedName));

      try {
        const { data: signedData } = await supabase.storage
          .from(QUESTIONNAIRE_STORAGE_BUCKET)
          .createSignedUrl(jobSnapshot.filePath, 60 * 60);
        let resolvedUrl = signedData?.signedUrl ?? null;
        if (!resolvedUrl) {
          const { data: publicData } = supabase.storage
            .from(QUESTIONNAIRE_STORAGE_BUCKET)
            .getPublicUrl(jobSnapshot.filePath);
          resolvedUrl =
            (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicUrl ??
            (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicURL ??
            null;
        }
        if (!cancelled) {
          setQuantFileURL(resolvedUrl);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[questionnaire] failed to resolve stored questionnaire", error);
        }
      } finally {
        if (!cancelled) {
          setIsHydratingQuestionnaireJob(false);
        }
      }
    };

    hydrateFromInitialJob();

    return () => {
      cancelled = true;
    };
  }, [initialJob, resetFileState]);

  useEffect(() => {
    if (!quantFileURL || !quantFileURL.startsWith("blob:")) {
      return undefined;
    }
    const urlToRevoke = quantFileURL;
    return () => {
      try {
        URL.revokeObjectURL(urlToRevoke);
      } catch {
        // ignore
      }
    };
  }, [quantFileURL]);

  useEffect(() => {
    if (
      !questionnaireJobId ||
      questionnaireJobStatus === "parsed" ||
      questionnaireJobStatus === "failed"
    ) {
      return undefined;
    }

    let isActive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (!isActive) return;
      try {
        const { data, error } = await supabase
          .from("questionnaire_jobs")
          .select("status, extraction_result, created_at, file_path")
          .eq("id", questionnaireJobId)
          .maybeSingle();
        if (error) {
          console.error("[questionnaire] polling failed", error);
        } else if (data) {
          const nextStatus = data.status ?? null;
          if (nextStatus) {
            setQuestionnaireJobStatus(nextStatus);
          }
          if (data.created_at) {
            setLastRunAt(data.created_at);
          }
          if (data.extraction_result !== undefined) {
            const serialized =
              data.extraction_result === null
                ? null
                : typeof data.extraction_result === "string"
                ? data.extraction_result
                : JSON.stringify(data.extraction_result, null, 2);
            setQuestionnaireExtractionResult((prev) => (prev === serialized ? prev : serialized));
          }
          if (nextStatus === "parsed" || nextStatus === "failed") {
            isActive = false;
            if (data.file_path) {
              try {
                const { data: signedData } = await supabase.storage
                  .from(QUESTIONNAIRE_STORAGE_BUCKET)
                  .createSignedUrl(data.file_path, 60 * 60);
                let resolvedUrl = signedData?.signedUrl ?? null;
                if (!resolvedUrl) {
                  const { data: publicData } = supabase.storage
                    .from(QUESTIONNAIRE_STORAGE_BUCKET)
                    .getPublicUrl(data.file_path);
                  resolvedUrl =
                    (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicUrl ??
                    (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicURL ??
                    null;
                }
                if (resolvedUrl) {
                  setQuantFileURL(resolvedUrl);
                  const derivedName = decodeStorageFileName(data.file_path);
                  setQuantFileName(derivedName);
                  setQuantFileType(
                    inferMimeTypeFromFilename(derivedName) ?? inferMimeTypeFromFilename(quantFileName) ?? null,
                  );
                }
              } catch (storageError) {
                console.error("[questionnaire] failed to refresh signed URL", storageError);
              }
            }
            return;
          }
        }
      } catch (error) {
        console.error("[questionnaire] polling unexpected error", error);
      }
      timer = setTimeout(poll, 4000);
    };

    poll();

    return () => {
      isActive = false;
      if (timer) clearTimeout(timer);
    };
  }, [questionnaireJobId, questionnaireJobStatus, quantFileName]);

  const handleQuantUploadClick = () => {
    quantUploadInputRef.current?.click();
  };

  const handleQuantUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (quantFileURL && quantFileURL.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(quantFileURL);
      } catch {
        // ignore
      }
    }
    const objectUrl = URL.createObjectURL(file);
    setQuantFileURL(objectUrl);
    setQuantFileType(file.type || inferMimeTypeFromFilename(file.name));
    setQuantFileName(file.name);
    setQuantFile(file);
    setQuestionnaireJobError(null);
    setQuestionnaireJobStatus(null);
    setQuestionnaireJobId(null);
    setQuestionnaireExtractionResult(null);
    event.currentTarget.value = "";
  };

  const handleRunQuestionnaire = useCallback(async () => {
    if (!quantFile) {
      setQuestionnaireJobError("Upload a questionnaire document first.");
      return;
    }

    setIsCreatingQuestionnaireJob(true);
    setQuestionnaireJobError(null);
    setQuestionnaireJobStatus(null);
    setQuestionnaireJobId(null);
    setQuestionnaireExtractionResult(null);

    try {
      const safeName = quantFile.name
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "");
      const fileName = safeName.length > 0 ? safeName : `questionnaire-${Date.now()}`;
      const newStoragePath = `${agentId}/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(QUESTIONNAIRE_STORAGE_BUCKET)
        .upload(newStoragePath, quantFile, {
          contentType: quantFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error("[questionnaire] upload failed", uploadError);
        setQuestionnaireJobError("Unable to upload questionnaire. Please try again.");
        setIsCreatingQuestionnaireJob(false);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("[questionnaire] failed to read session", sessionError);
      }
      const accessToken = sessionData?.session?.access_token ?? null;
      if (!accessToken) {
        setQuestionnaireJobError("Missing authentication. Please sign in again.");
        setIsCreatingQuestionnaireJob(false);
        return;
      }

      const response = await fetch("/api/questionnaires/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify({
          agent_id: agentId,
          file_path: newStoragePath,
          file_size: quantFile.size,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ error: "Failed to create job." }));
        setQuestionnaireJobError(errorPayload?.error || "Unable to create questionnaire job.");
        setIsCreatingQuestionnaireJob(false);
        return;
      }

      const { job } = (await response.json()) as { job?: { id: string; status: string } };
      if (!job?.id) {
        setQuestionnaireJobError("Unexpected response creating questionnaire job.");
        setIsCreatingQuestionnaireJob(false);
        return;
      }

  setQuestionnaireJobId(job.id);
  setQuestionnaireJobStatus(job.status ?? "queued");
  setLastRunAt(new Date().toISOString());

      setQuantFile(null);
      setQuantFileName(quantFile.name || fileName);
      setQuantFileType(quantFile.type || inferMimeTypeFromFilename(quantFile.name || fileName));

      try {
        const { data: signedData } = await supabase.storage
          .from(QUESTIONNAIRE_STORAGE_BUCKET)
          .createSignedUrl(newStoragePath, 60 * 60);
        let resolvedUrl = signedData?.signedUrl ?? null;
        if (!resolvedUrl) {
          const { data: publicData } = supabase.storage
            .from(QUESTIONNAIRE_STORAGE_BUCKET)
            .getPublicUrl(newStoragePath);
          resolvedUrl =
            (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicUrl ??
            (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicURL ??
            null;
        }
        if (resolvedUrl) {
          setQuantFileURL(resolvedUrl);
        }
      } catch (storageError) {
        console.error("[questionnaire] failed to resolve storage url", storageError);
      }
    } catch (error) {
      console.error("[questionnaire] job creation failed", error);
      setQuestionnaireJobError("Unexpected error creating questionnaire job.");
    } finally {
      setIsCreatingQuestionnaireJob(false);
    }
  }, [agentId, quantFile]);

  const handleStartNewQuestionnaire = useCallback(() => {
    if (quantUploadInputRef.current) {
      quantUploadInputRef.current.value = "";
    }
    resetFileState();
    setQuestionnaireJobError(null);
    setQuestionnaireJobStatus(null);
    setQuestionnaireJobId(null);
    setQuestionnaireExtractionResult(null);
    setLastRunAt(null);
    setIsHydratingQuestionnaireJob(false);
    setIsCreatingQuestionnaireJob(false);
  }, [resetFileState]);

  const isJobInFlight =
    questionnaireJobStatus !== null && questionnaireJobStatus !== "parsed" && questionnaireJobStatus !== "failed";
  const isProcessingQuestionnaire = isCreatingQuestionnaireJob || isJobInFlight;
  const showResultsPanel = Boolean(
    questionnaireJobId || questionnaireJobStatus || questionnaireExtractionResult
  );

  return (
  <div className="persona-questionnaire-experience">
      {showResultsPanel ? (
        <div className="persona-questionnaire-experience__grid">
          <div className="persona-questionnaire-experience__preview">
            <QuestionnaireModal
              expandedCardRef={expandedCardRef}
              quantUploadInputRef={quantUploadInputRef}
              quantFileURL={quantFileURL}
              quantFileName={quantFileName}
              quantFileType={quantFileType}
              hasQuantFile={Boolean(quantFile)}
              isCreatingJob={isCreatingQuestionnaireJob}
              isHydratingJob={isHydratingQuestionnaireJob}
              jobError={questionnaireJobError}
              jobStatus={questionnaireJobStatus}
              jobId={questionnaireJobId}
              extractionResult={questionnaireExtractionResult}
              onUploadClickAction={handleQuantUploadClick}
              onUploadChangeAction={handleQuantUploadChange}
              onRunAction={handleRunQuestionnaire}
              personaName={personaName}
              personaUpdatedAt={personaUpdatedAt ?? undefined}
              personaResearchType={personaResearchType ?? undefined}
              personaOwnerName={personaOwnerName ?? undefined}
              resultsPlacement="external"
            />
          </div>
          <div className="persona-questionnaire-experience__results">
            <QuestionnairePanel
              personaName={personaName}
              questionnaireStatus={questionnaireJobStatus}
              lastRunAt={lastRunAt}
              extractionResult={questionnaireExtractionResult}
              onStartNewQuestionnaire={handleStartNewQuestionnaire}
              isProcessing={isProcessingQuestionnaire}
              jobError={questionnaireJobError}
            />
          </div>
        </div>
      ) : (
        <div className="persona-questionnaire-experience__single">
          <QuestionnaireModal
            expandedCardRef={expandedCardRef}
            quantUploadInputRef={quantUploadInputRef}
            quantFileURL={quantFileURL}
            quantFileName={quantFileName}
            quantFileType={quantFileType}
            hasQuantFile={Boolean(quantFile)}
            isCreatingJob={isCreatingQuestionnaireJob}
            isHydratingJob={isHydratingQuestionnaireJob}
            jobError={questionnaireJobError}
            jobStatus={questionnaireJobStatus}
            jobId={questionnaireJobId}
            extractionResult={questionnaireExtractionResult}
            onUploadClickAction={handleQuantUploadClick}
            onUploadChangeAction={handleQuantUploadChange}
            onRunAction={handleRunQuestionnaire}
            personaName={personaName}
            personaUpdatedAt={personaUpdatedAt ?? undefined}
            personaResearchType={personaResearchType ?? undefined}
            personaOwnerName={personaOwnerName ?? undefined}
            resultsPlacement="inline"
          />
        </div>
      )}
      <style jsx>{`
        .persona-questionnaire-experience {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-height: 0;
          padding-bottom: 32px;
          box-sizing: border-box;
        }
        .persona-questionnaire-experience__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 32px;
          align-items: stretch;
          flex: 1 1 auto;
          min-height: 0;
          height: 100%;
          padding: 0 0 32px;
          box-sizing: border-box;
      overflow: hidden;
        }
        .persona-questionnaire-experience__preview,
        .persona-questionnaire-experience__results {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .persona-questionnaire-experience__single {
          width: 100%;
          padding-top: 24px;
          box-sizing: border-box;
          flex: 1 1 auto;
          min-height: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 1120px) {
          .persona-questionnaire-experience__grid {
            grid-template-columns: 1fr;
            flex: none;
          }
          .persona-questionnaire-experience__results {
            margin-top: 12px;
          }
          .persona-questionnaire-experience__single {
            width: 100%;
            padding-top: 40px;
            flex: none;
            height: auto;
            display: block;
          }
        }
        :global(.persona-modal-option-body-content.persona-modal-option-body-content--quant) {
          display: flex;
          flex-direction: column;
          width: 100%;
          box-sizing: border-box;
          flex: 1 1 auto;
          min-height: 0;
          height: 100%;
        }
        :global(.persona-quant-grid) {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
          width: 100%;
          align-items: stretch;
          height: 100%;
          min-height: 0;
        }
        :global(.persona-quant-grid--preview-only) {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 32px;
        }
        :global(.persona-quant-grid--single) {
          grid-template-columns: minmax(0, 1fr);
        }
        :global(.persona-quant-preview--wide) {
          grid-column: 1 / span 1;
        }
        :global(.persona-quant-preview) {
          position: relative;
          border-radius: 24px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #ffffff;
          min-height: 0;
          overflow: hidden;
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
          height: 100%;
          box-sizing: border-box;
        }
        :global(.persona-quant-preview iframe) {
          border-radius: 24px;
        }
        :global(.persona-quant-preview iframe) {
          width: 100%;
          height: 100%;
          border: none;
        }
        :global(.persona-quant-actions-col) {
          display: flex;
          flex-direction: column;
          gap: 18px;
          align-self: stretch;
          height: 100%;
          justify-content: center;
          align-items: center;
        }
        :global(.persona-quant-actions-row) {
          display: flex;
          flex-direction: row;
          gap: 12px;
          width: 100%;
          justify-content: center;
          align-items: center;
          max-width: 340px;
        }
        :global(.persona-quant-status) {
          font-size: 13px;
          font-weight: 600;
        }
        :global(.persona-quant-status--error) {
          color: #b91c1c;
        }
        :global(.persona-quant-status--success) {
          color: #166534;
        }
        :global(.persona-quant-loading) {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border-radius: 24px;
          border: 1px dashed rgba(15, 23, 42, 0.16);
          background: rgba(248, 250, 252, 0.92);
          padding: 24px;
          min-height: 180px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.7);
        }
        :global(.persona-quant-spinner) {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid rgba(15, 23, 42, 0.18);
          border-top-color: rgba(15, 23, 42, 0.64);
          animation: personaQuantSpin 1s linear infinite;
        }
        :global(@keyframes personaQuantSpin) {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        :global(.persona-quant-results) {
          display: flex;
          flex-direction: column;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #ffffff;
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
          padding: 20px;
          flex: 1 1 auto;
          min-height: 0;
        }
        :global(.persona-quant-results-header) {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        :global(.persona-quant-results-header h4) {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #052033;
        }
        :global(.persona-quant-results-count) {
          font-size: 13px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.54);
        }
        :global(.persona-quant-results-scroll) {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
        }
        :global(.persona-quant-results-list) {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        :global(.persona-quant-results-item) {
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(248, 250, 252, 0.9);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        :global(.persona-quant-results-question) {
          font-weight: 700;
          font-size: 14px;
          color: #052033;
        }
        :global(.persona-quant-results-answer) {
          display: flex;
          gap: 6px;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(15, 23, 42, 0.78);
          word-break: break-word;
        }
        :global(.persona-quant-results-label) {
          font-weight: 600;
          color: rgba(15, 23, 42, 0.54);
          flex-shrink: 0;
        }
        :global(.persona-quant-results-raw) {
          margin: 0;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          background: rgba(15, 23, 42, 0.08);
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 12px;
          padding: 12px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        :global(.persona-quant-results-placeholder) {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 1px dashed rgba(15, 23, 42, 0.16);
          background: rgba(248, 250, 252, 0.78);
          padding: 24px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.6);
        }
        :global(.persona-quant-options-bar) {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        :global(.persona-quant-option-button) {
          border: none;
          background: rgba(15, 23, 42, 0.08);
          color: #052033;
          font-weight: 600;
          font-size: 13px;
          padding: 8px 16px;
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        :global(.persona-quant-option-button:hover),
        :global(.persona-quant-option-button:focus-visible) {
          background: rgba(15, 23, 42, 0.14);
          outline: none;
        }
        :global(.persona-quant-option-button:active) {
          background: rgba(15, 23, 42, 0.2);
        }
        :global(.persona-quant-file-card) {
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(248, 250, 252, 0.9);
          padding: 18px;
        }
        :global(.persona-quant-file-name) {
          font-weight: 700;
          font-size: 14px;
          color: #052033;
          word-break: break-word;
        }
        :global(.persona-quant-download) {
          color: #1d4ed8;
          font-weight: 600;
          font-size: 13px;
          text-decoration: none;
        }
        :global(.persona-quant-action-square) {
          width: 160px;
          height: 160px;
          border-radius: 12px;
          border: 1px dashed rgba(15, 23, 42, 0.18);
          background: rgba(248, 250, 252, 0.85);
          color: #052033;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.18s ease, border-color 0.18s ease;
        }
        :global(.persona-quant-action-square:hover),
        :global(.persona-quant-action-square:focus-visible) {
          border-color: rgba(15, 23, 42, 0.3);
          background: rgba(248, 250, 252, 0.95);
          outline: none;
        }
        :global(.persona-quant-actions) {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 32px;
        }
        :global(.persona-quant-file) {
          font-weight: 600;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.72);
        }
        @media (max-width: 980px) {
          :global(.persona-quant-grid) {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
