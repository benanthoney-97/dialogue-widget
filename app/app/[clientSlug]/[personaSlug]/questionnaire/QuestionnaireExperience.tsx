"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import PillButton from "@/app/components/PillButton";
import QuestionnaireUploadCard from "@/app/components/QuestionnaireUploadCard";
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
    const fileNameLower = (file.name || "").toLowerCase();
    const fileTypeLower = (file.type || "").toLowerCase();
    const isPdf = fileNameLower.endsWith(".pdf") || fileTypeLower.includes("pdf");
    const isCsv = fileNameLower.endsWith(".csv") || fileTypeLower.includes("csv");
    if (!isPdf && !isCsv) {
      setQuestionnaireJobError("Only PDF or CSV files are supported.");
      event.currentTarget.value = "";
      return;
    }
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
  const hasResultsContext = Boolean(questionnaireJobId || questionnaireJobStatus || questionnaireExtractionResult);
  const hasUploadedContext = Boolean(
    quantFile ||
      quantFileName ||
      quantFileURL ||
      questionnaireJobId ||
      questionnaireJobStatus ||
      questionnaireExtractionResult ||
      isHydratingQuestionnaireJob
  );
  const shouldShowCard = !hasResultsContext;

  return (
    <div className="persona-questionnaire-experience">
      {shouldShowCard ? (
        <div className="persona-questionnaire-experience__card">
          {hasUploadedContext ? (
            <QuestionnaireUploadCard
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
          ) : (
            <div className="persona-questionnaire-experience__prompt">
              <PillButton
                type="button"
                onClick={handleQuantUploadClick}
                disabled={isProcessingQuestionnaire}
                style={{
                  padding: "12px 26px",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "transparent",
                  boxShadow: "none",
                  border: "none",
                  color: "#0f172a",
                  cursor: isProcessingQuestionnaire ? "not-allowed" : "pointer",
                }}
              >
                <div className="persona-questionnaire-experience__prompt-tile">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 5V19M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="persona-questionnaire-experience__prompt-title">Upload research questionnaire</span>
                  <span className="persona-questionnaire-experience__prompt-subtitle">PDF or CSV format</span>
                </div>
              </PillButton>
              <input
                ref={quantUploadInputRef}
                type="file"
                accept=".pdf,.csv"
                style={{ display: "none" }}
                onChange={handleQuantUploadChange}
              />
              {questionnaireJobError ? (
                <p className="persona-questionnaire-experience__prompt-error">{questionnaireJobError}</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {hasResultsContext ? (
        <div
          className="persona-questionnaire-experience__panel"
          style={!shouldShowCard ? { marginTop: 0 } : undefined}
        >
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
      ) : null}
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
        .persona-questionnaire-experience__card {
          width: 100%;
          padding: 24px 0;
          box-sizing: border-box;
        }
        .persona-questionnaire-experience__panel {
          width: 100%;
          margin-top: 24px;
        }
        .persona-questionnaire-experience__prompt {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 40px 20px;
          text-align: center;
        }
        .persona-questionnaire-experience__prompt-tile {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 160px;
          height: 160px;
          border-radius: 12px;
          color: #0f172a;
        }
        .persona-questionnaire-experience__prompt-title {
          color: #0f172a;
          font-weight: 700;
          font-size: 15px;
        }
        .persona-questionnaire-experience__prompt-subtitle {
          color: #475569;
          font-size: 12px;
        }
        .persona-questionnaire-experience__prompt-error {
          color: #b91c1c;
          font-weight: 600;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
