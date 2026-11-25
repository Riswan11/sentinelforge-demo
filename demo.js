"use strict";

const element = (id) => document.getElementById(id);
const storageKey = "sentinelforge-demo-decisions-v1";
let activeCase;
let selectedCase;
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
  const saved = decisions[activeCase.slug];
  const disposition = typeof saved === "string" ? saved : saved?.disposition;
  element("disposition").value = disposition || "";
  element("notes").value = saved?.notes || "";
  element("decision-status").textContent = message || (disposition ? "Saved disposition: " + disposition : "");
}

function selectCase(report) {
  selectedCase = report;
  activeCase = undefined;
  for (const button of element("cases").children) {
    button.setAttribute("aria-current", String(button.dataset.slug === report.slug));
  }
  element("intake-title").value = report.title;
  element("intake-principal").value = report.principal;
  element("intake-records").value = JSON.stringify({Records: report.records}, null, 2);
  element("investigate").disabled = false;
  element("report").hidden = true;
  element("status").textContent = "Review the finding details, then select Investigate to open its report.";
}

function showCase(report) {
  activeCase = report;
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
    const source = report.records.find((record) => record.eventID === item.id);
    append(details, "pre", JSON.stringify({source_record: source, normalized_evidence: item}, null, 2));
  }
  const first = report.evidence[0].observed_at;
  const last = report.evidence[report.evidence.length - 1].observed_at;
  element("scope").textContent = report.evidence.length + " matched events on " + first.slice(0, 10)
    + " from " + first.slice(11, 19) + " to " + last.slice(11, 19) + " UTC in the bundled sample.";
  element("targets").textContent = "Observed targets: " + risk.observed_targets.join(", ");
  const questions = element("questions");
  questions.replaceChildren();
  for (const question of risk.open_questions) append(questions, "li", question);
  element("advisory").textContent = report.action ? report.action.summary : "This case has no containment advisory.";
  showDecision();
  element("status").textContent = "";
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

element("intake").addEventListener("submit", (event) => {
  event.preventDefault();
  if (selectedCase) showCase(selectedCase);
});

element("review").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = element("disposition").value;
  decisions[activeCase.slug] = {disposition: value, notes: element("notes").value.trim()};
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
      selectCase(report);
    });
  }
  const linked = reports.find((report) => report.evidence.some((item) => "#event-" + item.id === location.hash));
  selectCase(linked || reports[0]);
  if (linked) {
    showCase(linked);
    const row = element(location.hash.slice(1));
    row.querySelector("details").open = true;
    row.scrollIntoView();
  }
}

loadCases().catch(() => {
  element("status").textContent = "Could not load the demo cases. Refresh the page to try again.";
});
