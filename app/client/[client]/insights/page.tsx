"use client";
import React, { useState, useEffect, useRef } from "react";
import QuestionnaireResults from "@/app/components/QuestionnaireResults";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import Topbar from "../../../components/Topbar";
import { TOPBAR_HEIGHT } from "../../../components/topbarHeight";

// API response types
type PersonaOption = {
	id: string;
	name: string;
};

type InsightsRow = {
	personaId: string;
	sourceDocument: string;
	lead: { value: string; source: string };
	engagementTime: string;
	status: "Questionnaire" | "Interview" | "Chat";
	date: string;
	briefReport: string;
	conversation_id: string;
	transcript?: unknown;
	transcript_summary?: string | null;
	main_language?: string;
	ownerEmail?: string | null;
};

type InsightsApiResponse = {
	rows: InsightsRow[];
	totalCount: number;
	personas: PersonaOption[];
};

function formatInsightsDate(value?: string): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}
// Status options for the connected segmented control (kept here so length is available)
const statusOptions = (['All','Questionnaire','Interview','Chat'] as const);


type StagePanelProps = {
	heading?: string;
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
						{heading ? <h2>{heading}</h2> : null}
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

type StageAlertProps = {
	type: "success" | "error" | "info";
	message: string;
};

function StageAlert({ type, message }: StageAlertProps) {
	return (
		<div className={`stage-alert stage-alert--${type}`}>
			<span>{message}</span>
		</div>
	);
}

export default function InsightsTable() {
	const PAGE_SIZE = 25;
	const [filters, setFilters] = useState<{ personaId: string; search: string }>({
		personaId: "",
		search: "",
	});
	// Multi-select status chips: when `allStatuses` is true we show everything.
	const [allStatuses, setAllStatuses] = useState<boolean>(true);
	const [selectedStatuses, setSelectedStatuses] = useState<Record<"Questionnaire" | "Interview" | "Chat", boolean>>({
		Questionnaire: false,
		Interview: false,
		Chat: false,
	});
	const filterBarRef = useRef<HTMLDivElement>(null);
	const filterToggleWrapperRef = useRef<HTMLDivElement>(null);
	// Move filtersOpen state to top level so it persists across renders
	const [filtersOpen, setFiltersOpen] = useState(false);
	const filtersPanelId = React.useId();
	const [rows, setRows] = useState<InsightsRow[]>([]);
	const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([]);
	const [totalCount, setTotalCount] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [activeRow, setActiveRow] = useState<InsightsRow | null>(null);
	const pathname = usePathname();

	const selectedStatusKeys = React.useMemo(() => {
		if (allStatuses) return [];
		return (Object.entries(selectedStatuses) as Array<["Questionnaire" | "Interview" | "Chat", boolean]>)
			.filter(([, value]) => value)
			.map(([key]) => key.toLowerCase());
	}, [allStatuses, selectedStatuses]);

	// Close the Filters popup when clicking or touching outside the filterBar
	useEffect(() => {
		if (!filtersOpen) return;
		function handleDocClick(e: MouseEvent | TouchEvent) {
			const target = e.target as Node;
			if (filterBarRef.current && filterBarRef.current.contains(target)) return;
			if (filterToggleWrapperRef.current && filterToggleWrapperRef.current.contains(target)) return;
			setFiltersOpen(false);
		}
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setFiltersOpen(false);
			}
		}
		document.addEventListener("mousedown", handleDocClick);
		document.addEventListener("touchstart", handleDocClick);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleDocClick);
			document.removeEventListener("touchstart", handleDocClick);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [filtersOpen]);

	const clientSlug = React.useMemo(() => {
		if (!pathname) return "";
		const match = pathname.match(/^\/client\/([^\/]+)/);
		return match ? match[1] : "";
	}, [pathname]);

	useEffect(() => {
		setPage(1);
		setFilters({ personaId: "", search: "" });
		setAllStatuses(true);
		setSelectedStatuses({ Questionnaire: false, Interview: false, Chat: false });
		setFiltersOpen(false);
		setRows([]);
		setTotalCount(0);
		setPersonaOptions([]);
		setError(null);
	}, [clientSlug]);

	useEffect(() => {
		const previousBodyOverflow = document.body.style.overflow;
		const previousHtmlOverflow = document.documentElement.style.overflow;
		document.body.style.overflow = "hidden";
		document.documentElement.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousBodyOverflow;
			document.documentElement.style.overflow = previousHtmlOverflow;
		};
	}, []);

	useEffect(() => {
		if (!clientSlug) {
			setError("Workspace not found");
			setRows([]);
			setPersonaOptions([]);
			setTotalCount(0);
			setLoading(false);
			return;
		}

		let isMounted = true;
		const controller = new AbortController();
		async function fetchInsights() {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams();
				params.set("page", page.toString());
				params.set("pageSize", PAGE_SIZE.toString());
				if (filters.search.trim()) {
					params.set("search", filters.search.trim());
				}
				if (filters.personaId) {
					params.set("personaId", filters.personaId);
				}
				if (selectedStatusKeys.length > 0) {
					params.set("statuses", selectedStatusKeys.join(","));
				}

				const response = await fetch(
					`/api/clients/${encodeURIComponent(clientSlug)}/insights?${params.toString()}`,
					{ signal: controller.signal }
				);

				if (!response.ok) {
					let message = "Failed to load insights";
					try {
						const payload = (await response.json()) as { error?: string };
						if (payload?.error) message = payload.error;
					} catch {
						// ignore JSON parse failure
					}
					throw new Error(message);
				}

				const data = (await response.json()) as InsightsApiResponse;
				if (!isMounted) return;
				setRows(data.rows ?? []);
				setPersonaOptions(data.personas ?? []);
				setTotalCount(data.totalCount ?? 0);
			} catch (fetchError) {
				if (controller.signal.aborted) return;
				console.error("[Insights] Failed to load insights", fetchError);
				if (isMounted) {
					setRows([]);
					setPersonaOptions([]);
					setTotalCount(0);
					setError(fetchError instanceof Error ? fetchError.message : "Failed to load insights");
				}
			} finally {
				if (isMounted) {
					setLoading(false);
				}
			}
		}

		void fetchInsights();
		return () => {
			isMounted = false;
			controller.abort();
		};
	}, [clientSlug, page, filters.personaId, filters.search, selectedStatusKeys]);

	const personaSelectOptions = React.useMemo(() => {
		return [...personaOptions].sort((a, b) => {
			const nameA = a.name || "Untitled persona";
			const nameB = b.name || "Untitled persona";
			return nameA.localeCompare(nameB);
		});
	}, [personaOptions]);

	const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 0;
	const pageRangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const pageRangeEnd = totalCount === 0 ? 0 : Math.min(totalCount, page * PAGE_SIZE);
	const canGoPrev = page > 1;
	const canGoNext = totalPages > 0 && page < totalPages;

	const pagination = (
		<div className="insights-pagination" aria-live="polite">
			<span className="insights-pagination__summary">
				{totalCount === 0 ? "No results to display" : `Showing ${pageRangeStart}–${pageRangeEnd} of ${totalCount}`}
			</span>
			<div className="insights-pagination__controls">
				<StageButton
					type="button"
					variant="ghost"
					onClick={() => setPage((prev) => Math.max(1, prev - 1))}
					disabled={!canGoPrev || loading}
				>
					Previous
				</StageButton>
				<StageButton
					type="button"
					variant="ghost"
					onClick={() => setPage((prev) => prev + 1)}
					disabled={!canGoNext || loading}
				>
					Next
				</StageButton>
			</div>
		</div>
	);

	const errorMessage = typeof error === "string" ? error.trim() : "";
	const showErrorBanner = !loading && errorMessage.length > 0;

	useEffect(() => {
		if (!filters.personaId) return;
		const exists = personaOptions.some((option) => option.id === filters.personaId);
		if (!exists) {
			setFilters((prev) => ({ ...prev, personaId: "" }));
		}
	}, [personaOptions, filters.personaId]);

	useEffect(() => {
		if (totalPages === 0) {
			if (page !== 1) {
				setPage(1);
			}
			return;
		}
		if (page > totalPages) {
			setPage(totalPages);
		}
	}, [page, totalPages]);

	const topbarRightSlot = (
		<>
			<div className="insights-topbar-controls">
				<input
					type="text"
					value={filters.search}
					onChange={(event) => {
						const value = event.target.value;
						setFilters((prev) => ({ ...prev, search: value }));
						setPage(1);
					}}
					placeholder="Search all fields..."
					className="insights-input insights-topbar-controls__search"
				/>
				<div ref={filterToggleWrapperRef}>
					<StageButton
						type="button"
						variant="secondary"
						className="insights-topbar-controls__filter-button"
						aria-haspopup="dialog"
						aria-expanded={filtersOpen}
						aria-controls={filtersPanelId}
						onClick={() => setFiltersOpen((open) => !open)}
					>
						{filtersOpen ? 'Hide filters' : 'Filters'}
					</StageButton>
				</div>
			</div>
			{filtersOpen ? <div className="insights-filters__overlay" aria-hidden="true" /> : null}
			<div
				id={filtersPanelId}
				ref={filterBarRef}
				role="dialog"
				aria-modal="false"
				aria-label="Playback filters"
				aria-hidden={!filtersOpen}
				className={`insights-filters__panel${filtersOpen ? ' insights-filters__panel--open' : ''}`}
				data-open={filtersOpen}
			>
				<div className="insights-filters__header">
					<span className="insights-filters__title">Playback filters</span>
					<StageButton
						type="button"
						variant="ghost"
						className="insights-filters__close"
						onClick={() => setFiltersOpen(false)}
					>
						Close
					</StageButton>
				</div>
				<div className="insights-filters__section">
					<span className="insights-filters__label">Persona</span>
					<select
						value={filters.personaId}
						onChange={(event) => {
							const value = event.target.value;
							setFilters((prev) => ({ ...prev, personaId: value }));
							setPage(1);
						}}
						className="insights-select"
					>
						<option value="">All</option>
						{personaSelectOptions.map((option) => (
							<option key={option.id} value={option.id}>
								{option.name || "Untitled persona"}
							</option>
						))}
					</select>
				</div>
				<div className="insights-filters__section">
					<span className="insights-filters__label">Research type</span>
					<div className="insights-filters__section-row">
						<div className="insights-status-group" role="tablist" aria-label="Research type">
							{statusOptions.map((opt, idx) => {
								const isAll = opt === 'All';
								const isActive = isAll
									? allStatuses
									: selectedStatuses[opt as keyof typeof selectedStatuses];
								const chipClasses = [
									'insights-status-chip',
									isActive ? 'insights-status-chip--active' : '',
									idx === 0 ? 'insights-status-chip--start' : '',
									idx === statusOptions.length - 1 ? 'insights-status-chip--end' : '',
								].filter(Boolean).join(' ');
								return (
									<StageButton
										key={opt}
										type="button"
										role="tab"
										variant="ghost"
										className={chipClasses}
										aria-selected={isActive}
										onClick={(event) => {
											event.stopPropagation();
											setPage(1);
											if (isAll) {
												setAllStatuses(true);
												setSelectedStatuses({ Questionnaire: false, Interview: false, Chat: false });
											} else {
												setAllStatuses(false);
												setSelectedStatuses((prev) => {
													const next = { ...prev, [opt]: !prev[opt as keyof typeof prev] } as typeof prev;
													if (!next.Questionnaire && !next.Interview && !next.Chat) {
														setAllStatuses(true);
														return { Questionnaire: false, Interview: false, Chat: false };
													}
													return next;
												});
											}
										}}
										title={isActive ? (opt === 'Chat' ? `Chat selected` : (isAll ? `All statuses` : `Selected ${opt}`)) : (opt === 'Chat' ? `Toggle Chat` : (isAll ? `Show all statuses` : `Toggle ${opt}`)) }
									>
										{opt}
									</StageButton>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</>
	);

	return (
		<div
			className="insights-stage"
			style={{
				"--stage-topbar-offset": "var(--sidebar-width)",
				"--insights-topbar-height": `${TOPBAR_HEIGHT}px`,
			} as React.CSSProperties}
		>
			<Topbar
				title="Playbacks"
				offsetLeft="var(--stage-topbar-offset, 0px)"
				hideCadenceControls
				hideProfileAvatar
				rightSlot={topbarRightSlot}
			/>
			<main className="stage-layout insights-root">
				<aside className="stage-layout__sidebar">
					<Sidebar />
				</aside>
				<div className="stage-layout__content">
				<div className="stage-shell">
					<StagePanel footer={pagination}>
						<div
							className={`insights-table-section${loading ? " insights-table-section--busy" : ""}`}
							aria-busy={loading ? "true" : undefined}
						>
							{(loading || showErrorBanner) && (
								<div
									className="insights-table-overlay"
									role={loading ? "status" : "alert"}
									aria-live={loading ? "polite" : "assertive"}
								>
									<StageAlert
										type={loading ? "info" : "error"}
										message={loading ? "Loading insights…" : errorMessage || "Unable to load insights"}
									/>
								</div>
							)}
							<div className="insights-table-wrap">
								<table className="insights-table">
									<thead>
										<tr className="insights-table__head-row">
											<th className="insights-table__head-cell">Date</th>
											<th className="insights-table__head-cell insights-table__head-cell--persona">Persona</th>
											<th className="insights-table__head-cell">Owner</th>
											<th className="insights-table__head-cell">Research Type</th>
										</tr>
								</thead>
								<tbody>
									{rows.map((row, i) => (
										<React.Fragment key={row.conversation_id || `${row.personaId}-${i}`}>
											<tr
												className="insights-table__row insights-table__row--clickable"
												tabIndex={0}
												role="button"
												onClick={() => setActiveRow(row)}
												onKeyDown={(event) => {
													if (event.key === "Enter" || event.key === " ") {
														event.preventDefault();
														setActiveRow(row);
													}
												}}
											>
										{/* Length column removed - engagementTime omitted */}
										<td className="insights-table__cell">{formatInsightsDate(row.date)}</td>
									<td className="insights-table__cell insights-table__cell--persona">{row.sourceDocument || "Untitled persona"}</td>
										<td className="insights-table__cell">{row.ownerEmail ?? row.lead?.value ?? ''}</td>
									<td className="insights-table__cell">
										{(() => {
											const statusClass = row.status === 'Questionnaire'
												? 'questionnaire'
												: row.status === 'Interview'
													? 'interview'
													: 'chat';
											return (
												<span className={`insights-status-badge insights-status-badge--${statusClass}`}>
													{row.status}
												</span>
											);
										})()}
									</td>
					
										</tr>
														
								</React.Fragment>
							))}
								</tbody>
							</table>
							{activeRow && (
								<SlidingPanelOverlay
									open
									title={activeRow.sourceDocument || "Playback details"}
									description={`Research type: ${activeRow.status}`}
									onRequestClose={() => setActiveRow(null)}
									onAfterClose={() => setActiveRow(null)}
								>
									<div className="insights-detail-panel">
										<div className="insights-detail-row">
											<span>Date</span>
											<strong>{formatInsightsDate(activeRow.date)}</strong>
										</div>
										<div className="insights-detail-row">
											<span>Owner</span>
											<strong>{activeRow.ownerEmail ?? activeRow.lead?.value ?? "Unknown"}</strong>
										</div>
										<div className="insights-detail-row">
											<span>Research type</span>
											<strong>{activeRow.status}</strong>
										</div>
										{activeRow.briefReport ? (
											<section>
												<p className="insights-detail-heading">Short report</p>
												<p>{activeRow.briefReport}</p>
											</section>
										) : null}
										{activeRow.transcript_summary ? (
											<section>
												<p className="insights-detail-heading">Summary</p>
												<p>{activeRow.transcript_summary}</p>
											</section>
										) : null}
										{activeRow.status === "Questionnaire" && activeRow.transcript ? (
											<section>
												<p className="insights-detail-heading">Questionnaire</p>
												<QuestionnaireResults
													raw={activeRow.transcript}
													title="Questionnaire responses"
												/>
											</section>
										) : null}
									</div>
								</SlidingPanelOverlay>
							)}
							{!loading && !error && rows.length === 0 ? (
								<div className="insights-empty">No playbacks found matching your filters.</div>
							) : null}
						</div>
					</div>
					<style>{`
							@keyframes slideDown {
								from { opacity: 0; transform: translateY(-16px); }
								to { opacity: 1; transform: translateY(0); }
							}
						`}</style>
					</StagePanel>
				</div>
				</div>
				<style>{`
				.insights-stage {
					position: relative;
					min-height: 100vh;
				}
				.stage-layout {
					background: var(--bg, #f4f8ff);
					padding: 0;
						font-family: 'Cooper', 'Helvetica Neue', sans-serif;
					display: flex;
					flex-direction: row;
					height: 100%;
					min-height: 0;
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
					padding: 24px 24px 64px;
					height: 100%;
					min-height: 0;
					overflow: hidden;
					box-sizing: border-box;
				}
				.stage-shell {
					width: min(1120px, 96%);
					display: flex;
					flex-direction: column;
					gap: 24px;
					height: 100%;
					min-height: 0;
				}
				.insights-root {
					height: 100vh;
					box-sizing: border-box;
					padding-top: ${TOPBAR_HEIGHT}px;
					overflow: hidden;
				}
				.insights-root .stage-layout__sidebar {
					height: calc(100vh - ${TOPBAR_HEIGHT}px);
					min-height: 0;
					overflow-y: auto;
					box-sizing: border-box;
					padding: 12px 0 24px;
				}
				.insights-root .stage-layout__content {
					height: calc(100vh - ${TOPBAR_HEIGHT}px);
					padding: 24px 64px 12px;
					box-sizing: border-box;
					overflow: hidden;
				}
				.insights-root .stage-shell {
					flex: 1;
					min-height: 0;
				}
				@media (max-width: 960px) {
					.stage-layout__content {
						padding: 20px 18px 56px;
					}
					.insights-root .stage-layout__content {
						padding: 20px 18px 56px;
					}
				}
				@media (max-width: 680px) {
					.stage-layout {
						flex-direction: column;
					}
					.stage-layout__sidebar {
						width: 100%;
						position: sticky;
						top: ${TOPBAR_HEIGHT}px;
						z-index: 20;
					}
					.stage-layout__content {
						padding: 16px 16px 48px;
					}
					.insights-stage {
						--stage-topbar-offset: 0px;
					}
					.insights-root {
						overflow: auto;
					}
					.insights-root .stage-layout__sidebar {
						height: auto;
						overflow-y: visible;
						padding: 12px 16px 0;
					}
					.insights-root .stage-layout__content {
						height: auto;
						padding: 16px 16px 56px;
					}
				}
				.stage-panel {
					background: var(--bg, #f4f8ff);
					border-radius: 20px;
					padding: 0px;
					display: flex;
					flex-direction: column;
					gap: 4px;
					color: #1e293b;
					flex: 1;
					min-height: 0;
				}
				.stage-panel__header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 16px;
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
					color: rgba(30, 41, 59, 0.68);
				}
			.stage-panel__body {
				display: flex;
				flex-direction: column;
				gap: 24px;
				flex: 1;
				min-height: 0;
									box-shadow: none;
				border-radius: 20px;
			}
			.stage-panel__footer {
				margin-top: 0;
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
			.stage-button:disabled {
				cursor: not-allowed;
				opacity: 0.55;
			}
			.stage-button--full {
				width: 100%;
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
			.stage-alert {
				width: 100%;
				border-radius: 12px;
				padding: 12px 18px;
				font-weight: 600;
				font-size: 14px;
				text-align: center;
				display: flex;
				justify-content: center;
				align-items: center;
				gap: 12px;
				position: relative;
				z-index: 1;
			}
			.stage-alert--success {
				color: #166534;
				background: rgba(34, 197, 94, 0.12);
				border: 1px solid rgba(34, 197, 94, 0.35);
			}
			.stage-alert--error {
				color: #b91c1c;
				background: rgba(239, 68, 68, 0.12);
				border: 1px solid rgba(239, 68, 68, 0.35);
			}
			.stage-alert--info {
				color: #1d4ed8;
				background: rgba(59, 130, 246, 0.12);
				border: 1px solid rgba(59, 130, 246, 0.28);
			}
			.insights-table-section {
				position: relative;
			}
			.insights-table-overlay {
				position: absolute;
				top: 50%;
				left: 16px;
				right: 16px;
				transform: translateY(-50%);
				display: flex;
				justify-content: center;
				pointer-events: none;
				z-index: 2;
			}
			.insights-table-section--busy .insights-table-wrap {
				pointer-events: none;
			}
			.insights-table-section--busy .insights-table {
				opacity: 0.5;
			}
			.insights-table-overlay .stage-alert {
				background: transparent;
				border: none;
				box-shadow: none;
			}
			.insights-action-button {
				padding: 10px 16px;
				font-size: 14px;
			}
			.insights-action-button__content {
				display: inline-flex;
				align-items: center;
				gap: 8px;
			}
			.insights-action-button--icon {
				padding: 6px 10px;
				font-size: 14px;
				color: #1d4ed8;
			}
			.insights-action-button--icon .insights-action-button__content {
				gap: 6px;
			}
			.insights-empty {
				padding: 32px 16px;
				text-align: center;
				color: rgba(30, 41, 59, 0.55);
				font-size: 15px;
				font-weight: 600;
			}
			.insights-pagination {
				margin-top: 18px;
				display: grid;
				grid-template-columns: 1fr auto 1fr;
				align-items: center;
				gap: 16px;
				font-size: 14px;
				width: 100%;
			}
			.insights-pagination::after {
				content: "";
			}
			.insights-pagination__summary {
				color: rgba(30, 41, 59, 0.78);
				justify-self: start;
				text-align: left;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				padding-left: 4px;
			}
			.insights-pagination__controls {
				display: flex;
				align-items: center;
				gap: 8px;
				justify-self: center;
			}
			.insights-pagination__controls .stage-button {
				padding: 8px 14px;
				font-size: 13px;
			}
			.insights-status-group {
				display: inline-flex;
				gap: 4px;
				align-items: center;
				background: rgba(30, 41, 59, 0.06);
				border: 1px solid rgba(30, 41, 59, 0.08);
				border-radius: 999px;
				padding: 4px;
			}
			.insights-status-chip {
				padding: 6px 14px;
				font-size: 13px;
				border-radius: 999px;
				color: rgba(30, 41, 59, 0.72);
			}
			.insights-status-chip--active {
				background: #1e293b;
				color: #f6f7f9;
				box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
			}
			.insights-status-chip--start {
				border-top-left-radius: 999px;
				border-bottom-left-radius: 999px;
			}
			.insights-status-chip--end {
				border-top-right-radius: 999px;
				border-bottom-right-radius: 999px;
			}
			.insights-status-badge {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 4px 12px;
				border-radius: 999px;
				font-size: 13px;
				font-weight: 600;
				line-height: 1;
			}
			.insights-status-badge--questionnaire {
				background: rgba(148, 197, 255, 0.24);
				color: #0f416f;
			}
			.insights-status-badge--interview {
				background: rgba(134, 239, 172, 0.24);
				color: #166534;
			}
			.insights-status-badge--chat {
				background: rgba(196, 181, 253, 0.24);
				color: #5b21b6;
			}
			.insights-topbar-controls {
				position: relative;
				display: flex;
				align-items: center;
				gap: 12px;
						font-family: 'Cooper', 'Helvetica Neue', sans-serif;
			}
			.insights-topbar-controls__search {
				min-width: 220px;
				background: rgba(246, 247, 249, 0.96);
				border: 1px solid #052033;
				color: #052033;
				font-family: inherit;
			}
			.insights-topbar-controls__search::placeholder {
				color: rgba(5, 32, 51, 0.52);
			}
			.insights-topbar-controls__search:focus {
				border-color: rgba(5, 32, 51, 0.8);
				box-shadow: 0 0 0 2px rgba(5, 32, 51, 0.22);
			}
			.insights-topbar-controls__filter-button {
				background: #1e293b;
				color: #f6f7f9;
				border: 1px solid #052033;
				font-size: 13px;
				font-family: inherit;
				padding: 8px 16px;
				height: 40px;
				transition: transform 0.18s 
ease, box-shadow 0.18s 
ease, background 0.18s 
ease, color 0.18s 
ease;
			}
			.insights-topbar-controls__filter-button:not(:disabled):hover {
				background: rgba(246, 247, 249, 0.98);
			}
			.insights-filters__overlay {
				position: fixed;
				top: var(--insights-topbar-height, 56px);
				left: var(--stage-topbar-offset, 0px);
				right: 0;
				bottom: 0;
				background: rgba(15, 23, 42, 0.32);
				backdrop-filter: blur(2px);
				z-index: 220;
			}
			.insights-filters__panel {
				position: fixed;
				top: calc(var(--insights-topbar-height, 56px) + 12px);
				right: 32px;
				width: min(420px, calc(100vw - var(--stage-topbar-offset, 0px) - 64px));
				max-height: calc(100vh - var(--insights-topbar-height, 56px) - 48px);
				overflow-y: auto;
				background: var(--panel, #F6F7F9fff);
				border-radius: 16px;
				border: 1px solid rgba(var(--accent-rgb, 43,108,176),0.16);
				box-shadow: 0 28px 60px rgba(15, 23, 42, 0.28);
				padding: 24px;
				display: flex;
				flex-direction: column;
				gap: 20px;
				font-family: 'Cooper', 'Helvetica Neue', sans-serif;
				transform: translateX(32px);
				opacity: 0;
				pointer-events: none;
				transition: transform 240ms ease, opacity 180ms ease;
				z-index: 240;
			}
			.insights-filters__panel--open {
				transform: translateX(0);
				opacity: 1;
				pointer-events: auto;
			}
			.insights-filters__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 12px;
			}
			.insights-filters__title {
				font-size: 16px;
				font-weight: 700;
				color: #052033;
			}
			.insights-filters__close {
				color: rgba(30, 41, 59, 0.64);
			}
			.insights-filters__section {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}
			.insights-filters__section-row {
				display: flex;
				flex-wrap: wrap;
				gap: 12px;
			}
			.insights-filters__label {
				color: var(--accent-2, #7fb3ff);
				font-weight: 600;
				font-size: 14px;
			}
			.insights-select,
			.insights-input {
				background: var(--panel, #F6F7F9fff);
				color: var(--text, #052033);
				border: 1px solid #052033;
				border-radius: 10px;
				padding: 8px 14px;
				font-size: 13px;
				transition: border 0.2s ease, box-shadow 0.2s ease;
			}
			.insights-select {
				min-width: 140px;
				max-width: 260px;
			}
			.insights-select:focus,
			.insights-input:focus {
				outline: none;
				border-color: rgba(var(--accent-rgb, 43,108,176),0.32);
				box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 43,108,176),0.12);
			}
			.insights-input {
				min-width: 200px;
			}
			.insights-table-section {
				display: flex;
				flex-direction: column;
				flex: 1;
				min-height: 0;
				gap: 16px;
			}
			.insights-table-wrap {
				flex: 1;
				min-height: 0;
				width: 100%;
				border-radius: 0px;
				overflow: hidden;
				overflow-x: auto;
				overflow-y: auto;
			}
			.insights-table {
				width: 100%;
				border-collapse: separate;
				border-spacing: 0 10px;
				font-size: 15px;
				background: var(--bg, #f4f8ff);
			}
			.insights-table__head-cell {
				text-align: left;
				padding: 10px 8px;
				color: rgba(15, 23, 42, 0.65);
				font-size: 13px;
				font-weight: 700;
				border-bottom: 1px solid rgba(var(--accent-rgb, 43,108,176),0.08);
				position: sticky;
				top: 0;
				z-index: 1;
				background: none;
			}
			.insights-table__head-cell--persona {
				min-width: 150px;
				max-width: 220px;
			}
			.insights-table__row {
				background: none;
			}
			.insights-table__row--clickable {
				cursor: pointer;
			}
			.insights-table__row--clickable:focus-visible {
				outline: 3px solid rgba(59, 130, 246, 0.45);
				outline-offset: -1px;
			}
			.insights-table__cell {
				padding: 10px 8px;
				color: var(--text, #052033);
				background: var(--panel-2, #F6F7F9fff);
				font-size: 15px;
				vertical-align: middle;
			}
			.insights-table__cell--persona {
				max-width: 220px;
				min-width: 150px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				padding-bottom: 0;
			}
			.insights-table__cell--actions {
				white-space: nowrap;
				padding-right: 4px;
			}
			.insights-table__cell--compact {
				padding: 8px 6px;
			}
			.insights-action-button__chevron {
				transition: transform 0.18s ease;
			}
			.insights-action-button__chevron--open {
				transform: rotate(180deg);
			}
			.insights-detail-panel {
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
			.insights-detail-row {
				display: flex;
				justify-content: space-between;
				font-size: 14px;
				color: rgba(15, 23, 42, 0.78);
			}
			.insights-detail-heading {
				margin: 0 0 4px;
				font-size: 13px;
				color: rgba(15, 23, 42, 0.62);
				text-transform: uppercase;
				letter-spacing: 0.08em;
			}
			.sr-only {
				position: absolute;
				width: 1px;
				height: 1px;
				padding: 0;
				margin: -1px;
				overflow: hidden;
				clip: rect(0,0,0,0);
				white-space: nowrap;
				border: 0;
			}
			.insights-table__expanded-cell {
				padding: 0;
				background: var(--panel, #F6F7F9fff);
			}
			.insights-questionnaire {
				display: flex;
				flex-direction: column;
				gap: 16px;
				width: 100%;
				height: 100%;
				background: rgba(15, 23, 42, 0.78);
				border: 1px solid rgba(59, 130, 246, 0.22);
				border-radius: 12px;
				padding: 18px;
				color: #e2e8f0;
			}
			.insights-questionnaire__header {
				display: flex;
				align-items: baseline;
				justify-content: space-between;
				gap: 12px;
			}
			.insights-questionnaire__header h4 {
				margin: 0;
				font-size: 16px;
				font-weight: 700;
			}
			.insights-questionnaire__count {
				font-size: 13px;
				font-weight: 600;
				color: rgba(148, 163, 184, 0.9);
				white-space: nowrap;
			}
			.insights-questionnaire__scroll {
				flex: 1 1 auto;
				min-height: 0;
				overflow-y: auto;
				padding-right: 4px;
			}
			.insights-questionnaire__grid {
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
			@media (max-width: 1500px) {
				.insights-questionnaire__grid {
					grid-template-columns: repeat(2, minmax(0, 1fr));
				}
			}
			@media (max-width: 900px) {
				.insights-questionnaire__grid {
					grid-template-columns: 1fr;
				}
			}
			.insights-chat {
				display: flex;
				flex-direction: column;
				gap: 10px;
				margin: 8px 0;
			}
			.insights-chat__row {
				display: flex;
				align-items: flex-start;
				gap: 10px;
				margin-bottom: 2px;
			}
			.insights-chat__row--agent {
				flex-direction: row;
			}
			.insights-chat__row--user {
				flex-direction: row-reverse;
			}
			.insights-chat__col {
				display: flex;
				flex-direction: column;
				max-width: 420px;
			}
			.insights-chat__col--agent {
				align-items: flex-start;
			}
			.insights-chat__col--user {
				align-items: flex-end;
			}
			.insights-chat__label {
				font-weight: 700;
				font-size: 13px;
				opacity: 0.7;
				margin-bottom: 4px;
				letter-spacing: 0.2px;
			}
			.insights-chat__label--agent {
				color: var(--accent-2, #7ea0e6);
			}
			.insights-chat__label--user {
				color: var(--accent-2, #7fb3ff);
			}
			.insights-chat__bubble {
				border-radius: 16px;
				padding: 10px 16px;
				max-width: 420px;
				font-size: 15px;
				box-shadow: 0 2px 12px rgba(2,6,23,0.06);
			}
			.insights-chat__bubble--agent {
				background: var(--panel-2, #22325a);
				color: var(--accent-2, #7fb3ff);
				box-shadow: 0 2px 8px rgba(2,6,23,0.04);
				margin-right: 32px;
			}
			.insights-chat__bubble--user {
				background: var(--panel, #F6F7F9fff);
				color: var(--text, #052033);
				border: 1px solid rgba(var(--accent-rgb, 43,108,176),0.22);
				margin-left: 32px;
			}
			@media (max-width: 1024px) {
				.insights-topbar-controls__search {
					min-width: 180px;
				}
			}
			@media (max-width: 720px) {
				.insights-topbar-controls__search {
					display: none;
				}
				.insights-filters__panel {
					right: 16px;
					left: 16px;
					width: auto;
				}
				.insights-filters__overlay {
					left: 0;
				}
			}
 		`}</style>
		</main>
	</div>
	);
}
