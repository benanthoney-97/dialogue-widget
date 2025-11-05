"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QuestionnaireResults, { QuestionnaireEntry, parseQuestionnaireResponses } from "@/app/components/QuestionnaireResults";
import FullscreenModal from "@/app/components/FullscreenModal";
import QuestionnaireCompareModal from "@/app/components/QuestionnaireCompareModal";
import { jsPDF } from "jspdf";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import { supabase } from "../../../lib/supabaseClient";
import { COOPER_FONT_NAME, ensureCooperFont } from "@/app/lib/pdfFonts";

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

type PersonaRow = {
  agent_id: string;
  agent_name: string | null;
  content_type: string | null;
  audience_type: string | null;
};

type StagePanelProps = {
  heading: string;
  subheading?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function StagePanel({ heading, subheading, leading, trailing, footer, children }: StagePanelProps) {
  const hasHeader = Boolean(heading || subheading || leading || trailing);
  return (
    <section className="stage-panel">
      {hasHeader && (
        <header className="stage-panel__header">
          {leading ? <div className="stage-panel__leading">{leading}</div> : <div className="stage-panel__spacer" aria-hidden="true" />}
          <div className="stage-panel__titles">
            <h2>{heading}</h2>
            {subheading ? <p>{subheading}</p> : null}
          </div>
          {trailing ? <div className="stage-panel__trailing">{trailing}</div> : <div className="stage-panel__spacer" aria-hidden="true" />}
        </header>
      )}
      <div className="stage-panel__body">{children}</div>
      {footer ? <footer className="stage-panel__footer">{footer}</footer> : null}
    </section>
  );
}

type StageButtonVariant = "primary" | "secondary" | "ghost";

type StageButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: StageButtonVariant;
  width?: "auto" | "full";
};

function StageButton({ variant = "primary", width = "auto", className = "", ...props }: StageButtonProps) {
  const classes = [
    "stage-button",
    `stage-button--${variant}`,
    width === "full" ? "stage-button--full" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={`${classes} ${className}`.trim()} {...props} />;
}

type BatchStage = "select" | "upload" | "monitor";

type BatchJobMeta = {
  id: string;
  status: string;
  questionnaire_file_url: string;
  questionnaire_file_name: string | null;
  questionnaire_file_type: string | null;
  questionnaire_file_size: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

type BatchPersonaStatus = {
  id: string;
  agent_id: string;
  agent_name: string | null;
  status: string;
  error_message: string | null;
  dialogue_id: string | null;
  dialogue?: {
    research_type: string | null;
    transcript_summary: string | null;
    transcript?: unknown;
  } | null;
  created_at: string | null;
  updated_at: string | null;
};

const TERMINAL_PERSONA_STATUSES = new Set(["parsed", "failed"]);
const TERMINAL_BATCH_STATUSES = new Set(["complete", "failed"]);

type BatchJobHydrationRow = {
  id: string;
  status: string | null;
  questionnaire_file_url: string | null;
  questionnaire_file_name: string | null;
  questionnaire_file_type: string | null;
  questionnaire_file_size: number | string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

function makeSafeFilename(input: string): string {
  const base = input.trim().replace(/\.[^/.]+$/, "");
  const safe = base.replace(/[^a-z0-9]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return safe || "persona";
}

export default function BatchPage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(() => new Set());
  const [stage, setStage] = useState<BatchStage>("select");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadFileURL, setUploadFileURL] = useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = useState<string | null>(null);
  const [uploadFileSize, setUploadFileSize] = useState<number | null>(null);
  const [uploadFileDataUrl, setUploadFileDataUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [batchJobMeta, setBatchJobMeta] = useState<BatchJobMeta | null>(null);
  const [batchPersonasStatus, setBatchPersonasStatus] = useState<BatchPersonaStatus[]>([]);
  const [batchStatusError, setBatchStatusError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);
  const batchJobMetaRef = useRef<BatchJobMeta | null>(null);
  const batchPersonasStatusRef = useRef<BatchPersonaStatus[]>([]);
  const [openPersonaId, setOpenPersonaId] = useState<string | null>(null);
  const [exportingPersonaId, setExportingPersonaId] = useState<string | null>(null);
  const [isExportingBatch, setIsExportingBatch] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareInitialPersonaId, setCompareInitialPersonaId] = useState<string | null>(null);
  const contentAnchorRef = useRef<HTMLDivElement | null>(null);
  const [isHydratingBatchJob, setIsHydratingBatchJob] = useState(false);
  const dismissedBatchJobIdRef = useRef<string | null>(null);

  const stopBatchPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const updateBatchJobMeta = useCallback((meta: BatchJobMeta | null) => {
    batchJobMetaRef.current = meta;
    setBatchJobMeta(meta);
  }, []);

  const updateBatchPersonasStatus = useCallback(
    (list: BatchPersonaStatus[]) => {
      batchPersonasStatusRef.current = list;
      setBatchPersonasStatus(list);
      if (openPersonaId && !list.some((persona) => persona.id === openPersonaId)) {
        setOpenPersonaId(null);
      }
    },
    [openPersonaId],
  );

  const resetBatchState = useCallback(() => {
    stopBatchPolling();
    updateBatchJobMeta(null);
    updateBatchPersonasStatus([]);
    setBatchStatusError(null);
    setOpenPersonaId(null);
  }, [stopBatchPolling, updateBatchJobMeta, updateBatchPersonasStatus]);

  const currentStep = stage === "select" ? 1 : stage === "upload" ? 2 : 3;
  const totalSteps = 3;
  const formatStatus = (status: string | null | undefined) => {
    if (!status) return "Pending";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };
  const batchTotalCount = batchPersonasStatus.length;
  const completedCount = batchPersonasStatus.filter((persona) =>
    TERMINAL_PERSONA_STATUSES.has((persona.status ?? "").toLowerCase()),
  ).length;
  const inProgressCount = batchTotalCount - completedCount;
  const batchStatusLabel = formatStatus(batchJobMeta?.status);
  const batchFinished =
    batchJobMeta?.status && TERMINAL_BATCH_STATUSES.has(batchJobMeta.status.toLowerCase());
  const exportablePersonas = useMemo(
    () =>
      batchPersonasStatus.filter(
        (persona) =>
          TERMINAL_PERSONA_STATUSES.has((persona.status ?? "").toLowerCase()) &&
          persona.dialogue &&
          persona.dialogue.transcript,
      ),
    [batchPersonasStatus],
  );
  const comparablePersonasForModal = useMemo(
    () =>
      batchPersonasStatus
        .filter(
          (persona) =>
            persona.dialogue?.transcript &&
            TERMINAL_PERSONA_STATUSES.has((persona.status ?? "").toLowerCase()),
        )
        .map((persona) => {
          const base = personas.find((entry) => entry.agent_id === persona.agent_id);
          return {
            id: persona.id,
            name: persona.agent_name || base?.agent_name || "Untitled persona",
            status: persona.status ? formatStatus(persona.status) : null,
            audience: base?.audience_type ?? null,
            updatedAt: persona.updated_at,
            transcript: persona.dialogue?.transcript ?? null,
          };
        }),
    [batchPersonasStatus, personas],
  );
  const exportPersonasToPdf = useCallback(
    async (personasList: BatchPersonaStatus[], filename: string) => {
      if (!personasList.length) return;

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const cooperLoaded = await ensureCooperFont(doc);
      const textFont = cooperLoaded ? COOPER_FONT_NAME : "helvetica";
      const monoFont = "courier";
      const titleFontSize = cooperLoaded ? 26 : 18;
      const sectionTitleSize = cooperLoaded ? 15 : 13;
      const bodyFontSize = cooperLoaded ? 12 : 11;
      const pageBottomOffset = 60;

      const renderPersona = (persona: BatchPersonaStatus) => {
        let cursorY = 48;
        const personaTitle = persona.agent_name || persona.agent_id || "Untitled persona";

        const drawPageFrame = (_isFirstPage: boolean) => {
          doc.setFillColor(30, 41, 59);
          doc.rect(0, 0, doc.internal.pageSize.getWidth(), 60, "F");
          doc.setFont(textFont, "normal");
          doc.setTextColor(246, 247, 249);
          doc.setFontSize(titleFontSize);
          doc.text(`Questionnaire - ${personaTitle}`, 40, 40);
          doc.setFontSize(12);
          doc.text("powered by Dialogue", doc.internal.pageSize.getWidth() - 40, 40, { align: "right" });
          doc.setDrawColor(230, 235, 243);
          doc.setFillColor(246, 247, 249);
          doc.roundedRect(
            30,
            70,
            doc.internal.pageSize.getWidth() - 60,
            doc.internal.pageSize.getHeight() - 100,
            12,
            12,
            "FD",
          );
          doc.setTextColor(5, 32, 51);
          cursorY = 82;
        };

        const addSectionHeading = (title: string) => {
          doc.setFont(textFont, "normal");
          doc.setFontSize(sectionTitleSize);
          cursorY += 20;
          doc.text(title, 40, cursorY);
        };

        const addSection = (title: string, text: string | string[] | undefined, isMono = false) => {
          if (!text) return;
          addSectionHeading(title);
          doc.setFont(isMono ? monoFont : textFont, "normal");
          doc.setFontSize(isMono ? 10 : bodyFontSize);
          const safeText = Array.isArray(text) ? text.join("\n") : text;
          const wrapped = doc.splitTextToSize(safeText, 512) as string[];
          wrapped.forEach((line) => {
            if (cursorY > doc.internal.pageSize.getHeight() - pageBottomOffset) {
              doc.addPage();
              drawPageFrame(false);
              addSectionHeading(`${title} (continued)`);
              doc.setFont(isMono ? monoFont : textFont, "normal");
              doc.setFontSize(isMono ? 10 : bodyFontSize);
            }
            cursorY += 18;
            doc.text(line, 40, cursorY);
          });
        };

        const addSummarySection = (summary: string | undefined) => {
          if (!summary) return;
          const panelLeft = 40;
          const panelRight = doc.internal.pageSize.getWidth() - 40;
          const blockWidth = panelRight - panelLeft;
          const paddingX = 16;
          const paddingY = 12;
          const lineHeight = bodyFontSize + 4;
          const panelBottomMargin = pageBottomOffset;
          let remaining = doc.splitTextToSize(summary, blockWidth - paddingX * 2) as string[];
          let headingLabel = "Summary";
          const ensureSpace = () => {
            const minNeeded = 20 + paddingY * 2 + lineHeight + 12;
            const pageBottom = doc.internal.pageSize.getHeight() - panelBottomMargin;
            if (cursorY + minNeeded > pageBottom) {
              doc.addPage();
              drawPageFrame(false);
            }
          };
          while (remaining.length) {
            ensureSpace();
            addSectionHeading(headingLabel);
            const pageBottom = doc.internal.pageSize.getHeight() - panelBottomMargin;
            let availableHeight = pageBottom - (cursorY + paddingY + 12);
            if (availableHeight < lineHeight + paddingY * 2) {
              doc.addPage();
              drawPageFrame(false);
              headingLabel = headingLabel === "Summary" ? "Summary (continued)" : headingLabel;
              addSectionHeading(headingLabel);
              availableHeight =
                doc.internal.pageSize.getHeight() - panelBottomMargin - (cursorY + paddingY + 12);
            }
            const maxLines = Math.max(1, Math.floor((availableHeight - paddingY * 2) / lineHeight));
            const linesForPage = remaining.splice(0, maxLines);
            const blockHeight = linesForPage.length * lineHeight + paddingY * 2;
            const blockX = panelLeft;
            const blockY = cursorY + 12;
            doc.setFillColor(232, 237, 245);
            doc.setDrawColor(200, 210, 222);
            doc.roundedRect(blockX, blockY, blockWidth, blockHeight, 10, 10, "F");
            doc.setFont(textFont, "normal");
            doc.setFontSize(bodyFontSize);
            doc.setTextColor(5, 32, 51);
            let textY = blockY + paddingY + bodyFontSize;
            const textX = blockX + paddingX;
            linesForPage.forEach((line) => {
              doc.text(line, textX, textY);
              textY += lineHeight;
            });
            cursorY = blockY + blockHeight;
            doc.setDrawColor(230, 235, 243);
            if (remaining.length) {
              doc.addPage();
              drawPageFrame(false);
              headingLabel = "Summary (continued)";
            }
          }
          doc.setTextColor(5, 32, 51);
        };

        const addQuestionnaireSection = (questions: QuestionnaireEntry[]) => {
          if (!questions.length) return;

          addSectionHeading("Questionnaire Results");
          cursorY += 12;

          const panelLeft = 40;
          const panelRight = doc.internal.pageSize.getWidth() - 40;
          const blockWidth = panelRight - panelLeft;
          const paddingX = 16;
          const paddingY = 14;
          const lineHeight = bodyFontSize + 4;
          const labelFontSize = Math.max(bodyFontSize - 1, 10);
          const detailSpacing = 12;
          const pageBottom = doc.internal.pageSize.getHeight() - pageBottomOffset;
          const contentWidth = blockWidth - paddingX * 2;
          const labelClampWidth = contentWidth * 0.45;

          questions.forEach((entry, index) => {
            const questionNumber = index + 1;
            const questionText = entry.question
              ? `Q${questionNumber}. ${entry.question}`
              : `Question ${questionNumber}`;
            const questionLines = doc.splitTextToSize(questionText, contentWidth) as string[];

            const detailPairs: Array<{ label: string; value: string }> = [];
            const responseValue = entry.response ?? entry.selected_option ?? "—";
            detailPairs.push({ label: "Response", value: String(responseValue) });
            if (entry.free_text) {
              detailPairs.push({ label: "Free text", value: entry.free_text });
            }
            if (entry.confidence !== undefined && entry.confidence !== null) {
              const confidenceValue =
                typeof entry.confidence === "number"
                  ? entry.confidence.toFixed(2)
                  : String(entry.confidence);
              detailPairs.push({ label: "Confidence", value: confidenceValue });
            }

            const measuredDetails = detailPairs.map((pair) => {
              const labelText = `${pair.label}:`;
              const rawLabelWidth = doc.getTextWidth(labelText) + 6;
              const labelWidth = Math.min(rawLabelWidth, labelClampWidth);
              const valueWidth = Math.max(24, contentWidth - labelWidth);
              const valueLines = doc.splitTextToSize(pair.value, valueWidth) as string[];
              if (!valueLines.length) {
                valueLines.push("—");
              }
              return { labelText, labelWidth, valueLines };
            });

            let blockHeight = paddingY * 2;
            blockHeight += questionLines.length * lineHeight;
            if (measuredDetails.length) {
              measuredDetails.forEach((detail) => {
                blockHeight += detailSpacing;
                blockHeight += detail.valueLines.length * lineHeight;
              });
            } else {
              blockHeight += lineHeight;
            }

            const blockGap = index === 0 ? 20 : 18;
            if (cursorY + blockGap + blockHeight > pageBottom) {
              doc.addPage();
              drawPageFrame(false);
              addSectionHeading("Questionnaire Results (continued)");
              cursorY += 12;
            }

            cursorY += blockGap;
            const blockY = cursorY;
            doc.setFillColor(30, 41, 59);
            doc.setDrawColor(59, 130, 246);
            doc.roundedRect(panelLeft, blockY, blockWidth, blockHeight, 12, 12, "F");

            let textY = blockY + paddingY + bodyFontSize;
            const textX = panelLeft + paddingX;

            doc.setFont(textFont, "normal");
            doc.setFontSize(bodyFontSize + 1);
            doc.setTextColor(191, 219, 254);
            questionLines.forEach((line) => {
              doc.text(line, textX, textY);
              textY += lineHeight;
            });

            doc.setFont(textFont, "normal");
            doc.setFontSize(bodyFontSize);
            doc.setTextColor(241, 245, 249);

            measuredDetails.forEach((detail) => {
              textY += detailSpacing;

              doc.setFont(textFont, "normal");
              doc.setFontSize(labelFontSize);
              doc.setTextColor(148, 163, 184);
              doc.text(detail.labelText, textX, textY);

              doc.setFont(textFont, "normal");
              doc.setFontSize(bodyFontSize);
              doc.setTextColor(241, 245, 249);
              doc.text(detail.valueLines[0], textX + detail.labelWidth, textY);
              for (let i = 1; i < detail.valueLines.length; i++) {
                textY += lineHeight;
                doc.text(detail.valueLines[i], textX + detail.labelWidth, textY);
              }
            });

            cursorY = blockY + blockHeight;
            doc.setTextColor(5, 32, 51);
            doc.setFont(textFont, "normal");
            doc.setFontSize(bodyFontSize);
            doc.setDrawColor(230, 235, 243);
            doc.setFillColor(246, 247, 249);
          });

          cursorY += 12;
          doc.setTextColor(5, 32, 51);
        };

        drawPageFrame(true);

        const updatedAt = persona.updated_at
          ? new Date(persona.updated_at).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : "";

        const detailsLines = [
          `Persona: ${persona.agent_name || persona.agent_id || "—"}`,
          `Status: ${formatStatus(persona.status)}`,
        ];
        if (updatedAt) {
          detailsLines.push(`Updated: ${updatedAt}`);
        }
        if (persona.dialogue_id) {
          detailsLines.push(`Dialogue ID: ${persona.dialogue_id}`);
        }
        if (persona.dialogue?.research_type) {
          detailsLines.push(`Research Type: ${persona.dialogue.research_type}`);
        }

        addSection("Details", detailsLines.join("\n"));

        if (persona.dialogue?.transcript_summary) {
          cursorY += 20;
          addSummarySection(persona.dialogue.transcript_summary);
          cursorY += 24;
        }

        const parsed = parseQuestionnaireResponses(persona.dialogue?.transcript ?? null);
        const questions = parsed?.questions ?? [];

        if (questions.length) {
          cursorY += 24;
          addQuestionnaireSection(questions);
        } else {
          const rawContent =
            typeof persona.dialogue?.transcript === "string"
              ? persona.dialogue?.transcript
              : persona.dialogue?.transcript
              ? JSON.stringify(persona.dialogue?.transcript, null, 2)
              : null;
          if (rawContent) {
            addSection("Responses", rawContent, true);
          } else {
            addSection("Responses", "No questionnaire responses captured yet.");
          }
        }
      };

      personasList.forEach((persona, index) => {
        if (index > 0) {
          doc.addPage();
        }
        renderPersona(persona);
      });

      const outputName = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
      doc.save(outputName);
    },
    [formatStatus],
  );
  const handleExportPersona = useCallback(
    async (persona: BatchPersonaStatus) => {
      if (exportingPersonaId || !persona.dialogue?.transcript) return;
      setExportingPersonaId(persona.id);
      try {
        const personaLabel = persona.agent_name || persona.agent_id || "persona";
        const safeName = `${makeSafeFilename(personaLabel)}-questionnaire`;
        await exportPersonasToPdf([persona], safeName);
      } catch (error) {
        console.error("[batch] persona export failed", error);
      } finally {
        setExportingPersonaId(null);
      }
    },
    [exportPersonasToPdf, exportingPersonaId],
  );
  const handleExportBatch = useCallback(async () => {
    if (isExportingBatch || exportablePersonas.length === 0) return;
    setIsExportingBatch(true);
    try {
      const personaCountLabel = `${exportablePersonas.length} Personas`;
      const formattedDate = new Date().toISOString().slice(0, 10);
      const baseLabel = ["Group Questionnaire", personaCountLabel, formattedDate].join(" - ");
      const safeName = makeSafeFilename(baseLabel);
      await exportPersonasToPdf(exportablePersonas, safeName);
    } catch (error) {
      console.error("[batch] batch export failed", error);
    } finally {
      setIsExportingBatch(false);
    }
  }, [batchJobMeta?.questionnaire_file_name, exportPersonasToPdf, exportablePersonas, isExportingBatch]);
  const handleOpenCompare = useCallback(
    (personaId?: string | null) => {
      if (comparablePersonasForModal.length === 0) return;
      const validInitial =
        personaId && comparablePersonasForModal.some((persona) => persona.id === personaId)
          ? personaId
          : comparablePersonasForModal[0]?.id ?? null;
      setCompareInitialPersonaId(validInitial);
      setIsCompareOpen(true);
    },
    [comparablePersonasForModal],
  );
  const handleCloseCompare = useCallback(() => {
    setIsCompareOpen(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfileRole() {
      if (!clientSlug) {
        if (!isMounted) return;
        setProfileRole(null);
        setProfileLoadError("Workspace not found");
        setProfileReady(true);
        return;
      }
      if (isMounted) {
        setProfileReady(false);
        setProfileLoadError(null);
      }
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (userError) {
          setProfileRole(null);
          setProfileLoadError(userError.message ?? "Unable to load session");
          return;
        }
        const user = userData?.user;
        if (!user) {
          setProfileRole(null);
          setProfileLoadError("You must be signed in");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, client_id")
          .eq("id", user.id)
          .maybeSingle();
        if (!isMounted) return;
        if (profileError || !profile) {
          setProfileRole(null);
          setProfileLoadError(profileError?.message ?? "Profile not found");
          return;
        }
        if (profile.client_id !== clientSlug) {
          setProfileRole(null);
          setProfileLoadError("This workspace is unavailable");
          return;
        }
        setProfileRole(typeof profile.role === "string" ? profile.role : null);
        setProfileLoadError(null);
      } catch (error) {
        if (!isMounted) return;
        setProfileRole(null);
        setProfileLoadError(error instanceof Error ? error.message : "Failed to load profile");
      } finally {
        if (isMounted) {
          setProfileReady(true);
        }
      }
    }

    void fetchProfileRole();

    return () => {
      isMounted = false;
    };
  }, [clientSlug]);

  useEffect(() => {
    async function fetchPersonas() {
      if (!clientSlug) {
        setError("Workspace not found");
        setPersonas([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id")
          .eq("id", clientSlug)
          .maybeSingle<{ id: string }>();
        if (clientError) {
          setError("Unable to load workspace");
          setPersonas([]);
          return;
        }
        if (!client) {
          setError("Workspace not found");
          setPersonas([]);
          return;
        }
        const { data, error: personaError } = await supabase
          .from("agent_map")
          .select("agent_id, agent_name, audience_type, content_type")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false });
        if (personaError) {
          setError("Unable to load personas");
          setPersonas([]);
          return;
        }
        setPersonas((data ?? []).filter((row): row is PersonaRow => Boolean(row.agent_id)));
      } finally {
        setLoading(false);
      }
    }
    fetchPersonas();
  }, [clientSlug]);

  useEffect(() => {
    return () => {
      if (uploadFileURL) {
        try {
          URL.revokeObjectURL(uploadFileURL);
        } catch {
          // ignore
        }
      }
    };
  }, [uploadFileURL]);

  useEffect(() => {
    if (!clientSlug) {
      return;
    }
    if (stage !== "select") {
      return;
    }

    let isCancelled = false;

    const hydrateLatestBatchJob = async () => {
      setIsHydratingBatchJob(true);
      try {
        const { data, error } = await supabase
          .from("batch_jobs")
          .select(
            [
              "id",
              "status",
              "questionnaire_file_url",
              "questionnaire_file_name",
              "questionnaire_file_type",
              "questionnaire_file_size",
              "created_at",
              "started_at",
              "completed_at",
            ].join(","),
          )
          .eq("client_id", clientSlug)
          .order("created_at", { ascending: false })
          .limit(1);

        if (isCancelled) {
          return;
        }

        if (error) {
          console.error("[batch] failed to hydrate latest batch job", error);
          return;
        }

        const batchRows = (data as unknown as BatchJobHydrationRow[] | null) ?? null;
        const latestJob = batchRows && batchRows.length > 0 ? batchRows[0] : null;
        if (!latestJob || typeof latestJob.id !== "string") {
          return;
        }

        const latestJobId = latestJob.id;
        const statusValue =
          typeof latestJob.status === "string" ? latestJob.status.toLowerCase() : "pending";
        const jobIsTerminal = TERMINAL_BATCH_STATUSES.has(statusValue);
        if (jobIsTerminal && dismissedBatchJobIdRef.current === latestJobId) {
          return;
        }

        dismissedBatchJobIdRef.current = null;

        const rawSize = latestJob.questionnaire_file_size;
        let normalizedSize: number | null = null;
        if (typeof rawSize === "number") {
          normalizedSize = Number.isFinite(rawSize) ? rawSize : null;
        } else if (typeof rawSize === "string") {
          const parsedSize = Number(rawSize);
          normalizedSize = Number.isFinite(parsedSize) ? parsedSize : null;
        }

        updateBatchJobMeta({
          id: latestJobId,
          status: typeof latestJob.status === "string" ? latestJob.status : "pending",
          questionnaire_file_url:
            typeof latestJob.questionnaire_file_url === "string"
              ? latestJob.questionnaire_file_url
              : "",
          questionnaire_file_name:
            typeof latestJob.questionnaire_file_name === "string"
              ? latestJob.questionnaire_file_name
              : null,
          questionnaire_file_type:
            typeof latestJob.questionnaire_file_type === "string"
              ? latestJob.questionnaire_file_type
              : null,
          questionnaire_file_size: normalizedSize,
          created_at: typeof latestJob.created_at === "string" ? latestJob.created_at : null,
          started_at: typeof latestJob.started_at === "string" ? latestJob.started_at : null,
          completed_at: typeof latestJob.completed_at === "string" ? latestJob.completed_at : null,
        });
        updateBatchPersonasStatus([]);
        setBatchStatusError(null);
        setSelectedPersonaIds(new Set<string>());
        setStage("monitor");
      } catch (error) {
        if (!isCancelled) {
          console.error("[batch] unexpected hydration error", error);
        }
      } finally {
        if (!isCancelled) {
          setIsHydratingBatchJob(false);
        }
      }
    };

    void hydrateLatestBatchJob();

    return () => {
      isCancelled = true;
    };
  }, [clientSlug, stage, updateBatchJobMeta, updateBatchPersonasStatus]);

  const canCreateGroups = profileReady && !profileLoadError && profileRole !== "viewer";

  const handleTogglePersona = (personaId: string) => {
    if (!canCreateGroups) return;
    setSelectedPersonaIds((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) {
        next.delete(personaId);
      } else {
        next.add(personaId);
      }
      return next;
    });
  };

  const selectedCount = selectedPersonaIds.size;
  const selectedPersonas = useMemo(
    () => personas.filter((persona) => selectedPersonaIds.has(persona.agent_id)),
    [personas, selectedPersonaIds]
  );

  const handleContinueToUpload = () => {
    if (!canCreateGroups) return;
    if (selectedCount === 0) return;
    setUploadError(null);
    setStage("upload");
  };

  const handleBackToSelect = () => {
    const previousJobId = batchJobMetaRef.current?.id ?? null;
    if (previousJobId) {
      dismissedBatchJobIdRef.current = previousJobId;
    }
    resetBatchState();
    clearUploadFile();
    setSelectedPersonaIds(new Set<string>());
    setStage("select");
  };

  const handlePickUploadFile = () => {
    if (!canCreateGroups) return;
    uploadInputRef.current?.click();
  };

  const clearUploadFile = () => {
    if (uploadFileURL) {
      try {
        URL.revokeObjectURL(uploadFileURL);
      } catch {
        // ignore
      }
    }
    setUploadFileName(null);
    setUploadFileType(null);
    setUploadFileURL(null);
    setUploadFileSize(null);
    setUploadFileDataUrl(null);
    setUploadError(null);
  };

  const handleUploadFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    clearUploadFile();
    const objectUrl = URL.createObjectURL(file);
    setUploadFileName(file.name);
    setUploadFileType(file.type || null);
    setUploadFileURL(objectUrl);
    setUploadFileSize(file.size ?? null);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadFileDataUrl(reader.result);
      } else {
        setUploadFileDataUrl(null);
        setUploadError("Unable to read questionnaire file. Please try another file.");
      }
    };
    reader.onerror = () => {
      setUploadFileDataUrl(null);
      setUploadError("Unable to read questionnaire file. Please try again.");
    };
    reader.readAsDataURL(file);

    event.target.value = "";
  };

  const handleLaunchBatch = async () => {
    if (!canCreateGroups) {
      setUploadError("You don't have permission to launch a batch run.");
      return;
    }
    if (!uploadFileDataUrl || !uploadFileName) {
      setUploadError("Upload a questionnaire before launching the batch run.");
      return;
    }
    setIsLaunching(true);
    setUploadError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("[batch] failed to fetch session", sessionError);
      }
      const accessToken = sessionData?.session?.access_token ?? null;
      if (!accessToken) {
        setUploadError("Missing authentication. Please sign in again.");
        return;
      }

      const response = await fetch("/api/questionnaires/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify({
          persona_ids: Array.from(selectedPersonaIds),
          questionnaire: {
            file_name: uploadFileName,
            file_type: uploadFileType,
            file_size: uploadFileSize,
            data_url: uploadFileDataUrl,
          },
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ error: "Failed to launch batch." }));
        setUploadError(errorPayload?.error || "Unable to launch batch run.");
        return;
      }

      const payload = (await response.json()) as {
        batch_job?: BatchJobMeta;
        personas?: Array<{ id: string; agent_id: string; status: string }>;
      };

      if (!payload?.batch_job?.id) {
        setUploadError("Unexpected response launching batch.");
        return;
      }

      stopBatchPolling();
      updateBatchJobMeta(payload.batch_job);
      updateBatchPersonasStatus(
        (payload.personas ?? []).map((item) => ({
          id: item.id,
          agent_id: item.agent_id,
          agent_name: personas.find((persona) => persona.agent_id === item.agent_id)?.agent_name ?? null,
          status: item.status,
          error_message: null,
          dialogue_id: null,
          dialogue: null,
          created_at: null,
          updated_at: null,
        })),
      );
      setBatchStatusError(null);
      clearUploadFile();
      dismissedBatchJobIdRef.current = null;
      setStage("monitor");
    } finally {
      setIsLaunching(false);
    }
  };

    useEffect(() => {
      if (stage === "upload" && !canCreateGroups) {
        setStage("select");
      }
    }, [stage, canCreateGroups]);

    useEffect(() => {
      if (!canCreateGroups && selectedPersonaIds.size > 0) {
        setSelectedPersonaIds(new Set<string>());
      }
    }, [canCreateGroups, selectedPersonaIds]);
  useEffect(() => {
    const batchId = batchJobMeta?.id ?? null;
    if (stage !== "monitor" || !batchId) {
      stopBatchPolling();
      return;
    }

    let isCancelled = false;
    let isFetching = false;

    const fetchStatus = async () => {
      if (isCancelled || isFetching) return;
      isFetching = true;
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("[batch] failed to fetch session during polling", sessionError);
        }
        const accessToken = sessionData?.session?.access_token ?? null;
        if (!accessToken) {
          setBatchStatusError("Missing authentication. Please sign in again.");
          stopBatchPolling();
          return;
        }

        const response = await fetch(`/api/questionnaires/batch/${batchId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Failed to fetch batch status." }));
          setBatchStatusError(payload?.error || "Unable to refresh batch status.");
          return;
        }

        const payload = (await response.json()) as {
          batch_job?: BatchJobMeta;
          personas?: BatchPersonaStatus[];
        };

        if (payload.batch_job) {
          updateBatchJobMeta(payload.batch_job);
        }

        if (payload.personas) {
          updateBatchPersonasStatus(
            payload.personas.map((persona) => ({
              ...persona,
              agent_name:
                persona.agent_name ??
                personas.find((entry) => entry.agent_id === persona.agent_id)?.agent_name ??
                null,
            })),
          );
        }
        setBatchStatusError(null);

        const jobStatus = (
          payload.batch_job?.status ?? batchJobMetaRef.current?.status ?? ""
        ).toLowerCase();
        const allPersonasTerminal =
          (payload.personas ?? batchPersonasStatusRef.current).length > 0 &&
          (payload.personas ?? batchPersonasStatusRef.current).every((persona) =>
            TERMINAL_PERSONA_STATUSES.has((persona.status ?? "").toLowerCase()),
          );

        if (
          TERMINAL_BATCH_STATUSES.has(jobStatus) &&
          allPersonasTerminal
        ) {
          stopBatchPolling();
        }
      } catch (error) {
        console.error("[batch] polling failed", error);
        setBatchStatusError("Unexpected error while refreshing batch status.");
      } finally {
        isFetching = false;
      }
    };

    fetchStatus();
    stopBatchPolling();
    pollingRef.current = window.setInterval(fetchStatus, 4000);

    return () => {
      isCancelled = true;
      stopBatchPolling();
    };
  }, [batchJobMeta?.id, personas, stage, stopBatchPolling, updateBatchJobMeta, updateBatchPersonasStatus]);

  return (
    <main className="stage-layout batch-root">
      <aside className="stage-layout__sidebar">
        <Sidebar />
      </aside>
      <div className="stage-layout__content" ref={contentAnchorRef}>
        <div className="stage-shell">
          <StagePanel
            heading="Persona groups"
            subheading={
              !profileReady
                ? "Checking your permissions…"
                : profileLoadError
                  ? profileLoadError
                  : !canCreateGroups
                    ? "You can browse persona groups, but only admins can create new ones."
                    : stage === "select"
                      ? isHydratingBatchJob
                        ? "Loading your latest batch questionnaire run…"
                        : "Group multiple personas and launch a shared questionnaire run."
                      : stage === "upload"
                        ? "Upload a questionnaire to run across your selected personas."
                        : "Monitor the questionnaire run across your persona group."
            }
            leading={
              <div className="batch-step-indicator">
                <span>Step {currentStep} of {totalSteps}</span>
              </div>
            }
            trailing={
              <div className="batch-panel-actions">
                {stage === "upload" ? (
                  <>
                    <StageButton
                      type="button"
                      variant="ghost"
                      onClick={handleBackToSelect}
                      disabled={isLaunching}
                    >
                      Back
                    </StageButton>
                    <StageButton
                      type="button"
                      variant="primary"
                      onClick={handleLaunchBatch}
                      disabled={!profileReady || !canCreateGroups || !uploadFileURL || !uploadFileDataUrl || isLaunching}
                    >
                      {!profileReady
                        ? "Checking access…"
                        : !canCreateGroups
                        ? "View only access"
                      : isLaunching
                        ? "Launching…"
                        : `Launch batch (${selectedCount})`}
                    </StageButton>
                  </>
                ) : stage === "monitor" ? (
                  <>
                    <StageButton
                      type="button"
                      variant="ghost"
                      onClick={handleBackToSelect}
                      disabled={inProgressCount > 0 && !batchFinished}
                    >
                      Start new batch
                    </StageButton>
                  </>
                ) : (
                  <StageButton
                    type="button"
                    variant="primary"
                    disabled={!profileReady || !canCreateGroups || selectedCount === 0 || isHydratingBatchJob}
                    onClick={handleContinueToUpload}
                  >
                    {!profileReady
                      ? "Checking access…"
                      : !canCreateGroups
                      ? "View only access"
                      : selectedCount === 0
                        ? "Select personas"
                        : `Continue (${selectedCount})`}
                  </StageButton>
                )}
              </div>
            }
          >
            {profileLoadError ? (
              <div className="batch-notice batch-notice--error" role="alert">
                {profileLoadError}
              </div>
            ) : null}
            {profileReady && !profileLoadError && !canCreateGroups ? (
              <div className="batch-notice batch-notice--info" role="status">
                You can view persona groups, but only admins can create or launch them.
              </div>
            ) : null}
            {stage === "select" ? (
              <section className="batch-section">
                <div className="batch-intro">
                  <h3>{profileReady && !canCreateGroups ? "Persona groups" : "Create your first group"}</h3>
                  <p>
                    {profileReady && !canCreateGroups
                      ? "Browse the personas available in this workspace. Ask an admin if you need to launch a new group questionnaire."
                      : "Pick the personas you want to include in this batch run. You can refine and save it once you choose the questionnaire file."}
                  </p>
                </div>
                <div className="batch-persona-grid" role="list">
                  {loading && (
                    <div className="batch-state" role="status">Loading personas…</div>
                  )}
                  {!loading && error && <div className="batch-state batch-state--error">{error}</div>}
                  {!loading && !error && personas.length === 0 && (
                    <div className="batch-state">No personas available yet. Create a persona first.</div>
                  )}
                  {!loading && !error && personas.length > 0 &&
                    personas.map((persona) => {
                      const isSelected = selectedPersonaIds.has(persona.agent_id);
                      return (
                        <button
                          key={persona.agent_id}
                          type="button"
                          className="batch-persona-card"
                          onClick={() => handleTogglePersona(persona.agent_id)}
                          disabled={!canCreateGroups}
                          aria-pressed={isSelected}
                        >
                          <span className="batch-persona-card__select" aria-hidden="true">
                            <span className="batch-persona-card__checkbox" data-selected={isSelected ? "true" : "false"}>
                              {isSelected ? (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect width="16" height="16" rx="4" fill="#1d4ed8" />
                                  <path d="M4.5 8.2L7 10.7L11.5 5.8" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : null}
                            </span>
                          </span>
                          <span className="batch-persona-card__content">
                            <strong>{persona.agent_name || "Untitled persona"}</strong>
                            <span>{persona.content_type || "No format set"}</span>
                            <span className="batch-persona-card__audience">Audience: {persona.audience_type || "Not specified"}</span>
                          </span>
                        </button>
                      );
                    })}
                </div>
              </section>
            ) : stage === "upload" ? (
              <section className="batch-upload-stage">
                <div className="batch-selected-panel">
                  <div className="batch-selected-header">
                    <h3>Selected personas</h3>
                    <span className="batch-selected-count">{selectedPersonas.length} selected</span>
                  </div>
                  <div className="batch-selected-grid" role="list">
                    {selectedPersonas.map((persona) => (
                      <div key={persona.agent_id} className="batch-selected-pill" role="listitem">
                        <strong>{persona.agent_name || "Untitled persona"}</strong>
                        <span>{persona.content_type || "No format set"}</span>
                        <span>{persona.audience_type ? `Audience: ${persona.audience_type}` : "Audience not set"}</span>
                      </div>
                    ))}
                  </div>
                  <StageButton type="button" variant="ghost" onClick={handleBackToSelect} className="batch-adjust-selection">
                    Adjust selection
                  </StageButton>
                </div>
                <div className="batch-upload-card">
                  <h3>Upload questionnaire</h3>
                  <p>Upload the questionnaire file to run against this group. Supported formats: PDF, DOCX, XLSX, CSV, TXT.</p>
                  <div className="batch-upload-drop">
                    {uploadFileName ? (
                      <div className="batch-upload-file">
                        <div className="batch-upload-file-meta">
                          <strong>{uploadFileName}</strong>
                          <span>{uploadFileType || "Unknown type"}</span>
                        </div>
                        <div className="batch-upload-file-actions">
                          <StageButton type="button" variant="ghost" onClick={handlePickUploadFile}>
                            Replace file
                          </StageButton>
                          <StageButton type="button" variant="ghost" onClick={clearUploadFile}>
                            Remove
                          </StageButton>
                          {uploadFileURL ? (
                            <a className="batch-upload-preview" href={uploadFileURL} target="_blank" rel="noreferrer">
                              Preview
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="batch-upload-trigger" onClick={handlePickUploadFile}>
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <rect x="5" y="6" width="26" height="24" rx="6" fill="rgba(59,130,246,0.12)" />
                          <path d="M18 12V24" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
                          <path d="M12 18H24" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>Choose questionnaire</span>
                      </button>
                    )}
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                      style={{ display: "none" }}
                      onChange={handleUploadFileChange}
                    />
                  </div>
                  {uploadError ? <p className="batch-upload-error">{uploadError}</p> : null}
                </div>
              </section>
            ) : (
              <section className="batch-monitor-stage">
                <div className="batch-monitor-summary">
                  <div className="batch-monitor-summary__details">
                    <h3>Batch progress</h3>
                    <span className={`batch-status-chip batch-status-chip--${(batchJobMeta?.status ?? "pending").toLowerCase()}`}>
                      {batchStatusLabel}
                    </span>
                  </div>
                  <div className="batch-monitor-summary__counts">
                    <span>{completedCount}/{batchTotalCount} completed</span>
                    {inProgressCount > 0 ? <span>{inProgressCount} in progress</span> : null}
                  </div>
                  {batchJobMeta?.questionnaire_file_name ? (
                    <div className="batch-monitor-summary__file">
                      <span>Questionnaire: {batchJobMeta.questionnaire_file_name}</span>
                    </div>
                  ) : null}
                </div>
                {batchStatusError ? (
                  <p className="batch-monitor-error" role="alert">{batchStatusError}</p>
                ) : null}
                <div className="batch-monitor-list">
                  {batchPersonasStatus.length === 0 ? (
                    <div className="batch-state">No personas queued for this batch.</div>
                  ) : (
                    <ul className="batch-monitor-items">
                      {batchPersonasStatus.map((persona) => {
                        const statusLabel = formatStatus(persona.status);
                        const isComplete = TERMINAL_PERSONA_STATUSES.has((persona.status ?? "").toLowerCase());
                        const canViewResults = isComplete && persona.dialogue && persona.dialogue.transcript;
                        const isExpanded = openPersonaId === persona.id;
                        const personaExporting = exportingPersonaId === persona.id;
                        const canExportPersona = Boolean(persona.dialogue?.transcript);
                        const personaCanCompare = comparablePersonasForModal.some((entry) => entry.id === persona.id);
                        return (
                          <li key={persona.id} className="batch-monitor-item">
                            <div className="batch-monitor-row">
                              <div className="batch-monitor-persona">
                                <strong>{persona.agent_name || "Untitled persona"}</strong>
                                <span>{persona.agent_id}</span>
                              </div>
                              <div className="batch-monitor-status">
                                <span className={`batch-status-chip batch-status-chip--${(persona.status ?? "pending").toLowerCase()}`}>
                                  {statusLabel}
                                </span>
                                {persona.error_message ? (
                                  <span className="batch-monitor-error-text">{persona.error_message}</span>
                                ) : null}
                              </div>
                              <div className="batch-monitor-actions">
                                {canViewResults ? (
                                  <button
                                    type="button"
                                    className="batch-monitor-toggle"
                                    onClick={() => setOpenPersonaId(isExpanded ? null : persona.id)}
                                  >
                                    {isExpanded ? "Hide results" : "View results"}
                                  </button>
                                ) : (
                                  <span className="batch-monitor-placeholder">
                                    {isComplete ? "Results syncing…" : "Processing…"}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isExpanded && canViewResults ? (
                              <div className="batch-monitor-results insights-results">
                                <QuestionnaireResults raw={persona.dialogue?.transcript ?? null} />
                                <div className="batch-options-bar batch-options-inline" role="group" aria-label="Questionnaire options">
                                  <button
                                    type="button"
                                    className="batch-options-button"
                                    onClick={() => handleOpenCompare(persona.id)}
                                    disabled={!personaCanCompare}
                                  >
                                    Compare full screen
                                  </button>
                                  <button
                                    type="button"
                                    className="batch-options-button"
                                    onClick={() => handleExportPersona(persona)}
                                    disabled={personaExporting || !canExportPersona}
                                  >
                                    {personaExporting ? "Exporting…" : "Export"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {batchFinished ? (
                  <div className="batch-options-bar batch-options-footer" role="group" aria-label="Batch options">
                    <button
                      type="button"
                      className="batch-options-button"
                      onClick={() => handleOpenCompare()}
                      disabled={comparablePersonasForModal.length < 2}
                    >
                      Compare full screen
                    </button>
                    <button
                      type="button"
                      className="batch-options-button"
                      onClick={handleExportBatch}
                      disabled={isExportingBatch || exportablePersonas.length === 0}
                    >
                      {isExportingBatch ? "Exporting…" : "Export all"}
                    </button>
                  </div>
                ) : null}
              </section>
            )}
          </StagePanel>
        </div>
      </div>
      <FullscreenModal open={isCompareOpen} onCloseAction={handleCloseCompare} anchorRef={contentAnchorRef}>
        <QuestionnaireCompareModal
          personas={comparablePersonasForModal}
          initialPersonaId={compareInitialPersonaId}
          onClose={handleCloseCompare}
        />
      </FullscreenModal>
      <style>{`
        .stage-layout {
          height: 100dvh;
          background: var(--bg, #f4f8ff);
          padding: 0;
          font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
          display: flex;
          flex-direction: row;
          overflow: hidden;
        }
        .stage-layout__sidebar {
          width: var(--sidebar-width);
          flex-shrink: 0;
        }
        .stage-layout__content {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: stretch;
          padding: 64px 24px 96px;
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }
        .stage-shell {
          width: min(1120px, 96%);
          display: flex;
          flex-direction: column;
          gap: 32px;
          color: var(--text);
          height: 100%;
          min-height: 0;
        }
        .stage-panel {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(30, 41, 59, 0.12);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 24px 60px rgba(10, 22, 40, 0.12);
          display: flex;
          flex-direction: column;
          gap: 24px;
          color: #1e293b;
          flex: 1;
          min-height: 0;
        }
        .stage-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .stage-panel__leading,
        .stage-panel__trailing,
        .stage-panel__spacer {
          flex: 0 0 auto;
          min-width: 48px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .stage-panel__spacer {
          visibility: hidden;
        }
        .stage-panel__titles {
          flex: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .stage-panel__titles h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #1e293b;
        }
        .stage-panel__titles p {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.7);
        }
        .stage-panel__body {
          display: flex;
          flex-direction: column;
          gap: 24px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .stage-panel__footer {
          margin-top: 12px;
        }
        .stage-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 12px;
          border: none;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease;
          font-family: inherit;
        }
        .stage-button:disabled,
        .stage-button[aria-disabled="true"] {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .stage-button--primary {
          background: #1e293b;
          color: #f6f7f9;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
        }
        .stage-button--primary:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.24);
        }
        .stage-button--secondary {
          background: rgba(30, 41, 59, 0.08);
          color: #1e293b;
        }
        .stage-button--secondary:not(:disabled):hover {
          background: rgba(30, 41, 59, 0.16);
          transform: translateY(-1px);
        }
        .stage-button--ghost {
          background: transparent;
          color: #1e293b;
        }
        .stage-button--ghost:not(:disabled):hover {
          color: #0f172a;
        }
        .stage-button--full {
          width: 100%;
        }
        .batch-panel-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .batch-step-indicator {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(30, 64, 175, 0.1);
          color: rgba(30, 58, 138, 0.9);
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.3px;
        }
        .batch-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .batch-intro {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 620px;
        }
        .batch-intro h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .batch-intro p {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.7);
          line-height: 1.6;
        }
        .batch-persona-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 18px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .batch-persona-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 18px;
          border-radius: 16px;
          border: 1px solid rgba(43, 108, 176, 0.18);
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 12px 30px rgba(10, 22, 40, 0.08);
          cursor: pointer;
          text-align: left;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
          position: relative;
          color: #1e293b;
        }
        .batch-persona-card:hover,
        .batch-persona-card[aria-pressed="true"] {
          border-color: rgba(43, 108, 176, 0.45);
          box-shadow: 0 18px 44px rgba(10, 22, 40, 0.16);
          transform: translateY(-2px);
        }
        .batch-persona-card:disabled,
        .batch-persona-card:disabled:hover,
        .batch-persona-card:disabled[aria-pressed="true"] {
          cursor: not-allowed;
          opacity: 0.72;
          border-color: rgba(43, 108, 176, 0.16);
          box-shadow: none;
          transform: none;
        }
        .batch-persona-card:focus-visible {
          outline: 2px solid rgba(43, 108, 176, 0.75);
          outline-offset: 4px;
        }
        .batch-persona-card__select {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }
        .batch-persona-card__checkbox {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 2px solid rgba(43, 108, 176, 0.35);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.85);
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .batch-persona-card__checkbox[data-selected="true"] {
          border-color: rgba(29, 78, 216, 1);
          background: rgba(29, 78, 216, 0.12);
        }
        .batch-persona-card__content {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.82);
        }
        .batch-persona-card__content strong {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }
        .batch-persona-card__audience {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.58);
        }
        .batch-state {
          grid-column: 1 / -1;
          padding: 18px;
          border-radius: 12px;
          border: 1px dashed rgba(43, 108, 176, 0.25);
          background: rgba(241, 245, 249, 0.68);
          color: rgba(15, 23, 42, 0.8);
          text-align: center;
          font-weight: 600;
        }
        .batch-state--error {
          border-color: rgba(239, 68, 68, 0.35);
          background: rgba(254, 226, 226, 0.4);
          color: rgba(185, 28, 28, 0.9);
        }
        .batch-notice {
          margin-bottom: 18px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
        }
        .batch-notice--info {
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.28);
          color: #1d4ed8;
        }
        .batch-notice--error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.32);
          color: #b91c1c;
        }
        .batch-upload-stage {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 28px;
          align-items: start;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .batch-selected-panel {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: 24px;
          border-radius: 18px;
          border: 1px solid rgba(43, 108, 176, 0.15);
          background: rgba(248, 250, 252, 0.75);
          min-height: 0;
          overflow: auto;
        }
        .batch-selected-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .batch-selected-header h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
        }
        .batch-selected-count {
          font-size: 13px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.6);
        }
        .batch-selected-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
          flex: 1;
          min-height: 0;
          overflow: auto;
        }
        .batch-selected-pill {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(30, 41, 59, 0.08);
          color: rgba(15, 23, 42, 0.82);
          font-size: 12px;
          box-shadow: inset 0 0 0 1px rgba(30, 41, 59, 0.06);
        }
        .batch-selected-pill strong {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }
        .batch-adjust-selection {
          align-self: flex-start;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
        }
        .batch-upload-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 28px;
          border-radius: 18px;
          border: 1px solid rgba(43, 108, 176, 0.15);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(10, 22, 40, 0.12);
          min-height: 0;
          overflow: auto;
        }
        .batch-upload-card h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }
        .batch-upload-card p {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.7);
          line-height: 1.6;
        }
        .batch-upload-drop {
          border: 1.5px dashed rgba(43, 108, 176, 0.3);
          border-radius: 16px;
          background: rgba(59, 130, 246, 0.06);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
          justify-content: center;
        }
        .batch-upload-trigger {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.92);
          color: #1d4ed8;
          padding: 22px 28px;
          border-radius: 14px;
          border: 1px solid rgba(29, 78, 216, 0.26);
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .batch-upload-trigger:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 36px rgba(29, 78, 216, 0.15);
        }
        .batch-upload-file {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .batch-upload-file-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 14px;
        }
        .batch-upload-file-meta strong {
          font-size: 16px;
          color: #0f172a;
        }
        .batch-upload-file-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .batch-upload-preview {
          font-size: 13px;
          font-weight: 600;
          color: #1d4ed8;
          text-decoration: none;
        }
        .batch-upload-preview:hover {
          text-decoration: underline;
        }
        .batch-upload-error {
          margin: 0;
          color: rgba(185, 28, 28, 0.9);
          font-size: 13px;
          font-weight: 600;
        }
        .batch-monitor-stage {
          display: flex;
          flex-direction: column;
          gap: 20px;
          flex: 1;
          min-height: 0;
        }
        .batch-monitor-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          padding: 18px 20px;
          border-radius: 16px;
          border: 1px solid rgba(43, 108, 176, 0.18);
          background: rgba(248, 250, 252, 0.75);
        }
        .batch-monitor-summary__details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .batch-monitor-summary__details h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }
        .batch-monitor-summary__counts {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.65);
        }
        .batch-monitor-summary__file {
          display: flex;
          align-items: center;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.6);
        }
        .batch-monitor-error {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: rgba(185, 28, 28, 0.9);
        }
        .batch-monitor-list {
          border: 1px solid rgba(43, 108, 176, 0.15);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.95);
          padding: 0;
          overflow: hidden;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .batch-monitor-items {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow-y: auto;
        }
        .batch-monitor-item {
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-bottom: 1px solid rgba(226, 232, 240, 0.8);
        }
        .batch-monitor-item:last-of-type {
          border-bottom: none;
        }
        .batch-monitor-row {
          display: grid;
          grid-template-columns: minmax(0, 260px) minmax(0, 180px) minmax(0, 200px);
          gap: 16px;
          align-items: flex-start;
        }
        .batch-monitor-persona {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .batch-monitor-persona strong {
          font-size: 15px;
          color: #0f172a;
        }
        .batch-monitor-persona span {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.55);
        }
        .batch-monitor-status {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-start;
        }
        .batch-status-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          text-transform: capitalize;
          background: rgba(59, 130, 246, 0.12);
          color: rgba(30, 64, 175, 0.95);
        }
        .batch-status-chip--running {
          background: rgba(59, 130, 246, 0.18);
          color: rgba(30, 64, 175, 0.98);
        }
        .batch-status-chip--parsed,
        .batch-status-chip--complete {
          background: rgba(34, 197, 94, 0.18);
          color: rgba(22, 163, 74, 0.95);
        }
        .batch-status-chip--failed {
          background: rgba(248, 113, 113, 0.2);
          color: rgba(220, 38, 38, 0.92);
        }
        .batch-monitor-error-text {
          font-size: 12px;
          color: rgba(220, 38, 38, 0.9);
        }
        .batch-monitor-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .batch-monitor-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #1d4ed8;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.22);
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }
        .batch-monitor-toggle:hover {
          background: rgba(59, 130, 246, 0.18);
          color: #0f172a;
        }
        .batch-monitor-link {
          font-size: 13px;
          font-weight: 600;
          color: #1d4ed8;
          text-decoration: none;
        }
        .batch-monitor-link:hover {
          text-decoration: underline;
        }
        .batch-monitor-placeholder {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.45);
        }
        .batch-monitor-results {
          border: 1px solid rgba(43, 108, 176, 0.12);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.04);
          max-height: 420px;
          overflow: hidden;
        }
        .batch-monitor-results .insights-questionnaire {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          background: rgba(15, 23, 42, 0.78);
          border: 1px solid rgba(59, 130, 246, 0.22);
          border-radius: 12px;
          padding: 18px;
          color: #e2e8f0;
          height: 100%;
        }
        .batch-options-bar {
          display: flex;
          gap: 14px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          margin-top: 16px;
        }
        .batch-options-inline {
          margin-top: 16px;
        }
        .batch-options-footer {
          justify-content: flex-end;
        }
        .batch-options-button {
          appearance: none;
          border: 1px solid rgba(59, 130, 246, 0.35);
          background: rgba(15, 23, 42, 0.85);
          color: #f1f5ff;
          border-radius: 999px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.22);
        }
        .batch-options-button:hover,
        .batch-options-button:focus-visible {
          background: rgba(59, 130, 246, 0.22);
          border-color: rgba(59, 130, 246, 0.6);
        }
        .batch-options-button:active {
          transform: translateY(1px);
        }
        .batch-options-button:focus-visible {
          outline: 2px solid rgba(59, 130, 246, 0.7);
          outline-offset: 2px;
        }
        .batch-options-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          pointer-events: none;
          background: rgba(15, 23, 42, 0.5);
          border-color: rgba(59, 130, 246, 0.25);
          box-shadow: none;
        }
        .batch-monitor-results .insights-questionnaire__header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .batch-monitor-results .insights-questionnaire__header h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
        }
        .batch-monitor-results .insights-questionnaire__count {
          font-size: 13px;
          font-weight: 600;
          color: rgba(148, 163, 184, 0.9);
          white-space: nowrap;
        }
        .batch-monitor-results .insights-questionnaire__scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding-right: 4px;
        }
        .batch-monitor-results .insights-questionnaire__grid {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          align-content: start;
        }
        .insights-questionnaire__item {
          border: 1px solid rgba(59, 130, 246, 0.22);
          border-radius: 10px;
          padding: 14px;
          background: rgba(30, 41, 59, 0.65);
          display: flex;
          flex-direction: column;
          gap: 8px;
          height: 100%;
          box-shadow: 0 6px 18px rgba(2, 6, 23, 0.14);
        }
        .insights-questionnaire__question {
          font-weight: 700;
          font-size: 14px;
          color: #bfdbfe;
        }
        .insights-questionnaire__answer {
          display: flex;
          gap: 6px;
          font-size: 13px;
          line-height: 1.4;
          word-break: break-word;
        }
        .insights-questionnaire__label {
          color: #94a3b8;
          font-weight: 600;
          flex-shrink: 0;
        }
        .insights-questionnaire__placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 140px;
          font-size: 14px;
          color: #cbd5f5;
          border: 1px dashed rgba(59, 130, 246, 0.35);
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.5);
        }
        .insights-questionnaire__raw {
          margin: 0;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(59, 130, 246, 0.28);
          border-radius: 10px;
          padding: 12px;
          white-space: pre-wrap;
          word-break: break-word;
          color: #f8fafc;
        }
        @media (max-width: 960px) {
          .stage-layout__content {
            padding: 64px 18px 96px;
          }
          .stage-panel {
            padding: 24px;
          }
          .batch-persona-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          }
          .batch-upload-stage {
            grid-template-columns: 1fr;
          }
          .batch-monitor-item {
            grid-template-columns: 1fr;
            align-items: flex-start;
          }
          .batch-monitor-row {
            grid-template-columns: 1fr;
          }
          .insights-questionnaire__grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 680px) {
          .stage-layout {
            flex-direction: column;
          }
          .stage-layout__sidebar {
            width: 100%;
            position: sticky;
            top: 0;
            z-index: 50;
          }
          .stage-layout__content {
            padding: 32px 16px 64px;
          }
          .stage-panel__titles h2 {
            font-size: 20px;
          }
          .insights-questionnaire__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
