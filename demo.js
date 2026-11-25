"use strict";

const element = (id) => document.getElementById(id);
const storageKey = "sentinelforge-demo-decisions-v1";
let activeCase;
let decisions = {};
try {
  decisions = JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
} catch {
  // Continue with in-memory decisions when browser storage is unavailable.
}

function append(parent, tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  parent.append(node);
  return node;
}

function showDecision(message = "") {
  const value = decisions[activeCase.slug] || "";
  element("disposition").value = value;
  element("decision-status").textContent = message || (value ? "Saved disposition: " + value : "");
}

function showCase(report) {
  activeCase = report;
  for (const button of element("cases").children) {
    button.setAttribute("aria-current", String(button.dataset.slug === report.slug));
  }
  element("case-title").textContent = report.title;
  element("principal").textContent = report.principal;
  element("context").textContent = report.context;
  const risk = report.assessment;
  const badge = element("severity");
  badge.className = "badge " + risk.severity;
  badge.textContent = risk.severity.toUpperCase() + " · " + risk.score + "/" + risk.score_max;
  const findings = element("findings");
  findings.replaceChildren();
  for (const claim of risk.claims) {
    const row = append(findings, "li", claim.summary + " · ");
    for (const id of claim.evidence_ids) {
      const link = append(row, "a", id);
      link.href = "#event-" + id;
      link.addEventListener("click", () => {
        const event = element("event-" + id);
        event.querySelector("details").open = true;
        event.focus({preventScroll: true});
      });
      row.append(" ");
    }
  }
  const timeline = element("timeline");
  timeline.replaceChildren();
  for (const item of report.evidence) {
    const row = append(timeline, "li", "");
    row.id = "event-" + item.id;
    row.tabIndex = -1;
    const details = append(row, "details", "");
    append(details, "summary", item.observed_at.slice(11, 19) + " · " + item.event + (item.target ? " · " + item.target : ""));
    append(details, "pre", JSON.stringify(item, null, 2));
  }
  element("advisory").textContent = report.action ? report.action.summary : "This case has no containment advisory.";
  showDecision();
  element("report").hidden = false;
}

function save(message) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(decisions));
    showDecision(message);
  } catch {
    showDecision(message + " Browser storage is unavailable, so this change lasts until you reload.");
  }
}

element("review").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = element("disposition").value;
  decisions[activeCase.slug] = value;
  save("Saved disposition: " + value + ".");
});

element("reset").addEventListener("click", () => {
  delete decisions[activeCase.slug];
  save("Decision cleared for this case.");
});

async function loadCases() {
  const response = await fetch("./cases.json");
  if (!response.ok) throw new Error("Unable to load sample cases.");
  const reports = await response.json();
  for (const report of reports) {
    const button = append(element("cases"), "button", report.title);
    button.dataset.slug = report.slug;
    button.addEventListener("click", () => {
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      showCase(report);
    });
  }
  const linked = reports.find((report) => report.evidence.some((item) => "#event-" + item.id === location.hash));
  showCase(linked || reports[0]);
  if (linked) {
    const row = element(location.hash.slice(1));
    row.querySelector("details").open = true;
    row.scrollIntoView();
  }
  element("status").textContent = "";
}

loadCases().catch(() => {
  element("status").textContent = "Could not load the demo cases. Refresh the page to try again.";
});
