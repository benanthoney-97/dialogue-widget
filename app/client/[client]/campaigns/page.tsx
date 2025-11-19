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

export default function ResultsPage() {
  const metrics = [
    { label: "Results", value: "48", icon: responsesIcon },
    { label: "New", value: "15", icon: newIcon },
  ];
  const [openCard, setOpenCard] = useState<string | null>(null);
  const sections = [
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
                  >
                    View Results
                  </button>
                </div>
                <div
                  style={{
                    flex: columnFlex,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "16px",
                    minWidth: 0,
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#22325A" viewBox="0 0 16 16">
                    <path d="M2 2h2v2H2z" />
                    <path d="M6 0v6H0V0zM5 1H1v4h4zM4 12H2v2h2z" />
                    <path d="M6 10v6H0v-6zm-5 1v4h4v-4zm11-9h2v2h-2z" />
                    <path d="M10 0v6h6V0zm5 1v4h-4V1zM8 1V0h1v2H8v2H7V1zm0 5V4h1v2zM6 8V7h1V6h1v2h1V7h5v1h-4v1H7V8zm0 0v1H2V8H1v1H0V7h3v1zm10 1h-1V7h1zm-1 0h-1v2h2v-1h-1zm-4 0h2v1h-1v1h-1zm2 3v-1h-1v1h-1v1H9v1h3v-2zm0 0h3v1h-2v1h-1zm-4-1v1h1v-2H7v1z" />
                    <path fillRule="evenodd" d="M7 12h1v3h4v1H7zm9 2v2h-3v-1h2v-1z" />
                  </svg>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#22325A" viewBox="0 0 16 16">
                    <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z" />
                    <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z" />
                  </svg>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#22325A" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z" />
                  </svg>
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
    </div>
  );
}