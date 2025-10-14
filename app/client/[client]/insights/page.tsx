"use client";

const tdStyle = {
	padding: "10px 8px",
	color: "#e6eaff",
	background: "#16213a",
	fontSize: 15,
};

const buttonStyle = {
	padding: "7px 16px",
	borderRadius: 8,
	border: "1px solid #2d406b",
	background: "#22325a",
	color: "#a3c0ff",
	fontWeight: 600,
	fontSize: 14,
	cursor: "pointer",
	transition: "background 0.18s, border 0.18s, color 0.18s",
	boxShadow: "0 2px 8px rgba(10,22,40,0.13)",
};
import React, { useState, useEffect, useRef } from "react";
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
	keyFocus: string;
	intent: string;
	date: string;
	briefReport: string;
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
	"Questions",
	"Insights",
	"Metadata",
];


export default function InsightsTable() {
	const [openDropdown, setOpenDropdown] = useState<number | null>(null);
	const [selectedChip, setSelectedChip] = useState<{ [rowIdx: number]: string }>({});
	const [filters, setFilters] = useState({
		sourceDocument: '',
		search: '',
		dateAfter: '',
		dateBefore: '',
		intent: '',
		leads: '',
	});
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
	const [clientDisplayName, setClientDisplayName] = useState<string | null>(null);
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
					// Get client display name and id
					const { data: clientData, error: clientError } = await supabase
						.from('clients')
						.select('id, display_name')
						.eq('name', clientSlug)
						.single();
					if (clientData && clientData.display_name) {
						setClientDisplayName(clientData.display_name);
					} else {
						setClientDisplayName(null);
					}
					if (!clientData) return;
					setLoading(true);
					setError(null);
					// Get all dialogues for this client
					const { data: dialogueRows, error: dialogueError } = await supabase
						.from('dialogues')
						.select('id, conversation_id, agent_id, call_duration_secs, received_at, transcript, pipeline_intent, questions, transcript_summary, main_topics, content_gaps, pipeline_intent_reasoning, competitive_comparison_summary, main_language')
						.eq('client_id', clientData.id);
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
							const row = {
								sourceDocument: agent ? agent.agent_name : '',
								lead: { value: lead, source: leadSource },
								engagementTime: d.call_duration_secs != null ?
									new Date(d.call_duration_secs * 1000).toISOString().substr(11, 8) : '',
								keyFocus: '',
								intent: ['Interest', 'Consideration', 'Intent'].includes(d.pipeline_intent) ? d.pipeline_intent : '',
								date: d.received_at || '',
								briefReport: '',
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
		       if (filters.sourceDocument && row.sourceDocument !== filters.sourceDocument) return false;
		       if (filters.leads && !row.lead.value) return false;
		       if (filters.dateAfter) {
					const after = new Date(filters.dateAfter);
					if (!row.date || new Date(row.date) < after) return false;
				}
				if (filters.dateBefore) {
					// Add 1 day to include the selected day fully
					const before = new Date(filters.dateBefore);
					before.setDate(before.getDate() + 1);
					if (!row.date || new Date(row.date) >= before) return false;
				}
				if (filters.intent && row.intent !== filters.intent) return false;
				if (filters.search) {
					const search = filters.search.toLowerCase();
					const rowString = Object.values(row).join(' ').toLowerCase();
					const dropdownStrings = reportDropdownOptions.map(opt => {
						switch (opt) {
							case "Transcript": return "This is a dummy transcript summary.";
							case "Questions": return "Example questions asked in this session.";
							case "Insights": return "Key insights extracted from the conversation.";
							case "Metadata": return "Session metadata and details.";
							default: return "Sample content.";
						}
					}).join(' ').toLowerCase();
					if (!rowString.includes(search) && !dropdownStrings.includes(search)) return false;
				}
				return true;
			});

	return (
						<main style={{ minHeight: "100dvh", background: "#0a1628", padding: 0, fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif", display: 'flex', flexDirection: 'row' }}>
							   <div style={{ width: 180, flexShrink: 0 }}>
								   <Sidebar />
							   </div>
							<div style={{
								flex: 1,
								background: "#16213a",
								borderRadius: 16,
								boxShadow: "0 8px 32px rgba(10,22,40,0.45)",
								padding: 40,
								fontFamily: "inherit",
								position: 'relative',
								minHeight: '100dvh',
								overflow: 'auto',
							}}>
									<h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#e6eaff", fontFamily: "inherit" }}>
										{clientDisplayName ? `${clientDisplayName} Insights` : "Insights"}
									</h2>
						   {/* FILTERS DROPDOWN BUTTON AND DROPDOWN */}
						   {(() => {
							  // Click-away handler
							  React.useEffect(() => {
								  if (!filtersOpen) return;
								  function handleClick(e: MouseEvent) {
									  if (!filterBarRef.current || filterBarRef.current.contains(e.target as Node)) return;
									  setFiltersOpen(false);
								  }
								  document.addEventListener('mousedown', handleClick);
								  return () => document.removeEventListener('mousedown', handleClick);
							  }, [filtersOpen]);
							  return (
								  <div ref={filterBarRef} style={{ position: 'relative', marginBottom: 18, display: 'flex', justifyContent: 'flex-end' }}>
									  <button
										  onClick={() => setFiltersOpen(open => !open)}
										  style={{
											  background: '#22325a',
											  color: '#a3c0ff',
											  border: '1px solid #2d406b',
											  borderRadius: 6,
											  padding: '8px 22px',
											  fontWeight: 600,
											  fontSize: 15,
											  cursor: 'pointer',
											  boxShadow: '0 2px 8px rgba(10,22,40,0.13)',
										  }}
									  >
										  {filtersOpen ? 'Hide filters' : 'Filters'}
									  </button>
									  {filtersOpen && (
										  <div
											  style={{
												  position: 'absolute',
												  top: 44,
												  right: 0,
												  background: '#16213a',
												  border: '1px solid #2d406b',
												  borderRadius: 12,
												  boxShadow: '0 8px 32px rgba(10,22,40,0.45)',
												  padding: 24,
												  zIndex: 10,
												  minWidth: 600,
												  display: 'flex',
												  flexDirection: 'column',
												  gap: 12,
											  }}
										  >
											  <div style={{ display: 'flex', gap: 18, marginBottom: 8 }}>
												  {/* Row 1: Search, Source Document, Leads */}
												   <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
													   <span style={{ color: '#a3c0ff', fontWeight: 600, fontSize: 14 }}>Search:</span>
													   <input
														   type='text'
														   value={filters.search}
														   onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
														   placeholder='Search all fields...'
														   style={{ background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', borderRadius: 6, padding: '6px 12px', fontSize: 14, minWidth: 120, maxWidth: 180 }}
													   />
												   </div>
												   <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
													   <span style={{ color: '#a3c0ff', fontWeight: 600, fontSize: 14 }}>Source Document:</span>
													   <select
														   value={filters.sourceDocument}
														   onChange={e => setFilters(f => ({ ...f, sourceDocument: e.target.value }))}
														   style={{ background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', borderRadius: 6, padding: '6px 12px', fontSize: 14, minWidth: 80, maxWidth: 140 }}
													   >
														   <option value=''>All</option>
														   {getUniqueValues(insightsRows, 'sourceDocument').map(doc => (
															   <option key={doc as string} value={doc as string}>{doc}</option>
														   ))}
													   </select>
												   </div>
												   <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
													   <button
														   type="button"
														   onClick={() => setFilters(filts => ({ ...filts, leads: filts.leads ? '' : '1' }))}
														   style={{
															   background: filters.leads ? '#2d406b' : '#22325a',
															   color: filters.leads ? '#fff' : '#a3c0ff',
															   fontWeight: 600,
															   fontSize: 14,
															   borderRadius: 6,
															   border: filters.leads ? '2px solid #7ea0e6' : '1px solid #2d406b',
															   padding: '7px 18px',
															   cursor: 'pointer',
															   boxShadow: filters.leads ? '0 2px 12px #22325a' : '0 2px 8px rgba(10,22,40,0.13)',
															   transition: 'background 0.18s, color 0.18s, border 0.18s',
														   }}
													   >
														   {filters.leads ? 'All' : 'Leads'}
													   </button>
												   </div>
											   </div>
											   <div style={{ display: 'flex', gap: 18 }}>
												   {/* Row 2: Date After, Date Before, Intent */}
												   <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
													   <span style={{ color: '#a3c0ff', fontWeight: 600, fontSize: 14 }}>Date after:</span>
													   <input
														   type='date'
														   value={filters.dateAfter}
														   onChange={e => setFilters(f => ({ ...f, dateAfter: e.target.value }))}
														   style={{ background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', borderRadius: 6, padding: '6px 12px', fontSize: 14 }}
													   />
												   </div>
												   <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
													   <span style={{ color: '#a3c0ff', fontWeight: 600, fontSize: 14 }}>Date before:</span>
													   <input
														   type='date'
														   value={filters.dateBefore}
														   onChange={e => setFilters(f => ({ ...f, dateBefore: e.target.value }))}
														   style={{ background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', borderRadius: 6, padding: '6px 12px', fontSize: 14 }}
													   />
												   </div>
												   <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
													   <span style={{ color: '#a3c0ff', fontWeight: 600, fontSize: 14 }}>Intent:</span>
													   <select
														   value={filters.intent}
														   onChange={e => setFilters(f => ({ ...f, intent: e.target.value }))}
														   style={{ background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', borderRadius: 6, padding: '6px 12px', fontSize: 14, minWidth: 80, maxWidth: 180 }}
													   >
														   <option value=''>All</option>
														   <option value='Interest'>Interest</option>
														   <option value='Consideration'>Consideration</option>
														   <option value='Intent'>Intent</option>
													   </select>
												   </div>
											   </div>
											   {/* Reset chip on its own line at the bottom of dropdown */}
											   {(filters.sourceDocument || filters.search || filters.dateAfter || filters.dateBefore || filters.intent || filters.leads) && (
												   <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
													   <button
														   type="button"
														   onClick={() => setFilters({
															   sourceDocument: '',
															   search: '',
															   dateAfter: '',
															   dateBefore: '',
															   intent: '',
															   leads: '',
														   })}
														   title="Reset filters"
														   style={{
															   background: '#22325a',
															   color: '#fff',
															   border: '2px solid #fff',
															   borderRadius: 8,
															   fontWeight: 700,
															   fontSize: 15,
															   height: 38,
															   padding: '0 24px',
															   cursor: 'pointer',
															   boxShadow: '0 2px 8px rgba(10,22,40,0.13)',
															   transition: 'background 0.18s, color 0.18s, border 0.18s',
															   zIndex: 2,
															   display: 'flex',
															   alignItems: 'center',
														   }}
													   >
														   Reset
													   </button>
												   </div>
											   )}
										   </div>
									   )}
								   </div>
							   );
						   })()}

						<div style={{ overflowX: "auto", width: "100%" }}>
							<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, background: "#16213a" }}>
						<thead>
							<tr style={{ background: "#1b2947" }}>
								<th style={{ ...thStyle, maxWidth: 220, minWidth: 150 }}>Source Document</th>
								<th style={thStyle}>Length</th>
								<th style={thStyle}>Date</th>
								<th style={thStyle}>Key focus</th>
								<th style={thStyle}>Pipeline Intent</th>
								<th style={thStyle}>Lead</th>
								<th style={thStyle}></th>
								<th style={thStyle}></th>
								<th style={{ ...thStyle, position: 'sticky', right: 0, background: '#1b2947', zIndex: 2 }}>Brief</th>
							</tr>
						</thead>
						<tbody>
							{filteredRows.map((row, i) => (
								<React.Fragment key={i}>
									<tr style={{ background: "#16213a", borderBottom: "1px solid #22325a" }}>
										<td style={sourceDocTdStyle}>{row.sourceDocument}</td>
										<td style={tdStyle}>{row.engagementTime}</td>
										<td style={tdStyle}>{
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
										<td style={tdStyle}>{row.keyFocus}</td>
										<td style={tdStyle}>{row.intent}</td>
										<td style={tdStyle}>
											<span
												style={{
													color:
														row.lead.source === 'contact_requests'
															? '#2ecc40' // green
															: row.lead.source === 'summary_requests'
															? '#ffb347' // amber
															: undefined,
												}}
											>
												{row.lead.value}
											</span>
										</td>
										<td style={{ ...tdStyle, paddingRight: 4 }}>
											<button
												style={buttonStyle}
												onClick={() => setOpenDropdown(openDropdown === i ? null : i)}
												aria-expanded={openDropdown === i}
											>
												{openDropdown === i ? 'Hide Report' : 'View Report'}
											</button>
										</td>
										<td style={{ ...tdStyle, paddingLeft: 4, paddingRight: 4 }}>
											<button style={{ ...buttonStyle, background: '#525fe1', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
												<span style={{ display: 'inline-flex', alignItems: 'center' }}>
													<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
														<rect x="2" y="6" width="3" height="8" rx="1" fill="currentColor" />
														<rect x="8.5" y="3" width="3" height="14" rx="1" fill="currentColor" />
														<rect x="15" y="8" width="3" height="6" rx="1" fill="currentColor" />
													</svg>
												</span>
												Brief Me
											</button>
										</td>
										<td style={{ ...tdStyle, position: 'sticky', right: 0, background: '#16213a', zIndex: 1 }}>
											<span
												title="View Brief Report"
												style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, cursor: 'pointer' }}
												onClick={async (e) => {
													e.stopPropagation();
													console.log('[DEBUG] PDF icon clicked for row', i, row);
													try {
														const mod = await import('../../../utils/generateConversationPdf');
														if (mod && mod.generateConversationPdf) {
															console.log('[DEBUG] Calling generateConversationPdf with row:', row);
															await mod.generateConversationPdf(row);
															console.log('[DEBUG] PDF generation complete');
														} else {
															console.error('[ERROR] generateConversationPdf not found in module');
														}
													} catch (err) {
														console.error('[ERROR] PDF generation failed:', err);
													}
												}}
											>
												<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
													<rect x="4" y="2.5" width="14" height="17" rx="2.5" fill="#22325a" stroke="#a3c0ff" strokeWidth="1.2"/>
													<rect x="7" y="6.5" width="8" height="1.5" rx="0.75" fill="#a3c0ff"/>
													<rect x="7" y="10" width="8" height="1.5" rx="0.75" fill="#a3c0ff"/>
													<rect x="7" y="13.5" width="5" height="1.5" rx="0.75" fill="#a3c0ff"/>
												</svg>
											</span>
										</td>
									</tr>
														{openDropdown === i && (
															<tr>
																<td colSpan={9} style={{ padding: 0, background: "#10192b" }}>
																<div
																	style={{
																		padding: "18px 32px 18px 32px",
																		borderBottomLeftRadius: 12,
																		borderBottomRightRadius: 12,
																		border: "1px solid #22325a",
																		borderTop: "none",
																		boxShadow: "0 4px 18px rgba(10,22,40,0.18)",
																		animation: "slideDown 0.32s cubic-bezier(.4,2,.6,1)",
																	height: 420,
																	maxHeight: 420,
																		overflow: 'hidden',
																		display: 'flex',
																		flexDirection: 'column',
																	}}
																>
																		<div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
																			{reportDropdownOptions.map((opt) => {
																				const isSelected = selectedChip[i] === opt || (!selectedChip[i] && opt === reportDropdownOptions[0]);
																				return (
																					<span
																						key={opt}
																						style={{
																							display: "inline-block",
																							padding: "7px 18px",
																							borderRadius: 999,
																							background: isSelected ? "#2d406b" : "#22325a",
																							color: isSelected ? "#fff" : "#a3c0ff",
																							fontWeight: 600,
																							fontSize: 14,
																							cursor: "pointer",
																							boxShadow: isSelected ? "0 2px 12px #22325a" : "0 2px 8px rgba(10,22,40,0.13)",
																							border: isSelected ? "2px solid #7ea0e6" : "1px solid #2d406b",
																							transition: "background 0.18s, color 0.18s, border 0.18s"
																						}}
																						onClick={() => setSelectedChip((prev) => ({ ...prev, [i]: opt }))}
																					>
																						{opt}
																					</span>
																				);
																			})}
																		</div>
																		<div style={{ color: "#7ea0e6", fontSize: 15, minHeight: 32, paddingLeft: 2, flex: 1, overflowY: 'auto' }}>
																			{(() => {
																				const opt = selectedChip[i] || reportDropdownOptions[0];
																				if (opt === "Transcript") {
																					// Render transcript as chat interface
																									// Find the correct transcript for this row by matching a unique property (e.g., date, sourceDocument, etc.)
																									// Fallback to filteredRows[i] if unique property is not available
																									let transcript = filteredRows[i]?.transcript;
																									// Try to find the original row in insightsRows if transcript is missing
																									if (!transcript) {
																										const orig = insightsRows.find(r =>
																											r.date === filteredRows[i]?.date &&
																											r.sourceDocument === filteredRows[i]?.sourceDocument
																										);
																										transcript = orig?.transcript;
																									}
																									console.log('[DEBUG] Rendering transcript for row', i, transcript);
																													// If transcript is a string, parse it into chat messages
																													let chatMessages: { role: 'agent' | 'user', content: string }[] = [];
																													if (typeof transcript === 'string') {
																														// Split by double newlines, then by speaker
																														const lines = transcript.split(/\n\n+/);
																														let currentRole: 'agent' | 'user' | null = null;
																														let buffer = '';
																														lines.forEach((line) => {
																															const trimmed = line.trim();
																															if (/^Agent:/i.test(trimmed)) {
																																if (buffer && currentRole) {
																																	chatMessages.push({ role: currentRole, content: buffer.trim() });
																																}
																																currentRole = 'agent';
																																buffer = trimmed.replace(/^Agent:/i, '').trim();
																															} else if (/^User:/i.test(trimmed)) {
																																if (buffer && currentRole) {
																																	chatMessages.push({ role: currentRole, content: buffer.trim() });
																																}
																																currentRole = 'user';
																																buffer = trimmed.replace(/^User:/i, '').trim();
																															} else {
																																// Continuation of previous message
																																buffer += (buffer ? '\n' : '') + trimmed;
																															}
																														});
																														if (buffer && currentRole) {
																															chatMessages.push({ role: currentRole, content: buffer.trim() });
																														}
																													} else if (Array.isArray(transcript)) {
																														chatMessages = transcript;
																													}
																													if (!chatMessages.length) {
																														return <div>
																															<span style={{ color: '#a3c0ff' }}>No transcript available.</span>
																															<pre style={{ color: '#ffb347', background: '#222', fontSize: 12, marginTop: 8, padding: 8, borderRadius: 6 }}>
																																{typeof transcript === 'undefined' ? 'transcript: undefined' : 'transcript: ' + JSON.stringify(transcript, null, 2)}
																															</pre>
																														</div>;
																													}
																													return (
																														<div>
																															<div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, marginBottom: 8 }}>
																																{chatMessages.map((msg, idx) => {
																																					const isAgent = msg.role === 'agent';
																																					// Reverse: Agent on left, User on right
																																									return (
																																										<div key={idx} style={{
																																											display: 'flex',
																																											flexDirection: isAgent ? 'row' : 'row-reverse',
																																											alignItems: 'flex-start',
																																											gap: 10,
																																											marginBottom: 2,
																																										}}>
																																											<div style={{ display: 'flex', flexDirection: 'column', alignItems: isAgent ? 'flex-start' : 'flex-end', maxWidth: 420 }}>
																																																	<span style={{
																																																		fontWeight: 700,
																																																		fontSize: 13,
																																																		opacity: 0.7,
																																																		marginBottom: 4,
																																																		color: isAgent ? '#7ea0e6' : '#a3c0ff',
																																																		letterSpacing: 0.2,
																																																	}}>
																																																		{isAgent ? 'Agent' : 'User'}
																																																	</span>
																																												<div style={{
																																													background: isAgent ? '#22325a' : '#2d406b',
																																													color: isAgent ? '#a3c0ff' : '#fff',
																																													borderRadius: 16,
																																													padding: '10px 16px',
																																													maxWidth: 420,
																																													fontSize: 15,
																																													boxShadow: isAgent ? '0 2px 8px rgba(10,22,40,0.13)' : '0 2px 12px #22325a',
																																													border: isAgent ? '1px solid #2d406b' : '2px solid #7ea0e6',
																																													marginLeft: isAgent ? 0 : 32,
																																													marginRight: isAgent ? 32 : 0,
																																													wordBreak: 'break-word',
																																												}}>
																																													{msg.content}
																																												</div>
																																											</div>
																																										</div>
																																									);
																																})}
																															</div>
																														</div>
																													);
																				}
																				// Fallback for other chips
																				switch (opt) {
																					case "Questions": {
																						// Render questions as a list
																						let questions = filteredRows[i]?.questions;
																						if (!questions) {
																							const orig = insightsRows.find(r =>
																								r.date === filteredRows[i]?.date &&
																								r.sourceDocument === filteredRows[i]?.sourceDocument
																							);
																							questions = orig?.questions;
																						}
																						if (!questions || (Array.isArray(questions) && questions.length === 0)) {
																							return <span style={{ color: '#a3c0ff' }}>No questions available.</span>;
																						}
																						// If questions is a string, try to parse as JSON
																						if (typeof questions === 'string') {
																							try {
																								questions = JSON.parse(questions);
																							} catch {
																								// fallback: show as plain text
																								return <pre style={{ color: '#ffb347', background: '#222', fontSize: 13, padding: 8, borderRadius: 6 }}>{questions}</pre>;
																							}
																						}
																						if (Array.isArray(questions)) {
																							return (
																								<ul style={{ color: '#a3c0ff', paddingLeft: 0, margin: 0, marginTop: 16 }}>
																									{questions.map((q, idx) => (
																										<li key={idx} style={{ marginBottom: 10, background: '#22325a', borderRadius: 10, padding: '10px 16px', color: '#a3c0ff', fontSize: 15, listStyle: 'none', marginTop: idx === 0 ? 0 : 0 }}>
																											{typeof q === 'string' ? q : JSON.stringify(q)}
																										</li>
																									))}
																								</ul>
																							);
																						}
																						// fallback: show as JSON
																						return <pre style={{ color: '#ffb347', background: '#222', fontSize: 13, padding: 8, borderRadius: 6 }}>{JSON.stringify(questions, null, 2)}</pre>;
																					}
																					case "Insights": {
																						// Render insights fields
																						let row = filteredRows[i];
																						if (!row) {
																							row = insightsRows.find(r =>
																								r.date === filteredRows[i]?.date &&
																								r.sourceDocument === filteredRows[i]?.sourceDocument
																							) || {} as InsightsRow;
																						}
																						if (!row) return <span style={{ color: '#a3c0ff' }}>No insights available.</span>;

																						// Helper to render JSONB fields as pretty lists or fallback
																						function renderJsonbField(field: any) {
																							if (!field) return <span style={{ color: '#a3c0ff' }}>None</span>;
																							if (typeof field === 'string') {
																								try {
																									const parsed = JSON.parse(field);
																									field = parsed;
																								} catch {
																									return <pre style={{ color: '#ffb347', background: '#222', fontSize: 13, padding: 8, borderRadius: 6 }}>{field}</pre>;
																								}
																							}
																							if (Array.isArray(field)) {
																								return (
																									<ul style={{ color: '#a3c0ff', paddingLeft: 18, margin: 0 }}>
																										{field.map((item, idx) => (
																											<li key={idx} style={{ marginBottom: 4 }}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
																										))}
																									</ul>
																								);
																							}
																							if (typeof field === 'object') {
																								return <pre style={{ color: '#a3c0ff', background: '#22325a', fontSize: 13, padding: 8, borderRadius: 6 }}>{JSON.stringify(field, null, 2)}</pre>;
																							}
																							return String(field);
																						}

																						return (
																							<div style={{ width: '100%', marginTop: 18 }}>
																								{/* Transcript Summary */}
																								<div style={{ background: '#22325a', borderRadius: 10, padding: '14px 18px', color: '#fff', fontSize: 16, fontWeight: 500, marginBottom: 24 }}>
																									{row.transcript_summary || <span style={{ color: '#a3c0ff' }}>No transcript summary available.</span>}
																								</div>
																								{/* Grid for the other four fields */}
																								<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
																									<div style={{ background: '#22325a', borderRadius: 10, padding: '12px 16px', color: '#a3c0ff', minHeight: 80 }}>
																										<div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Main Topics</div>
																										{renderJsonbField(row.main_topics)}
																									</div>
																									<div style={{ background: '#22325a', borderRadius: 10, padding: '12px 16px', color: '#a3c0ff', minHeight: 80 }}>
																										<div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Content Gaps</div>
																										{renderJsonbField(row.content_gaps)}
																									</div>
																									<div style={{ background: '#22325a', borderRadius: 10, padding: '12px 16px', color: '#a3c0ff', minHeight: 80 }}>
																										<div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Intent Reasoning</div>
																										{renderJsonbField(row.pipeline_intent_reasoning)}
																									</div>
																									<div style={{ background: '#22325a', borderRadius: 10, padding: '12px 16px', color: '#a3c0ff', minHeight: 80 }}>
																										<div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Competitive Comparison</div>
																										{renderJsonbField(row.competitive_comparison_summary)}
																									</div>
																								</div>
																							</div>
																						);
																					}
																					case "Metadata": {
																						let row = filteredRows[i];
																						if (!row) {
																							row = insightsRows.find(r =>
																								r.date === filteredRows[i]?.date &&
																								r.sourceDocument === filteredRows[i]?.sourceDocument
																							) || {} as InsightsRow;
																						}
																						return (
																							<div style={{ color: '#a3c0ff', fontSize: 15, marginTop: 18 }}>
																								Main language: {row.main_language || <span style={{ color: '#7ea0e6' }}>Unknown</span>}
																							</div>
																						);
																					}
																					default:
																						return "Sample content.";
																				}
																			})()}
																		</div>
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
						</div>
				</main>
	   );
}

const thStyle = {
  textAlign: "left" as const,
  padding: "10px 8px",
  color: "#a3c0ff",
  fontSize: 13,
  fontWeight: 700,
  borderBottom: "1px solid #22325a",
  background: "#1b2947",
  position: "sticky" as const,
  top: 0,
  zIndex: 1,
};

const sourceDocTdStyle = {
    ...tdStyle,
    maxWidth: 220,
    minWidth: 150,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    paddingBottom: 0,
  };
