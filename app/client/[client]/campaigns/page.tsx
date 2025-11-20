"use client";

import { KeyboardEvent, useState } from "react";
const responsesIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#091F5B" viewBox="0 0 16 16">
    <path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z" />
  </svg>
);
const newIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#001F3F" viewBox="0 0 16 16">
    <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z" />
  </svg>
);
import Image from "next/image";
import Sidebar from "@/app/client/[client]/Sidebar";
import Topbar from "@/app/components/Topbar";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";
const placeholderImages = [
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiNlMGU3ZmYiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiNkYmVhZmUiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiNjYmQ1ZjUiLz48L3N2Zz4=",
];

type CampaignSection = {
  title: string;
  description: string;
};

const overviewHighlights = [
  "Recording scheduled within 48 hours",
  "Persona brief (v2)",
  "Script outline",
  "Recent transcript",
];

const researchHighlights = [
  "Conversion uplift +12% vs baseline",
  "Verbatim snippets matched persona tone",
  "Latest insights sync weekly",
];

export default function ResultsPage() {
  const metrics = [
    { label: "Results", value: "48", icon: responsesIcon },
    { label: "New", value: "15", icon: newIcon },
  ];
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [resultsOverlaySection, setResultsOverlaySection] = useState<CampaignSection | null>(null);
  const [isResultsOverlayOpen, setIsResultsOverlayOpen] = useState(false);
  const sections: CampaignSection[] = [
    {
      title: "Active campaigns",
      description: "Monitor ongoing plays and their status at a glance.",
    },
    {
      title: "Upcoming campaigns",
      description: "Prepare briefs, assign personas, and queue recordings.",
    },
    {
      title: "Recent reports",
      description: "Review insights, transcripts, and executive summaries.",
    },
  ];
  const toggleCard = (title: string) => {
    setOpenCard((prev) => (prev === title ? null : title));
  };
  const columnFlex = "1 1 0";
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
      }}
    >
      <Sidebar />
      <Topbar
        title="Campaigns"
        offsetLeft="var(--sidebar-width)"
        hideAdminView
        hideProfileAvatar
      />
      <main
        style={{
          marginLeft: "var(--sidebar-width)",
          padding: "80px 48px 40px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {sections.map((container) => {
          const isOpen = openCard === container.title;
          return (
            <section
              key={container.title}
              className="campaign-card"
              style={{
                width: "100%",
                background: "#f8f9ff",
                borderRadius: "18px",
                padding: "32px",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                cursor: "pointer",
              }}
              onClick={() => toggleCard(container.title)}
              onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleCard(container.title);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  width: "100%",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    flex: columnFlex,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjY2JkNWY1Ii8+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMTYiIGZpbGw9IiM5NGEzYjgiLz48L3N2Zz4="
                      width={48}
                      height={48}
                      alt="Campaign placeholder"
                      unoptimized
                      priority
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{container.title}</h2>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "rgba(15, 23, 42, 0.7)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {container.description}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flex: columnFlex,
                    minWidth: 0,
                    marginLeft: "auto",
                    justifyContent: "flex-end",
                  }}
                >
                  {metrics.map((metric) => (
                    <div
                      key={metric.label}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "2px",
                        minWidth: 64,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "14px",
                          color: "rgba(15,23,42,0.6)",
                        }}
                      >
                        {metric.icon}
                        <span
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: "#091F5B",
                          }}
                        >
                          {metric.value}
                        </span>
                      </span>
                      <span style={{ fontSize: "12px", color: "rgba(15,23,42,0.5)" }}>{metric.label}</span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    flex: columnFlex,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "0",
                    minWidth: 0,
                  }}
                >
                  {placeholderImages.map((src, index) => (
                    <div
                      key={`${src}-${index}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        marginLeft: index === 0 ? 0 : -6,
                      }}
                    >
                      <Image
                        src={src}
                        width={32}
                        height={32}
                        alt={`Placeholder icon ${index + 1}`}
                        unoptimized
                        style={{
                          borderRadius: "50%",
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    flex: columnFlex,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 0,
                  }}
                >
                  <button
                    type="button"
                    style={{
                      border: "none",
                      borderRadius: "999px",
                      padding: "6px 16px",
                      background: "rgba(15, 23, 42, 0.08)",
                      color: "#0f172a",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setResultsOverlaySection(container);
                      setIsResultsOverlayOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        setResultsOverlaySection(container);
                        setIsResultsOverlayOpen(true);
                      }
                    }}
                  >
                    View Results
                  </button>
                </div>
              </div>
              {isOpen && (
                <div
                  className="campaign-dropdown-details"
                  style={{
                    borderRadius: "14px",
                    padding: "0",
                    marginTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0",
                  }}
                >
                  <div className="persona-expanded-track campaign-dropdown-track">
                    <div className="persona-expanded-block persona-expanded-block--description">
                      <div className="persona-expanded-block__header">
                        <h4>Campaign overview</h4>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          width: "100%",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: "14px", color: "rgba(15, 23, 42, 0.7)" }}>
                          Recording scheduled within 48h
                        </p>
                      </div>
                    </div>
                    <div className="persona-expanded-block persona-expanded-block--documents">
                      <div className="persona-expanded-block__header">
                        <h4>Questions</h4>
                      </div>
                      <div className="persona-expanded-block__list-wrapper">
                        <ul>
                          <li>Persona brief (v2)</li>
                          <li>Script outline</li>
                          <li>Recent transcript</li>
                        </ul>
                      </div>
                    </div>
                    <div className="persona-expanded-block persona-expanded-block--external">
                      <div className="persona-expanded-block__header">
                        <h4>Supporting research</h4>
                      </div>
                      <div className="persona-expanded-block__list-wrapper">
                        <ul>
                          <li>Conversion uplift +12% vs baseline</li>
                          <li>Verbatim snippets matched persona tone</li>
                          <li>Latest insights synced weekly</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </main>
      <style jsx>{`
        .campaign-card {
          transition: transform 0.24s ease, box-shadow 0.24s ease;
        }
        .campaign-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 26px 48px rgba(15, 23, 42, 0.12);
        }
      `}</style>
      <SlidingPanelOverlay
        open={isResultsOverlayOpen}
        onRequestClose={() => setIsResultsOverlayOpen(false)}
        onAfterClose={() => setResultsOverlaySection(null)}
        title={
          resultsOverlaySection
            ? `${resultsOverlaySection.title} results`
            : "Campaign results"
        }
        description={
          resultsOverlaySection
            ? `Latest takeaways for ${resultsOverlaySection.title.toLowerCase()}.`
            : "Explore the latest outcomes across your campaigns."
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            {metrics.map((metric) => (
              <div
                key={`overlay-metric-${metric.label}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  minWidth: 120,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "14px",
                    color: "rgba(15,23,42,0.6)",
                  }}
                >
                  {metric.icon}
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: "#091F5B",
                    }}
                  >
                    {metric.value}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "rgba(15,23,42,0.58)",
                  }}
                >
                  {metric.label}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                Highlights
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  color: "rgba(15,23,42,0.75)",
                }}
              >
                {overviewHighlights.map((point) => (
                  <li key={point} style={{ margin: 0 }}>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                Supporting research
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  color: "rgba(15,23,42,0.75)",
                }}
              >
                {researchHighlights.map((point) => (
                  <li key={point} style={{ margin: 0 }}>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </SlidingPanelOverlay>
    </div>
  );
}