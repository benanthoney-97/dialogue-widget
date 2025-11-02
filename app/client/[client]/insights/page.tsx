"use client";
import React, { useState, useEffect, useRef } from "react";
import { BriefMeButton } from "@/app/components/BriefMeButton";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Sidebar from "../Sidebar";

// Data from Supabase
type DialogueRow = {
	id: number;
	agent_id: number;
	call_duration_secs: number | null;
	received_at: string;
	transcript?: any; // jsonb, can be array or object
};
type AgentMapRow = {
	agent_id: string;
	agent_name: string;
};

type InsightsRow = {
    sourceDocument: string;
    lead: { value: string; source: string };
    engagementTime: string;
	status: 'Quant' | 'Qual';
    intent: string;
    date: string;
    briefReport: string;
    conversation_id: string;
    transcript?: any; // transcript jsonb
    questions?: any; // questions jsonb
    transcript_summary?: string;
    main_topics?: any;
    content_gaps?: any;
    pipeline_intent_reasoning?: any;
    competitive_comparison_summary?: any;
    main_language?: string;
};
// Helper to get unique values for dropdowns
function getUniqueValues<T>(arr: T[], key: keyof T) {
	return Array.from(new Set(arr.map((row) => row[key])));
}

const reportDropdownOptions = [
	"Transcript",
];

// Status options for the connected segmented control (kept here so length is available)
const statusOptions = (['All','Quant','Qual','Agent'] as const);


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
	const [openDropdown, setOpenDropdown] = useState<number | null>(null);
	const [selectedChip, setSelectedChip] = useState<{ [rowIdx: number]: string }>({});
const [filters, setFilters] = useState({
	sourceDocument: '',
	search: '',
});
// Multi-select status chips: when `allStatuses` is true we show everything.
const [allStatuses, setAllStatuses] = useState<boolean>(true);
const [selectedStatuses, setSelectedStatuses] = useState<{ Quant: boolean; Qual: boolean; Agent: boolean }>({ Quant: false, Qual: false, Agent: false });
	const [activeFilter, setActiveFilter] = useState<string | null>(null);
	const filterBarRef = useRef<HTMLDivElement>(null);
	// Move filtersOpen state to top level so it persists across renders
	const [filtersOpen, setFiltersOpen] = useState(false);

	// Hide filter input when clicking outside filter bar
	useEffect(() => {
		if (!activeFilter) return;
		function handleClick(e: MouseEvent) {
			if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
				setActiveFilter(null);
			}
		}
		document.addEventListener('mousedown', handleClick);
		return () => document.removeEventListener('mousedown', handleClick);
	}, [activeFilter]);

	// Close the Filters popup when clicking or touching outside the filterBar
	useEffect(() => {
		if (!filtersOpen) return;
		function handleDocClick(e: MouseEvent | TouchEvent) {
			if (filterBarRef.current && filterBarRef.current.contains(e.target as Node)) return;
			setFiltersOpen(false);
		}
		document.addEventListener('mousedown', handleDocClick);
		document.addEventListener('touchstart', handleDocClick);
		return () => {
			document.removeEventListener('mousedown', handleDocClick);
			document.removeEventListener('touchstart', handleDocClick);
		};
	}, [filtersOpen]);
	const [clientDisplayName, setClientDisplayName] = useState<string | null>(null);
	const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null);
	const [insightsRows, setInsightsRows] = useState<InsightsRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const pathname = usePathname();
			// leads filter is now a toggle, not a value
	// Get client slug from URL
	function getClientSlug(pathname: string | null): string {
		if (!pathname) return "";
		const match = pathname.match(/^\/client\/([^\/]+)/);
		return match ? match[1] : "";
	}
	const clientSlug = getClientSlug(pathname);

	useEffect(() => {
				async function fetchClientAndRows() {
					if (!clientSlug) return;
					// Get profile display name, id, and default_agent_id
					const { data: profileData, error: profileError } = await supabase
						.from('profiles')
						.select('id, display_name, default_agent_id')
						.eq('id', clientSlug)
						.single();
					if (profileError || !profileData) {
						setError('Profile not found');
						setClientDisplayName(null);
						setDefaultAgentId(null);
						setLoading(false);
						return;
					}
					if (profileData.display_name) {
						setClientDisplayName(profileData.display_name);
					} else {
						setClientDisplayName(null);
					}
					if (profileData.default_agent_id) {
						setDefaultAgentId(profileData.default_agent_id);
					} else {
						setDefaultAgentId(null);
					}
					setLoading(true);
					setError(null);
					// Get all dialogues for this profile/user
					const q = supabase
						.from('dialogues')
						.select('id, conversation_id, agent_id, call_duration_secs, received_at, transcript, pipeline_intent, questions, transcript_summary, main_topics, content_gaps, pipeline_intent_reasoning, competitive_comparison_summary, main_language, testing_mode')
						.eq('user_id', profileData.id);
					const { data: dialogueRows, error: dialogueError } = await q;
					console.log('[DEBUG] dialogueRows from Supabase:', dialogueRows);
					if (dialogueError) {
						setError('Failed to fetch dialogues');
						setLoading(false);
						return;
					}
						// Get unique agent_ids from dialogues
						const agentIds = Array.from(new Set((dialogueRows || []).map(d => d.agent_id)));
						// Fetch agent_map rows for these agent_ids only (join on agent_id string)
						let agentMapRows: AgentMapRow[] = [];
						if (agentIds.length > 0) {
							const { data: agentMapData, error: agentMapError } = await supabase
								.from('agent_map')
								.select('agent_id, agent_name')
								.in('agent_id', agentIds);
							if (agentMapError) {
								setError('Failed to fetch agent_map');
								setLoading(false);
								return;
							}
							agentMapRows = agentMapData || [];
						}
						// Join dialogues with agent_map on agent_id (string)
						const agentMapByAgentId: { [agent_id: string]: AgentMapRow } = {};
						for (const agent of agentMapRows) {
							agentMapByAgentId[agent.agent_id] = agent;
						}
						// Fetch contact_requests and summary_requests for all conversation_ids
						const conversationIds = (dialogueRows || []).map(d => d.conversation_id);
						let contactRequests: any[] = [];
						let summaryRequests: any[] = [];
						if (conversationIds.length > 0) {
							const { data: contactData } = await supabase
								.from('contact_requests')
								.select('conversation_id, user_email')
								.in('conversation_id', conversationIds);
							contactRequests = contactData || [];
							const { data: summaryData } = await supabase
								.from('summary_requests')
								.select('conversation_id, user_email')
								.in('conversation_id', conversationIds);
							summaryRequests = summaryData || [];
						}
						const contactByConvId: { [id: string]: string } = {};
						contactRequests.forEach(r => { if (r.conversation_id) contactByConvId[r.conversation_id] = r.user_email; });
						const summaryByConvId: { [id: string]: string } = {};
						summaryRequests.forEach(r => { if (r.conversation_id) summaryByConvId[r.conversation_id] = r.user_email; });

                        const rows: InsightsRow[] = (dialogueRows || []).map((d) => {
                            const agent = agentMapByAgentId[d.agent_id];
                            let lead = '';
                            let leadSource = 'none';
                            if (contactByConvId[d.conversation_id]) {
                                lead = contactByConvId[d.conversation_id];
								leadSource = 'contact_requests';
							} else if (summaryByConvId[d.conversation_id]) {
								lead = summaryByConvId[d.conversation_id];
								leadSource = 'summary_requests';
							}
							if (d.conversation_id === 'conv_9601k7c1fz2nervs6tj7zf9w0ps1') {
								console.log('[DEBUG] For conversation_id conv_9601k7c1fz2nervs6tj7zf9w0ps1, lead:', lead, 'source:', leadSource);
                            }
							const status: 'Qual' | 'Quant' = d.testing_mode ? 'Qual' : 'Quant';
							const row: InsightsRow = {
								sourceDocument: agent ? agent.agent_name : '',
								lead: { value: lead, source: leadSource },
								engagementTime: d.call_duration_secs != null ?
									new Date(d.call_duration_secs * 1000).toISOString().substr(11, 8) : '',
								status,
                                intent: ['Interest', 'Consideration', 'Intent'].includes(d.pipeline_intent) ? d.pipeline_intent : '',
                                date: d.received_at || '',
                                briefReport: '',
                                conversation_id: d.conversation_id,
                                transcript: d.transcript,
								questions: d.questions,
								transcript_summary: d.transcript_summary,
								main_topics: d.main_topics,
								content_gaps: d.content_gaps,
								pipeline_intent_reasoning: d.pipeline_intent_reasoning,
								competitive_comparison_summary: d.competitive_comparison_summary,
								main_language: d.main_language,
							};
							return row;
						});
						setInsightsRows(rows);
						setLoading(false);
                }
                fetchClientAndRows();
        }, [clientSlug]);

		// Filtering logic (unchanged, but now uses insightsRows)
			// Sort by date descending (most recent first)
       const sortedRows = [...insightsRows].sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
	   const filteredRows = sortedRows.filter((row) => { 
		   // Status filtering: if `allStatuses` is true we include all rows.
		   if (!allStatuses) {
			   // Only include row if its status (Quant|Qual) is selected.
			   const statusKey = row.status as 'Quant' | 'Qual';
			   if (!(selectedStatuses[statusKey])) return false;
		   }
		   if (filters.sourceDocument && row.sourceDocument !== filters.sourceDocument) return false;
           // (Date-after filter removed)
				if (filters.search) {
					const search = filters.search.toLowerCase();
					const rowString = Object.values(row).join(' ').toLowerCase();
					const dropdownStrings = reportDropdownOptions.map(opt => {
						switch (opt) {
							case "Transcript": return "This is a dummy transcript summary.";
							default: return "Sample content.";
						}
					}).join(' ').toLowerCase();
					if (!rowString.includes(search) && !dropdownStrings.includes(search)) return false;
				}
				return true;
			});

	return (
		<main className="stage-layout">
			<aside className="stage-layout__sidebar">
				<Sidebar />
			</aside>
			<div className="stage-layout__content">
				<div className="stage-shell">
					<StagePanel
						heading="Playbacks"
					>
					{loading && <StageAlert type="info" message="Loading insights…" />}
					{!loading && error && <StageAlert type="error" message={error} />}
					{/* FILTERS DROPDOWN BUTTON AND DROPDOWN */}
						  {(() => {
									 // Click-away handler for the inline filter row
									 React.useEffect(() => {
										 if (!filtersOpen) return;
										 function handleClick(e: MouseEvent) {
											 if (!filterBarRef.current || filterBarRef.current.contains(e.target as Node)) return;
											 setFiltersOpen(false);
										 }
										 document.addEventListener('mousedown', handleClick);
										 return () => document.removeEventListener('mousedown', handleClick);
									 }, [filtersOpen]);

									 // Render a single-row inline filter area: when open it grows to fill the row before the controls
									 return (
					  <div ref={filterBarRef} className="insights-filters" data-open={filtersOpen}>
						  {/* Inline filter panel - grows when open */}
						  <div className={`insights-filters__panel${filtersOpen ? ' insights-filters__panel--open' : ''}`}>
						  <div className="insights-filters__row">
							  {/* Row 1: Source Document */}
							  <div className="insights-filters__field insights-filters__field--pull">
								  <span className="insights-filters__label">Persona:</span>
								  <select
									  value={filters.sourceDocument}
									  onChange={e => setFilters(f => ({ ...f, sourceDocument: e.target.value }))}
									  className="insights-select"
								  >
											  <option value=''>All</option>
											  {getUniqueValues(insightsRows, 'sourceDocument').map(doc => (
												  <option key={doc as string} value={doc as string}>{doc}</option>
											  ))}
										  </select>
									  </div>
							  {/* Move status chips into the inline panel next to Dialogue */}
							  <div className="insights-filters__field">
								  <div className="insights-status-group" role="tablist" aria-label="Research type">
							  {statusOptions.map((opt, idx) => {
								  const isAll = opt === 'All';
							  const isActive = isAll ? allStatuses : (selectedStatuses as any)[opt];
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
										  onClick={(e) => {
															  e.stopPropagation();
															  if (isAll) {
																  setAllStatuses(true);
																  setSelectedStatuses({ Quant: false, Qual: false, Agent: false });
															  } else {
																  setAllStatuses(false);
																  setSelectedStatuses(prev => {
																	  const next = { ...prev, [opt]: !prev[opt as keyof typeof prev] } as typeof prev;
																	  if (!next.Quant && !next.Qual && !next.Agent) {
																		  setAllStatuses(true);
																		  return { Quant: false, Qual: false, Agent: false };
																	  }
																	  return next;
																  });
															  }
														  }}
									  title={isActive ? (opt === 'Agent' ? `Agent selected` : (isAll ? `All statuses` : `Selected ${opt}`)) : (opt === 'Agent' ? `Toggle Agent` : (isAll ? `Show all statuses` : `Toggle ${opt}`)) }
								  >
										  {opt}
									  </StageButton>
												  );
											  })}
										  </div>
									  </div>
								  </div>

								  {/* Reset button removed — filters reset is no longer shown here */}
							  </div>

							  {/* Controls group (search, filters button, status pill) */}
				  <div className="insights-filters__controls">
					  <StageButton
						  type="button"
						  variant="secondary"
						  className="insights-action-button"
						  onClick={() => setFiltersOpen((open) => !open)}
					  >
						  {filtersOpen ? 'Hide filters' : 'Filters'}
					  </StageButton>

								  {/* Status chips have been moved into the inline panel */}

				  <input
					  type='text'
					  value={filters.search}
					  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
					  placeholder='Search all fields...'
					  className="insights-input"
				  />
							  </div>
						  </div>
									   );
								   })()}

				<div className="insights-table-wrap">
					<table className="insights-table">
									<thead>
										<tr className="insights-table__head-row">
										<th className="insights-table__head-cell insights-table__head-cell--persona">Persona</th>
										<th className="insights-table__head-cell">Research Type</th>
										<th className="insights-table__head-cell">Date</th>
										<th className="insights-table__head-cell">Owner</th>
										<th className="insights-table__head-cell">Results</th>
										<th className="insights-table__head-cell"> </th>
										<th className="insights-table__head-cell">Export</th>
										</tr>
									</thead>
						<tbody>
						{filteredRows.map((row, i) => (
							<React.Fragment key={i}>
								<tr className="insights-table__row">
									<td className="insights-table__cell insights-table__cell--persona">{row.sourceDocument}</td>
									<td className="insights-table__cell">{row.status}</td>
										{/* Length column removed - engagementTime omitted */}
										<td className="insights-table__cell">{
											row.date
												? new Date(row.date).toLocaleString('en-US', {
													year: 'numeric',
													month: 'short',
													day: 'numeric',
													hour: 'numeric',
													minute: '2-digit',
													hour12: true
												})
											: ''
										}</td>
										<td className="insights-table__cell">{row.lead?.value || ''}</td>
										<td className="insights-table__cell insights-table__cell--actions">
						<StageButton
							type="button"
							variant="secondary"
							className="insights-action-button"
							onClick={() => setOpenDropdown(openDropdown === i ? null : i)}
							aria-expanded={openDropdown === i}
						>
							<span className="insights-action-button__content">
								<span>{openDropdown === i ? 'Hide Results' : 'View Results'}</span>
											  <svg
												className={`insights-action-button__chevron${openDropdown === i ? ' insights-action-button__chevron--open' : ''}`}
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
												aria-hidden="true"
												focusable="false"
											  >
									<path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</span>
						</StageButton>
										</td>
										<td className="insights-table__cell insights-table__cell--compact">
											{defaultAgentId && (
												<BriefMeButton
													agentId={defaultAgentId}
													conversationId={row.conversation_id}
													transcript={row.transcript}
												/>
											)}
										</td>
										<td className="insights-table__cell insights-table__cell--compact">
						<StageButton
							type="button"
							variant="ghost"
							className="insights-action-button insights-action-button--icon"
							onClick={() => {
								// Simple client-side JSON export of the row
								try {
									const data = JSON.stringify(row, null, 2);
									const blob = new Blob([data], { type: 'application/json' });
									const url = URL.createObjectURL(blob);
														const a = document.createElement('a');
														a.href = url;
														a.download = `${row.conversation_id || 'results'}.json`;
														a.click();
														URL.revokeObjectURL(url);
								} catch (e) {
									console.error('Export failed', e);
								}
							}}
						>
									<span className="insights-action-button__content" aria-hidden="false">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
											<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
											<polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
											<line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
										</svg>
										<span className="sr-only">Export</span>
							</span>
						</StageButton>
										</td>
									</tr>
														{openDropdown === i && (
															<tr>
																<td colSpan={7} className="insights-table__expanded-cell">
																	<div className="insights-results">
																		{(() => {
																			const optionsForRow = row.status === 'Quant' ? [] : reportDropdownOptions;
																			const hasOptions = optionsForRow.length > 0;
																			const activeOption = hasOptions ? (selectedChip[i] || optionsForRow[0]) : null;

																			return (
																				<>
																					<div className="insights-results__chips">
																						{hasOptions ? (
																							optionsForRow.map((opt) => {
																								const isSelected = selectedChip[i] === opt || (!selectedChip[i] && opt === optionsForRow[0]);
																								const chipClasses = [
																									"insights-results__chip",
																									isSelected ? "insights-results__chip--active" : "",
																								]
																									.filter(Boolean)
																									.join(" ");
																								return (
																									<button
																										key={opt}
																										type="button"
																										className={chipClasses}
																										aria-pressed={isSelected}
																										onClick={() => setSelectedChip((prev) => ({ ...prev, [i]: opt }))}
																									>
																										{opt}
																									</button>
																								);
																							})
																						) : (
																							<div className="insights-results__empty">Quant results: transcript view not available.</div>
																						)}
																					</div>

																					<div className="insights-results__content">
																						{hasOptions && activeOption === "Transcript"
																							? (() => {
																									// Render transcript as chat interface
																									let transcript = filteredRows[i]?.transcript;
																									if (!transcript) {
																										const orig = insightsRows.find(
																											(r) =>
																												r.date === filteredRows[i]?.date &&
																												r.sourceDocument === filteredRows[i]?.sourceDocument,
																										);
																										transcript = orig?.transcript;
																									}
																									console.log("[DEBUG] Rendering transcript for row", i, transcript);
																									let chatMessages: { role: "agent" | "user"; content: string }[] = [];
																									if (typeof transcript === "string") {
																										const lines = transcript.split(/\n\n+/);
																										let currentRole: "agent" | "user" | null = null;
																										let buffer = "";
																										lines.forEach((line) => {
																											const trimmed = line.trim();
																											if (/^Agent:/i.test(trimmed)) {
																												if (buffer && currentRole) {
																													chatMessages.push({ role: currentRole, content: buffer.trim() });
																												}
																												currentRole = "agent";
																												buffer = trimmed.replace(/^Agent:/i, "").trim();
																											} else if (/^User:/i.test(trimmed)) {
																												if (buffer && currentRole) {
																													chatMessages.push({ role: currentRole, content: buffer.trim() });
																												}
																												currentRole = "user";
																												buffer = trimmed.replace(/^User:/i, "").trim();
																											} else {
																												buffer += (buffer ? "\n" : "") + trimmed;
																											}
																										});
																										if (buffer && currentRole) {
																											chatMessages.push({ role: currentRole, content: buffer.trim() });
																										}
																									} else if (Array.isArray(transcript)) {
																										chatMessages = transcript;
																									}
																									if (!chatMessages.length) {
																										return (
																											<div className="insights-results__empty insights-results__empty--content">
																												<span>No transcript available.</span>
																												<pre className="insights-results__debug">
																													{typeof transcript === "undefined"
																														? "transcript: undefined"
																														: "transcript: " + JSON.stringify(transcript, null, 2)}
																												</pre>
																											</div>
																										);
																									}
																									return (
																										<div className="insights-chat">
																											{chatMessages.map((msg, idx) => {
																												const isAgent = msg.role === "agent";
																												return (
																													<div
																														key={idx}
																														className={`insights-chat__row ${
																															isAgent ? "insights-chat__row--agent" : "insights-chat__row--user"
																														}`}
																													>
																														<div
																															className={`insights-chat__col ${
																																isAgent ? "insights-chat__col--agent" : "insights-chat__col--user"
																															}`}
																														>
																															<span
																																className={`insights-chat__label ${
																																	isAgent ? "insights-chat__label--agent" : "insights-chat__label--user"
																																}`}
																															>
																																{isAgent ? "Agent" : "User"}
																															</span>
																															<div
																																className={`insights-chat__bubble ${
																																	isAgent ? "insights-chat__bubble--agent" : "insights-chat__bubble--user"
																																}`}
																															>
																																{msg.content}
																															</div>
																														</div>
																													</div>
																												);
																											})}
																										</div>
																									);
																							  })()
																							: hasOptions
																							? "Sample content."
																							: (
																								<div className="insights-results__empty insights-results__empty--content">
																									Quant results: transcript view not available.
																								</div>
																							  )}
																					</div>
																				</>
																			);
																		})()}
																	</div>
																</td>
															</tr>
														)}
								</React.Fragment>
							))}
						</tbody>
								</table>
							</div>
							<style>{`
								@font-face {
									font-family: 'CooperBT';
									src: url('/fonts/CooperBT/Cooper Light BT.ttf') format('truetype');
									font-weight: normal;
									font-style: normal;
									font-display: swap;
								}
								@keyframes slideDown {
									from { opacity: 0; transform: translateY(-16px); }
									to { opacity: 1; transform: translateY(0); }
								}
							`}</style>
					</StagePanel>
				</div>
			</div>
			<style>{`
				.stage-layout {
					min-height: 100dvh;
					background: var(--bg, #f4f8ff);
					padding: 0;
					font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
					display: flex;
					flex-direction: row;
				}
				.stage-layout__sidebar {
					width: 180px;
					flex-shrink: 0;
				}
				.stage-layout__content {
					flex: 1;
					display: flex;
					justify-content: center;
					align-items: flex-start;
					padding: 64px 24px 96px;
					min-height: 100dvh;
					overflow-y: auto;
				}
				.stage-shell {
					width: min(1120px, 96%);
					display: flex;
					flex-direction: column;
					gap: 24px;
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
			.insights-filters {
				display: flex;
				align-items: flex-start;
				gap: 12px;
				margin-bottom: 0;
			}
			.insights-filters__panel {
				flex: 0 0 auto;
				max-width: 0;
				opacity: 0;
				overflow: hidden;
				display: flex;
				flex-direction: column;
				gap: 12px;
				padding: 0;
				transition: max-width 260ms ease, padding 200ms ease, opacity 160ms ease;
			}
			.insights-filters__panel--open {
				flex: 1 1 0%;
				max-width: 100%;
				opacity: 1;
				padding: 0 18px;
			}
			.insights-filters__row {
				display: flex;
				flex-wrap: nowrap;
				gap: 18px;
				margin-bottom: 8px;
			}
			.insights-filters__field {
				display: flex;
				align-items: center;
				gap: 8px;
			}
			.insights-filters__field--pull {
				margin-left: 0;
				margin-right: 0;
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
				border: 1px solid rgba(var(--accent-rgb, 43,108,176),0.08);
				border-radius: 10px;
				padding: 8px 14px;
				font-size: 14px;
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
			.insights-filters__controls {
				display: flex;
				align-items: center;
				gap: 12px;
				margin-left: auto;
			}
			.insights-table-wrap {
				overflow-x: auto;
				width: 100%;
			}
			.insights-table {
				width: 100%;
				border-collapse: collapse;
				font-size: 15px;
				background: var(--panel, #F6F7F9fff);
			}
			.insights-table__head-row {
				background: var(--panel, #F6F7F9fff);
			}
			.insights-table__head-cell {
				text-align: left;
				padding: 10px 8px;
				color: var(--accent-2, #7fb3ff);
				font-size: 13px;
				font-weight: 700;
				border-bottom: 1px solid rgba(var(--accent-rgb, 43,108,176),0.08);
				position: sticky;
				top: 0;
				z-index: 1;
				background: var(--panel-2, #F6F7F9fff);
			}
			.insights-table__head-cell--persona {
				min-width: 150px;
				max-width: 220px;
			}
			.insights-table__row {
				background: var(--panel, #F6F7F9fff);
				border-bottom: 1px solid rgba(var(--accent-rgb, 43,108,176),0.08);
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
			.insights-results {
				padding: 18px 32px;
				border: 1px solid rgba(var(--accent-rgb, 43,108,176),0.12);
				border-top: none;
				border-bottom-left-radius: 12px;
				border-bottom-right-radius: 12px;
				box-shadow: 0 4px 18px rgba(2,6,23,0.06);
				animation: slideDown 0.32s cubic-bezier(.4,2,.6,1);
				height: 420px;
				max-height: 420px;
				overflow: hidden;
				display: flex;
				flex-direction: column;
				gap: 20px;
			}
			.insights-results__chips {
				display: flex;
				flex-wrap: wrap;
				gap: 16px;
				margin-bottom: 4px;
			}
			.insights-results__chip {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				padding: 7px 18px;
				border-radius: 999px;
				background: var(--panel, #F6F7F9fff);
				color: var(--accent-2, #7fb3ff);
				font-weight: 600;
				font-size: 14px;
				cursor: pointer;
				border: 1px solid rgba(var(--accent-rgb, 43,108,176),0.08);
				box-shadow: 0 2px 8px rgba(2,6,23,0.04);
				transition: background 0.18s ease, color 0.18s ease, border 0.18s ease;
				line-height: 1;
				font-family: inherit;
				outline: none;
			}
			.insights-results__chip--active {
				background: rgba(var(--accent-rgb, 43,108,176),0.16);
				color: #f6f7f9;
				border: 2px solid rgba(var(--accent-rgb, 43,108,176),0.22);
				box-shadow: 0 2px 12px rgba(2,6,23,0.06);
			}
			.insights-results__chip:focus-visible {
				outline: 3px solid rgba(var(--accent-rgb, 43,108,176),0.32);
				outline-offset: 2px;
			}
			.insights-results__content {
				color: var(--accent-2, #7ea0e6);
				font-size: 15px;
				min-height: 32px;
				padding-left: 2px;
				flex: 1;
				overflow-y: auto;
			}
			.insights-results__empty {
				color: var(--muted, #7b8aa8);
				font-size: 14px;
				padding: 8px 12px;
			}
			.insights-results__empty--content {
				padding: 0;
				font-size: 15px;
			}
			.insights-results__debug {
				color: var(--accent, #2b6cb0);
				background: var(--panel-2, #f1f7ff);
				font-size: 12px;
				margin-top: 8px;
				padding: 8px;
				border-radius: 6px;
				overflow-x: auto;
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
				.insights-filters__row {
					flex-wrap: wrap;
				}
				.insights-filters__field--pull {
					margin-right: 0;
				}
			}
		`}</style>
	</main>
	);
}
