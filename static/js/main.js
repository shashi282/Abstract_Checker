/**
 * AbstractAI — Frontend Logic
 * Modern AI SaaS interface with dark mode, expandable sections,
 * animated radial score, loading steps, FAQ, mobile nav, PDF export.
 */

"use strict";

/* ─── DOM references ─────────────────────────────────────────────── */
const abstractInput   = document.getElementById("abstractInput");
const charCounter     = document.getElementById("charCounter");
const evaluateBtn     = document.getElementById("evaluateBtn");
const validationError = document.getElementById("validationError");
const loadingOverlay  = document.getElementById("loadingOverlay");
const resultsSection  = document.getElementById("resultsSection");
const errorBanner     = document.getElementById("errorBanner");
const errorMessage    = document.getElementById("errorMessage");
const themeToggle     = document.getElementById("themeToggle");
const navBurger       = document.getElementById("navBurger");
const navLinks        = document.getElementById("navLinks");
const navbar          = document.getElementById("navbar");

/* ─── Loading step elements ──────────────────────────────────────── */
const lsteps = [
  document.getElementById("step1"),
  document.getElementById("step2"),
  document.getElementById("step3"),
];

/* ─── App state ──────────────────────────────────────────────────── */
let lastEvaluation = null;
let lastAbstractText = "";
let stepTimers = [];

/* ══════════════════════════════════════════════════════════════════
   DARK MODE
══════════════════════════════════════════════════════════════════ */

function initTheme() {
  const saved = localStorage.getItem("abstractai-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("abstractai-theme", next);
}

themeToggle.addEventListener("click", toggleTheme);
initTheme();

/* ══════════════════════════════════════════════════════════════════
   NAVBAR — scroll shadow + mobile burger
══════════════════════════════════════════════════════════════════ */

window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 10);
}, { passive: true });

navBurger.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  navBurger.setAttribute("aria-expanded", String(isOpen));
});

// Close mobile menu on nav link click
navLinks.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navBurger.setAttribute("aria-expanded", "false");
  });
});

/* ══════════════════════════════════════════════════════════════════
   SCROLL REVEAL (Intersection Observer)
══════════════════════════════════════════════════════════════════ */

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("revealed");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

document.querySelectorAll("[data-reveal]").forEach(el => revealObserver.observe(el));

/* ══════════════════════════════════════════════════════════════════
   FAQ ACCORDION
══════════════════════════════════════════════════════════════════ */

document.querySelectorAll(".faq-question").forEach(btn => {
  btn.addEventListener("click", () => {
    const item = btn.closest(".faq-item");
    const isOpen = item.classList.contains("open");

    // Close all
    document.querySelectorAll(".faq-item.open").forEach(openItem => {
      openItem.classList.remove("open");
      openItem.querySelector(".faq-question").setAttribute("aria-expanded", "false");
    });

    // Toggle clicked
    if (!isOpen) {
      item.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    }
  });
});

/* ══════════════════════════════════════════════════════════════════
   EXPANDABLE SECTIONS (dashboard cards)
══════════════════════════════════════════════════════════════════ */

document.addEventListener("click", e => {
  const toggle = e.target.closest(".expand-toggle");
  if (!toggle) return;

  const targetId = toggle.dataset.target;
  const body = document.getElementById(targetId);
  if (!body) return;

  const isOpen = body.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(isOpen));
});

/* ══════════════════════════════════════════════════════════════════
   CHARACTER COUNTER
══════════════════════════════════════════════════════════════════ */

abstractInput.addEventListener("input", () => {
  const len = abstractInput.value.length;
  charCounter.textContent = `${len.toLocaleString()} character${len !== 1 ? "s" : ""}`;
  if (len > 0) hideValidationError();
});

/* ══════════════════════════════════════════════════════════════════
   LOADING STEPS ANIMATION
══════════════════════════════════════════════════════════════════ */

function startLoadingSteps() {
  lsteps.forEach(s => { s.classList.remove("active", "done"); });
  lsteps[0].classList.add("active");
  const INTERVAL = 3800;
  for (let i = 1; i < lsteps.length; i++) {
    const t = setTimeout(() => {
      lsteps[i - 1].classList.remove("active");
      lsteps[i - 1].classList.add("done");
      lsteps[i].classList.add("active");
    }, INTERVAL * i);
    stepTimers.push(t);
  }
}

function stopLoadingSteps() {
  stepTimers.forEach(clearTimeout);
  stepTimers = [];
  lsteps.forEach(s => s.classList.remove("active", "done"));
}

/* ══════════════════════════════════════════════════════════════════
   SHOW / HIDE HELPERS
══════════════════════════════════════════════════════════════════ */

function showLoading() {
  loadingOverlay.classList.remove("hidden");
  evaluateBtn.disabled = true;
  document.getElementById("evaluateBtn").querySelector(".btn-evaluate-text").textContent = "Evaluating…";
  startLoadingSteps();
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
  evaluateBtn.disabled = false;
  document.getElementById("evaluateBtn").querySelector(".btn-evaluate-text").textContent = "Evaluate Abstract";
  stopLoadingSteps();
}

function showValidationError(msg) {
  validationError.textContent = msg;
  validationError.classList.remove("hidden");
}

function hideValidationError() {
  validationError.classList.add("hidden");
}

function showErrorBanner(msg) {
  errorMessage.textContent = msg;
  errorBanner.classList.remove("hidden");
}

function dismissError() {
  errorBanner.classList.add("hidden");
}

/* ══════════════════════════════════════════════════════════════════
   MAIN EVALUATE
══════════════════════════════════════════════════════════════════ */

async function evaluateAbstract() {
  const text = abstractInput.value.trim();

  if (!text) {
    showValidationError("Please paste a research abstract before evaluating.");
    abstractInput.focus();
    return;
  }
  if (text.length < 50) {
    showValidationError("Your abstract is too short (minimum 50 characters). Please provide a complete abstract.");
    abstractInput.focus();
    return;
  }

  hideValidationError();
  dismissError();
  resultsSection.classList.add("hidden");

  showLoading();

  try {
    const response = await fetch("/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ abstract: text }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || `Server error (HTTP ${response.status})`);
    }

    lastEvaluation = data.evaluation;
    lastAbstractText = text;
    renderResults(data.evaluation, text);

  } catch (err) {
    showErrorBanner(err.message || "An unexpected error occurred. Please try again.");
  } finally {
    hideLoading();
  }
}

/* ══════════════════════════════════════════════════════════════════
   RESET
══════════════════════════════════════════════════════════════════ */

function resetForm() {
  resultsSection.classList.add("hidden");
  abstractInput.value = "";
  charCounter.textContent = "0 characters";
  hideValidationError();
  dismissError();
  lastEvaluation = null;
  lastAbstractText = "";

  document.getElementById("checker").scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => abstractInput.focus(), 600);
}

/* ══════════════════════════════════════════════════════════════════
   RENDER RESULTS
══════════════════════════════════════════════════════════════════ */

/**
 * Orchestrate rendering of all dashboard sections.
 * @param {Object} ev   Evaluation JSON from backend
 * @param {string} text Original abstract text
 */
function renderResults(ev, text) {
  renderTypeCard(ev.abstract_type);
  renderComponents(ev.detected_components);
  renderOverallScore(ev.quality_scores);
  renderScores(ev.quality_scores);
  renderAssessment(ev.overall_assessment);
  renderFeedbackList("strengthsList", ev.strengths, "strengths");
  renderFeedbackList("weaknessesList", ev.weaknesses, "weaknesses");
  renderRecommendations(ev.recommendations);

  // Dashboard subtitle
  document.getElementById("resultsSubtitle").textContent =
    `${text.length.toLocaleString()} chars · ${ev.abstract_type} abstract`;

  // Make all expandable bodies open
  document.querySelectorAll(".expandable").forEach(el => el.classList.add("open"));
  document.querySelectorAll(".expand-toggle").forEach(t => t.setAttribute("aria-expanded", "true"));

  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ── Abstract Type card ─────────────────────────────────────────── */
function renderTypeCard(type) {
  const badge      = document.getElementById("abstractTypeBadge");
  const desc       = document.getElementById("typeDescription");
  const isStruct   = (type || "").toLowerCase().includes("structured") &&
                     !(type || "").toLowerCase().includes("unstructured");

  badge.innerHTML = `
    <div class="type-badge ${isStruct ? "structured" : "unstructured"}">
      ${isStruct ? "Structured" : "Unstructured"}
    </div>
    <div class="type-icon-badge ${isStruct ? "structured" : "unstructured"}">
      ${isStruct
        ? '<svg viewBox="0 0 16 16" fill="none" style="width:13px;height:13px"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> IMRAD Format'
        : '<svg viewBox="0 0 16 16" fill="none" style="width:13px;height:13px"><path d="M3 5h10M3 8h10M3 11h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Prose Format'
      }
    </div>`;

  desc.textContent = isStruct
    ? "Contains clearly labelled IMRAD sections, aiding indexing and reader comprehension."
    : "Written as continuous prose. Adding explicit section labels (Background, Methods, etc.) would improve clarity.";
}

/* ── Detected Components ────────────────────────────────────────── */
function renderComponents(components) {
  const list = document.getElementById("componentList");
  list.innerHTML = "";

  ["Background", "Objective", "Methodology", "Results", "Conclusion"].forEach(name => {
    const present = components[name] === true;
    const li = document.createElement("li");
    li.className = "component-item";
    li.innerHTML = `
      <span class="component-name">${name}</span>
      <span class="component-tag ${present ? "present" : "absent"}">${present ? "✓ Present" : "✗ Missing"}</span>`;
    list.appendChild(li);
  });
}

/* ── Radial Overall Score ────────────────────────────────────────── */
function renderOverallScore(scores) {
  const values = Object.values(scores || {}).map(Number).filter(n => !isNaN(n));
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

  const circumference = 238.76; // 2π × r(38)
  const offset = circumference - (avg / 100) * circumference;

  const fill   = document.getElementById("radialFill");
  const number = document.getElementById("radialNumber");
  const grade  = document.getElementById("overallGrade");

  number.textContent = avg;

  // Colour band
  let band, gradeLabel, gradeClass;
  if (avg >= 80) { band = "grade-high";   gradeLabel = "Excellent"; gradeClass = "grade-excellent"; }
  else if (avg >= 65) { band = "grade-medium"; gradeLabel = "Good";      gradeClass = "grade-good"; }
  else if (avg >= 45) { band = "grade-medium"; gradeLabel = "Fair";      gradeClass = "grade-fair"; }
  else               { band = "grade-low";    gradeLabel = "Needs Work"; gradeClass = "grade-poor"; }

  fill.setAttribute("class", `radial-fill ${band}`);

  // Animate after paint
  requestAnimationFrame(() => {
    setTimeout(() => { fill.style.strokeDashoffset = offset; }, 100);
  });

  grade.className = `overall-grade ${gradeClass}`;
  grade.textContent = gradeLabel;
}

/* ── Quality Score Cards ─────────────────────────────────────────── */
function renderScores(scores) {
  const grid = document.getElementById("scoresGrid");
  grid.innerHTML = "";

  const labelMap = {
    Structure:             "Structure",
    Clarity:               "Clarity",
    Completeness:          "Completeness",
    Technical_Depth:       "Technical Depth",
    Novelty:               "Novelty",
    Publication_Readiness: "Pub. Readiness",
  };

  Object.entries(scores).forEach(([key, rawVal]) => {
    const value = Number(rawVal) || 0;
    const band  = value >= 75 ? "high" : value >= 50 ? "medium" : "low";
    const label = labelMap[key] || key.replace(/_/g, " ");

    const card = document.createElement("div");
    card.className = `score-card score-${band}`;
    card.innerHTML = `
      <div class="score-header">
        <span class="score-name">${escapeHtml(label)}</span>
        <span class="score-value">${value}</span>
      </div>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:0%" data-target="${value}"></div>
      </div>`;
    grid.appendChild(card);
  });

  // Animate bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      grid.querySelectorAll(".score-bar-fill").forEach(bar => {
        bar.style.width = `${bar.dataset.target}%`;
      });
    }, 80);
  });
}

/* ── Overall Assessment ─────────────────────────────────────────── */
function renderAssessment(text) {
  document.getElementById("overallAssessment").textContent =
    text || "No overall assessment was provided.";
}

/* ── Strengths / Weaknesses ─────────────────────────────────────── */
/**
 * @param {string}   elId   Target <ul> element id
 * @param {string[]} items  Array of feedback strings
 * @param {string}   type   "strengths" | "weaknesses"
 */
function renderFeedbackList(elId, items, type) {
  const list = document.getElementById(elId);
  list.innerHTML = "";
  const safe = Array.isArray(items) && items.length ? items : ["No specific items identified."];
  safe.forEach(text => {
    const li = document.createElement("li");
    li.className = "feedback-item";
    li.innerHTML = `
      <span class="feedback-bullet">${type === "strengths" ? "✓" : "✗"}</span>
      <span>${escapeHtml(text)}</span>`;
    list.appendChild(li);
  });
}

/* ── Recommendations ────────────────────────────────────────────── */
function renderRecommendations(recs) {
  const list = document.getElementById("recommendationsList");
  list.innerHTML = "";
  const safe = Array.isArray(recs) && recs.length ? recs : ["No specific recommendations generated."];
  safe.forEach((text, idx) => {
    const li = document.createElement("li");
    li.className = "rec-item";
    li.innerHTML = `
      <span class="rec-number">${idx + 1}</span>
      <span class="rec-text">${escapeHtml(text)}</span>`;
    list.appendChild(li);
  });
}

/* ══════════════════════════════════════════════════════════════════
   PDF DOWNLOAD
   Uses window.print() with a print-specific stylesheet injected
   dynamically so the user gets a clean, formatted PDF.
══════════════════════════════════════════════════════════════════ */

function downloadPDF() {
  if (!lastEvaluation) return;

  const ev = lastEvaluation;
  const scores = ev.quality_scores || {};
  const values = Object.values(scores).map(Number).filter(n => !isNaN(n));
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const labelMap = {
    Structure: "Structure", Clarity: "Clarity", Completeness: "Completeness",
    Technical_Depth: "Technical Depth", Novelty: "Novelty",
    Publication_Readiness: "Publication Readiness",
  };

  const scoreRows = Object.entries(scores).map(([k, v]) =>
    `<tr><td>${escapeHtml(labelMap[k] || k.replace(/_/g, " "))}</td><td><b>${v}/100</b></td></tr>`
  ).join("");

  const compRows = ["Background", "Objective", "Methodology", "Results", "Conclusion"].map(c =>
    `<tr><td>${c}</td><td style="color:${ev.detected_components[c] ? "#16a34a" : "#dc2626"}">${ev.detected_components[c] ? "✓ Present" : "✗ Missing"}</td></tr>`
  ).join("");

  const strengthItems = (ev.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  const weaknessItems = (ev.weaknesses || []).map(w => `<li>${escapeHtml(w)}</li>`).join("");
  const recItems = (ev.recommendations || []).map((r, i) => `<li><b>${i + 1}.</b> ${escapeHtml(r)}</li>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Abstract Evaluation Report — ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 32px; }
    h1 { font-size: 22px; font-weight: 800; color: #1e3a8a; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    table td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    table td:last-child { text-align: right; }
    .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 20px; }
    .badge-green  { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .badge-amber  { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .meta-card .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #94a3b8; margin-bottom: 6px; }
    .meta-card .value { font-size: 20px; font-weight: 800; color: #1e3a8a; }
    .assessment { background: #eff6ff; border-left: 3px solid #2563eb; padding: 14px 16px; border-radius: 4px; font-size: 13.5px; line-height: 1.7; color: #1e3a8a; }
    ul, ol { padding-left: 20px; }
    li { margin-bottom: 6px; font-size: 13px; line-height: 1.6; }
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>Abstract Evaluation Report</h1>
  <p class="subtitle">Generated by AbstractAI · Powered by IBM Granite · ${date}</p>

  <div class="meta-grid">
    <div class="meta-card">
      <div class="label">Abstract Type</div>
      <span class="badge ${(ev.abstract_type || "").toLowerCase().includes("unstructured") ? "badge-amber" : "badge-green"}">${escapeHtml(ev.abstract_type || "Unknown")}</span>
    </div>
    <div class="meta-card">
      <div class="label">Overall Average Score</div>
      <div class="value">${avg}<span style="font-size:14px;font-weight:400;color:#64748b">/100</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detected Components</div>
    <table>${compRows}</table>
  </div>

  <div class="section">
    <div class="section-title">Quality Scores</div>
    <table>${scoreRows}</table>
  </div>

  <div class="section">
    <div class="section-title">Overall Assessment</div>
    <div class="assessment">${escapeHtml(ev.overall_assessment || "—")}</div>
  </div>

  <div class="section">
    <div class="section-title">Strengths</div>
    <ul>${strengthItems || "<li>No items identified.</li>"}</ul>
  </div>

  <div class="section">
    <div class="section-title">Weaknesses</div>
    <ul>${weaknessItems || "<li>No items identified.</li>"}</ul>
  </div>

  <div class="section">
    <div class="section-title">Actionable Recommendations</div>
    <ol>${recItems || "<li>No recommendations generated.</li>"}</ol>
  </div>

  <div class="footer">AbstractAI · AI-Powered Research Abstract Evaluator · Powered by IBM Granite via LangFlow</div>
</body>
</html>`;

  const blob   = new Blob([html], { type: "text/html" });
  const url    = URL.createObjectURL(blob);
  const win    = window.open(url, "_blank");
  if (win) {
    win.addEventListener("load", () => {
      setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 400);
    });
  } else {
    // Fallback: direct download
    const a = document.createElement("a");
    a.href = url;
    a.download = `abstract-evaluation-${Date.now()}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/* ══════════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUT — Ctrl/Cmd + Enter
══════════════════════════════════════════════════════════════════ */

abstractInput.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    evaluateAbstract();
  }
});

/* ══════════════════════════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════════════════════════ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
