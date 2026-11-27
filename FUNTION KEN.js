function runMco2UnitTests() {
  const results = [];

  function assert(condition, testName, details = "") {
    results.push({
      passed: Boolean(condition),
      name: testName,
      details
    });
  }

  // 1. Parsing valid and invalid comma-separated scores
  const validList = parseScoreList("80, 90.5, 100, 0");
  assert(
    validList.valid && validList.scores.length === 4 && validList.scores[1] === 90.5,
    "parseScoreList accepts valid comma-separated scores (0–100)"
  );

  const invalidList = parseScoreList("85, , abc, 105");
  assert(
    !invalidList.valid,
    "parseScoreList rejects blank, non-numeric, and out-of-range values"
  );

  // 2. Validation flags every invalid field and duplicate names
  const invalidForm = validateStudentInput(
    {
      name: "Ana Lim",
      rawQuizzes: "120",
      rawActivities: "",
      rawMidterm: "-1",
      rawFinal: "not-a-number",
      dropLowestQuiz: false
    },
    [{ name: "Ana Lim" }]
  );
  assert(
    !invalidForm.isValid && invalidForm.errors.length === 5,
    "validateStudentInput reports all 5 invalid fields simultaneously",
    `Found ${invalidForm.errors.length} error(s)`
  );

  // 3. Drop lowest quiz (copy, sort, slice from index 1) without mutating original
  const originalQuizzes = [88, 65, 92, 80];
  const dropped = applyDropLowestQuiz(originalQuizzes, true);
  assert(
    originalQuizzes.length === 4 &&
      dropped.length === 3 &&
      !dropped.includes(65) &&
      computeAverage(dropped) === roundToTwo((80 + 88 + 92) / 3),
    "applyDropLowestQuiz drops lowest score when true and 2+ quizzes exist without mutating input"
  );

  const singleQuiz = applyDropLowestQuiz([77], true);
  assert(
    singleQuiz.length === 1 && singleQuiz[0] === 77,
    "applyDropLowestQuiz keeps single quiz even when checkbox is checked"
  );

  // 4. Weighted grade, equivalent (if/else-if), and remarks (switch/case)
  const weighted = computeWeightedGrade(90, 85, 80, 88);
  // 90*0.3 + 85*0.2 + 80*0.2 + 88*0.3 = 27 + 17 + 16 + 26.4 = 86.4
  assert(
    weighted === 86.4 && toEquivalent(86.4) === "2.00" && toRemark(86.4) === "Passed",
    "computeWeightedGrade, toEquivalent, and toRemark calculate passing grade accurately",
    `Got ${weighted}%, eq ${toEquivalent(86.4)}, ${toRemark(86.4)}`
  );

  assert(
    toEquivalent(74.99) === "5.00" && toRemark(74.99) === "Failed",
    "Grades below 75 map to 5.00 and Failed"
  );

  // 5. Ranking with do...while bubble sort (highest to lowest)
  const ranked = rankStudentsBubbleSort([
    { id: "1", name: "Low Student", gradePercent: 72 },
    { id: "2", name: "Top Student", gradePercent: 94.5 },
    { id: "3", name: "Mid Student", gradePercent: 83 }
  ]);
  assert(
    ranked[0].name === "Top Student" &&
      ranked[0].rank === 1 &&
      ranked[1].name === "Mid Student" &&
      ranked[1].rank === 2 &&
      ranked[2].name === "Low Student" &&
      ranked[2].rank === 3,
    "rankStudentsBubbleSort orders students descending and assigns ranks 1..N"
  );

  // 6. Class statistics
  const stats = computeClassStatistics([
    { gradePercent: 90 },
    { gradePercent: 80 },
    { gradePercent: 70 }
  ]);
  assert(
    stats.count === 3 &&
      stats.mean === 80 &&
      stats.highest === 90 &&
      stats.lowest === 70 &&
      stats.passed === 2 &&
      stats.failed === 1,
    "computeClassStatistics computes count, mean, highest, lowest, passed, and failed"
  );

  const passedCount = results.filter((r) => r.passed).length;
  console.group(`MCO 2 Unit Tests (${passedCount}/${results.length} passed)`);
  results.forEach((r) => {
    if (r.passed) {
      console.log(`PASS: ${r.name}`);
    } else {
      console.error(`FAIL: ${r.name} — ${r.details}`);
    }
  });
  console.groupEnd();

  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    results
  };
}

function openTestModalWithResults(report) {
  const modal = document.getElementById("test-modal");
  const summaryEl = document.getElementById("test-summary");
  const listEl = document.getElementById("test-results-list");
  if (!modal || !summaryEl || !listEl) return;

  summaryEl.textContent = `${report.passed} of ${report.total} unit tests passed (${report.failed} failed). Check Console for full details.`;
  listEl.innerHTML = report.results
    .map((item) => {
      const cls = item.passed ? "test-pass" : "test-fail";
      const label = item.passed ? "PASS" : "FAIL";
      const extra = item.details ? ` — ${item.details}` : "";
      return `<li class="${cls}"><strong>[${label}]</strong> ${escapeHtml(item.name)}${escapeHtml(extra)}</li>`;
    })
    .join("");

  modal.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("run-tests-btn");
  const closeBtn = document.getElementById("close-modal-btn");
  const modal = document.getElementById("test-modal");

  if (runBtn) {
    runBtn.addEventListener("click", () => {
      const report = runMco2UnitTests();
      openTestModalWithResults(report);
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }

  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }
});