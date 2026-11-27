const WEIGHTS = Object.freeze({
  quizzes: 0.30,
  activities: 0.20,
  midterm: 0.20,
  final: 0.30
});

const PASSING_GRADE = 75;
const STORAGE_KEY = "cpe2_mco2_class_record_v1";

const PLAIN_DECIMAL_REGEX = /^(100(\.0+)?|\d{1,2}(\.\d+)?)$/;

function roundToTwo(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseScoreList(rawText) {
  if (typeof rawText !== "string") {
    return { valid: false, scores: [], reason: "must be a non-empty comma-separated list of numbers (0–100)." };
  }

  const trimmed = rawText.trim();
  if (trimmed === "") {
    return { valid: false, scores: [], reason: "must contain at least one score (0–100)." };
  }

  const parts = trimmed.split(",");
  const parsedScores = [];

  for (let i = 0; i < parts.length; i++) {
    const token = parts[i].trim();
    if (token === "" || !PLAIN_DECIMAL_REGEX.test(token)) {
      return {
        valid: false,
        scores: [],
        reason: `contains invalid value "${parts[i].trim()}" — only plain numbers from 0 to 100 are allowed.`
      };
    }

    const num = Number(token);
    if (Number.isNaN(num) || num < 0 || num > 100) {
      return {
        valid: false,
        scores: [],
        reason: `contains out-of-range value "${token}" — scores must be between 0 and 100.`
      };
    }

    parsedScores.push(num);
  }

  return { valid: true, scores: parsedScores, reason: "" };
}

function parseSingleScore(rawValue) {
  const text = String(rawValue ?? "").trim();
  if (text === "" || !PLAIN_DECIMAL_REGEX.test(text)) {
    return { valid: false, value: null };
  }

  const num = Number(text);
  if (Number.isNaN(num) || num < 0 || num > 100) {
    return { valid: false, value: null };
  }

  return { valid: true, value: num };
}

function validateStudentInput(input, existingRecords) {
  const errors = [];
  const name = String(input.name ?? "").trim();

  if (name === "") {
    errors.push("Student Name is required.");
  } else {
    const duplicate = existingRecords.some(
      (rec) => rec.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      errors.push(`Student Name "${name}" already exists in the record (no duplicate names allowed).`);
    }
  }

  const quizResult = parseScoreList(input.rawQuizzes);
  if (!quizResult.valid) {
    errors.push(`Quiz Scores ${quizResult.reason}`);
  }

  const activityResult = parseScoreList(input.rawActivities);
  if (!activityResult.valid) {
    errors.push(`Activity Scores ${activityResult.reason}`);
  }

  const midtermResult = parseSingleScore(input.rawMidterm);
  if (!midtermResult.valid) {
    errors.push("Midterm Exam is required and must be a valid number from 0 to 100.");
  }

  const finalResult = parseSingleScore(input.rawFinal);
  if (!finalResult.valid) {
    errors.push("Final Exam is required and must be a valid number from 0 to 100.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      name,
      rawQuizzes: quizResult.scores,
      rawActivities: activityResult.scores,
      midterm: midtermResult.value,
      final: finalResult.value,
      dropLowestQuiz: Boolean(input.dropLowestQuiz)
    }
  };
}

function applyDropLowestQuiz(scores, shouldDrop) {
  if (!shouldDrop || scores.length < 2) {
    return scores.slice();
  }

  const copy = scores.slice();
  copy.sort((a, b) => a - b);
  return copy.slice(1);
}

function computeAverage(scores) {
  if (!Array.isArray(scores) || scores.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < scores.length; i++) {
    sum += scores[i];
  }

  return roundToTwo(sum / scores.length);
}

function computeWeightedGrade(quizAvg, activityAvg, midterm, finalExam) {
  const rawGrade =
    quizAvg * WEIGHTS.quizzes +
    activityAvg * WEIGHTS.activities +
    midterm * WEIGHTS.midterm +
    finalExam * WEIGHTS.final;

  return roundToTwo(rawGrade);
}

function toEquivalent(percentage) {
  if (percentage >= 97) return "1.00";
  if (percentage >= 94) return "1.25";
  if (percentage >= 91) return "1.50";
  if (percentage >= 88) return "1.75";
  if (percentage >= 85) return "2.00";
  if (percentage >= 82) return "2.25";
  if (percentage >= 79) return "2.50";
  if (percentage >= 76) return "2.75";
  if (percentage >= PASSING_GRADE) return "3.00";
  return "5.00";
}

function toRemark(percentage) {
  const statusKey = percentage >= PASSING_GRADE ? "PASS" : "FAIL";
  switch (statusKey) {
    case "PASS":
      return "Passed";
    case "FAIL":
    default:
      return "Failed";
  }
}

function createStudentRecord(input, existingRecords) {
  const validation = validateStudentInput(input, existingRecords);
  if (!validation.isValid) {
    return { ok: false, errors: validation.errors, record: null };
  }

  const { name, rawQuizzes, rawActivities, midterm, final, dropLowestQuiz } = validation.data;
  const effectiveQuizzes = applyDropLowestQuiz(rawQuizzes, dropLowestQuiz);
  const quizAvg = computeAverage(effectiveQuizzes);
  const activityAvg = computeAverage(rawActivities);
  const gradePercent = computeWeightedGrade(quizAvg, activityAvg, midterm, final);
  const equivalent = toEquivalent(gradePercent);
  const remarks = toRemark(gradePercent);

  return {
    ok: true,
    errors: [],
    record: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      quizScores: rawQuizzes,
      effectiveQuizScores: effectiveQuizzes,
      activityScores: rawActivities,
      dropLowestQuiz,
      quizAvg,
      activityAvg,
      midterm,
      final,
      gradePercent,
      equivalent,
      remarks,
      rank: 1
    }
  };
}

function rankStudentsBubbleSort(records) {
  const arr = records.map((item) => ({ ...item }));
  if (arr.length <= 1) {
    if (arr.length === 1) arr[0].rank = 1;
    return arr;
  }

  let swapped;
  do {
    swapped = false;
    for (let i = 0; i < arr.length - 1; i++) {
      const shouldSwap =
        arr[i].gradePercent < arr[i + 1].gradePercent ||
        (arr[i].gradePercent === arr[i + 1].gradePercent &&
          arr[i].name.localeCompare(arr[i + 1].name) > 0);

      if (shouldSwap) {
        const temp = arr[i];
        arr[i] = arr[i + 1];
        arr[i + 1] = temp;
        swapped = true;
      }
    }
  } while (swapped);

  for (let i = 0; i < arr.length; i++) {
    arr[i].rank = i + 1;
  }

  return arr;
}

function computeClassStatistics(records) {
  const count = records.length;
  if (count === 0) {
    return {
      count: 0,
      mean: 0,
      highest: 0,
      lowest: 0,
      passed: 0,
      failed: 0
    };
  }

  let total = 0;
  let highest = records[0].gradePercent;
  let lowest = records[0].gradePercent;
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    const grade = records[i].gradePercent;
    total += grade;
    if (grade > highest) highest = grade;
    if (grade < lowest) lowest = grade;
    if (grade >= PASSING_GRADE) {
      passed++;
    } else {
      failed++;
    }
  }

  return {
    count,
    mean: roundToTwo(total / count),
    highest: roundToTwo(highest),
    lowest: roundToTwo(lowest),
    passed,
    failed
  };
}

function saveRecordsToStorage(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn("Unable to save to localStorage:", err);
  }
}

function loadRecordsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? rankStudentsBubbleSort(parsed) : [];
  } catch (err) {
    console.warn("Unable to load from localStorage:", err);
    return [];
  }
}

let classRecords = loadRecordsFromStorage();

function renderErrors(errors) {
  const errorBox = document.getElementById("error-box");
  if (!errorBox) return;

  if (!errors || errors.length === 0) {
    errorBox.classList.add("hidden");
    errorBox.innerHTML = "";
    return;
  }

  const itemsHtml = errors.map((msg) => `<li>${escapeHtml(msg)}</li>`).join("");
  errorBox.innerHTML = `<strong>Please fix the following invalid field(s):</strong><ul>${itemsHtml}</ul>`;
  errorBox.classList.remove("hidden");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStatistics(stats) {
  document.getElementById("stat-count").textContent = String(stats.count);
  document.getElementById("stat-mean").textContent = `${stats.mean.toFixed(2)}%`;
  document.getElementById("stat-highest").textContent = `${stats.highest.toFixed(2)}%`;
  document.getElementById("stat-lowest").textContent = `${stats.lowest.toFixed(2)}%`;
  document.getElementById("stat-pass-fail").textContent = `${stats.passed} / ${stats.failed}`;
}

function renderTable(records) {
  const tbody = document.getElementById("record-tbody");
  if (!tbody) return;

  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">No student records yet. Add a student or click "Load Sample Data".</td></tr>`;
    return;
  }

  tbody.innerHTML = records
    .map((rec) => {
      const remarkClass = rec.remarks === "Passed" ? "pill-passed" : "pill-failed";
      return `
        <tr>
          <td><strong>#${rec.rank}</strong></td>
          <td>${escapeHtml(rec.name)}</td>
          <td>${rec.quizAvg.toFixed(2)}</td>
          <td>${rec.activityAvg.toFixed(2)}</td>
          <td>${rec.midterm.toFixed(2)}</td>
          <td>${rec.final.toFixed(2)}</td>
          <td><strong>${rec.gradePercent.toFixed(2)}%</strong></td>
          <td>${rec.equivalent}</td>
          <td><span class="${remarkClass}">${rec.remarks}</span></td>
          <td>
            <button type="button" class="delete-btn" data-id="${escapeHtml(rec.id)}" aria-label="Delete ${escapeHtml(rec.name)}">
              Remove
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function syncAppState() {
  classRecords = rankStudentsBubbleSort(classRecords);
  saveRecordsToStorage(classRecords);
  renderTable(classRecords);
  renderStatistics(computeClassStatistics(classRecords));
}

function handleFormSubmit(event) {
  event.preventDefault();

  const input = {
    name: document.getElementById("student-name").value,
    rawQuizzes: document.getElementById("quiz-scores").value,
    rawActivities: document.getElementById("activity-scores").value,
    rawMidterm: document.getElementById("midterm-exam").value,
    rawFinal: document.getElementById("final-exam").value,
    dropLowestQuiz: document.getElementById("drop-lowest-quiz").checked
  };

  const result = createStudentRecord(input, classRecords);
  if (!result.ok) {
    renderErrors(result.errors);
    return;
  }

  renderErrors([]);
  classRecords.push(result.record);
  syncAppState();
  event.target.reset();
  document.getElementById("student-name").focus();
}

function handleLoadSampleData() {
  const samples = [
    {
      name: "Maria Santos",
      rawQuizzes: "70, 90, 88, 92",
      rawActivities: "90, 95, 92",
      rawMidterm: "89",
      rawFinal: "93",
      dropLowestQuiz: true
    },
    {
      name: "Jose Reyes",
      rawQuizzes: "72, 75, 70",
      rawActivities: "74, 76, 72",
      rawMidterm: "71",
      rawFinal: "73",
      dropLowestQuiz: false
    },
    {
      name: "Angela Cruz",
      rawQuizzes: "95, 96, 94",
      rawActivities: "92, 94, 96",
      rawMidterm: "95",
      rawFinal: "97",
      dropLowestQuiz: true
    }
  ];

  const added = [];
  for (let i = 0; i < samples.length; i++) {
    const res = createStudentRecord(samples[i], [...classRecords, ...added]);
    if (res.ok) {
      added.push(res.record);
    }
  }

  classRecords = [...classRecords, ...added];
  renderErrors([]);
  syncAppState();
}

function handleClearRecord() {
  classRecords = [];
  renderErrors([]);
  syncAppState();
}

function handleTableClick(event) {
  const btn = event.target.closest(".delete-btn");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  classRecords = classRecords.filter((rec) => rec.id !== id);
  syncAppState();
}

document.addEventListener("DOMContentLoaded", () => {
  syncAppState();

  const form = document.getElementById("grade-form");
  if (form) form.addEventListener("submit", handleFormSubmit);

  const sampleBtn = document.getElementById("load-sample-btn");
  if (sampleBtn) sampleBtn.addEventListener("click", handleLoadSampleData);

  const clearBtn = document.getElementById("clear-record-btn");
  if (clearBtn) clearBtn.addEventListener("click", handleClearRecord);

  const tbody = document.getElementById("record-tbody");
  if (tbody) tbody.addEventListener("click", handleTableClick);
});