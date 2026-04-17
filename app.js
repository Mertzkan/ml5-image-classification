const sampleData = {
  correct: [
    {
      id: "correct1",
      src: "img/correct1.jpeg",
      alt: "Weißstorch auf Wiese",
      expectedKeywords: ["stork", "white stork", "bird"],
      expectedLabelText: "stork"
    },
    {
      id: "correct2",
      src: "img/correct2.jpeg",
      alt: "Rochen auf dem Meeresboden",
      expectedKeywords: ["stingray", "ray"],
      expectedLabelText: "stingray"
    },
    {
      id: "correct3",
      src: "img/correct3.jpeg",
      alt: "Weißer Malteser Hund",
      expectedKeywords: ["maltese", "lhasa", "shih", "pekingese"],
      expectedLabelText: "maltese dog"
    }
  ],
  wrong: [
    {
      id: "wrong1",
      src: "img/wrong1.jpeg",
      alt: "Kleiner Singvogel auf einer Pflanze am Wasser",
      expectedKeywords: ["brambling"],
      expectedLabelText: "brambling"
    },
    {
      id: "wrong2",
      src: "img/wrong2.jpeg",
      alt: "Hundeshow mit mehreren Hunden und Menschen",
      expectedKeywords: ["springer", "spaniel"],
      expectedLabelText: "springer spaniel"
    },
    {
      id: "wrong3",
      src: "img/wrong3.jpeg",
      alt: "Hund in schwarz-weiß, auf dem Kopf gedreht",
      expectedKeywords: ["airedale", "dog"],
      expectedLabelText: "airedale dog"
    }
  ]
};

let classifier = null;
let userChartInstance = null;
const sampleChartInstances = {};

const modelStatus = document.getElementById("modelStatus");
const correctSamples = document.getElementById("correctSamples");
const wrongSamples = document.getElementById("wrongSamples");

const fileInput = document.getElementById("fileInput");
const classifyBtn = document.getElementById("classifyBtn");
const clearBtn = document.getElementById("clearBtn");
const userImage = document.getElementById("userImage");
const userFeedback = document.getElementById("userFeedback");
const dropZone = document.getElementById("dropZone");

function createSampleCard(container, item, type) {
  const card = document.createElement("article");
  card.className = "sample-card";

  card.innerHTML = `
    <div class="image-column">
      <img id="${item.id}" src="${item.src}" alt="${item.alt}" crossorigin="anonymous" />
      <div class="meta">
        <div id="${item.id}-badge" class="badge ${type === "correct" ? "correct" : "wrong"}">
          ${type === "correct" ? "Soll korrekt sein" : "Soll falsch sein"}
        </div>
        <div class="truth">Erwartete Klasse: ${item.expectedLabelText}</div>
        <div id="${item.id}-text" class="status">Bild wird analysiert ...</div>
      </div>
    </div>
    <div class="chart-column">
      <canvas id="${item.id}-chart"></canvas>
    </div>
  `;

  container.appendChild(card);

  const img = document.getElementById(item.id);

  img.addEventListener("load", async () => {
    await classifySampleImage(item, type);
  });

  img.addEventListener("error", () => {
    document.getElementById(`${item.id}-text`).textContent =
      "Bild konnte nicht geladen werden.";
  });
}

function createAllSampleCards() {
  sampleData.correct.forEach((item) => createSampleCard(correctSamples, item, "correct"));
  sampleData.wrong.forEach((item) => createSampleCard(wrongSamples, item, "wrong"));
}

function normalizeLabel(label) {
  return label.toLowerCase().trim();
}

function isExpectedMatch(topLabel, expectedKeywords) {
  const normalized = normalizeLabel(topLabel);
  return expectedKeywords.some((keyword) =>
    normalized.includes(keyword.toLowerCase())
  );
}

function extractTopResults(results, count = 5) {
  return results.slice(0, count).map((result) => ({
    label: result.label,
    confidencePercent: +(result.confidence * 100).toFixed(2)
  }));
}

function renderBarChart(canvasId, topResults, title = "Confidence in %") {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");

  if (sampleChartInstances[canvasId]) {
    sampleChartInstances[canvasId].destroy();
  }

  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: topResults.map((r) => r.label),
      datasets: [
        {
          label: title,
          data: topResults.map((r) => r.confidencePercent),
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.raw} %`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback(value) {
              return `${value} %`;
            }
          }
        }
      }
    },
    plugins: [
      {
        id: "valueLabels",
        afterDatasetsDraw(chartInstance) {
          const { ctx } = chartInstance;
          ctx.save();

          chartInstance.getDatasetMeta(0).data.forEach((bar, index) => {
            const value = chartInstance.data.datasets[0].data[index];
            ctx.fillStyle = "#111";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`${value} %`, bar.x, bar.y - 6);
          });

          ctx.restore();
        }
      }
    ]
  });

  sampleChartInstances[canvasId] = chart;
}

function renderUserChart(topResults) {
  const canvas = document.getElementById("userChart");
  const ctx = canvas.getContext("2d");

  if (userChartInstance) {
    userChartInstance.destroy();
  }

  userChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: topResults.map((r) => r.label),
      datasets: [
        {
          label: "Confidence in %",
          data: topResults.map((r) => r.confidencePercent),
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.raw} %`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback(value) {
              return `${value} %`;
            }
          }
        }
      }
    },
    plugins: [
      {
        id: "valueLabelsUser",
        afterDatasetsDraw(chartInstance) {
          const { ctx } = chartInstance;
          ctx.save();

          chartInstance.getDatasetMeta(0).data.forEach((bar, index) => {
            const value = chartInstance.data.datasets[0].data[index];
            ctx.fillStyle = "#111";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.fillText(`${value} %`, bar.x, bar.y - 6);
          });

          ctx.restore();
        }
      }
    ]
  });
}

function classifyImageElement(imgEl) {
  return new Promise((resolve, reject) => {
    classifier.classify(imgEl, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

async function classifySampleImage(item, type) {
  const imgEl = document.getElementById(item.id);
  const textEl = document.getElementById(`${item.id}-text`);
  const badgeEl = document.getElementById(`${item.id}-badge`);

  try {
    const results = await classifyImageElement(imgEl);
    const topResults = extractTopResults(results, 5);

    renderBarChart(`${item.id}-chart`, topResults);

    const topLabel = results[0].label;
    const match = isExpectedMatch(topLabel, item.expectedKeywords);

    if (type === "correct") {
      if (match) {
        badgeEl.textContent = "Korrekt klassifiziert";
        badgeEl.className = "badge correct";
      } else {
        badgeEl.textContent = "Nicht korrekt klassifiziert";
        badgeEl.className = "badge wrong";
      }
    } else {
      if (match) {
        badgeEl.textContent = "Unerwartet eher korrekt";
        badgeEl.className = "badge correct";
      } else {
        badgeEl.textContent = "Falsch klassifiziert";
        badgeEl.className = "badge wrong";
      }
    }

    textEl.textContent = `Top-Klasse: ${results[0].label} (${(results[0].confidence * 100).toFixed(2)} %)`;
  } catch (error) {
    textEl.textContent = "Fehler bei der Klassifikation.";
    console.error(error);
  }
}

function validateImageFile(file) {
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  return file && validTypes.includes(file.type);
}

function loadUserFile(file) {
  if (!validateImageFile(file)) {
    userFeedback.textContent =
      "Ungültiges Dateiformat. Bitte JPG, JPEG, PNG oder WEBP verwenden.";
    classifyBtn.disabled = true;
    userImage.style.display = "none";
    return;
  }

  const imageUrl = URL.createObjectURL(file);
  userImage.src = imageUrl;
  userImage.style.display = "block";
  classifyBtn.disabled = false;
  userFeedback.textContent = `Bild geladen: ${file.name}`;
}

async function classifyUserImage() {
  if (!userImage.src) {
    userFeedback.textContent = "Bitte zuerst ein Bild laden.";
    return;
  }

  userFeedback.textContent = "Klassifikation läuft ...";
  classifyBtn.disabled = true;

  try {
    const results = await classifyImageElement(userImage);
    const topResults = extractTopResults(results, 5);

    renderUserChart(topResults);

    userFeedback.textContent =
      `Erkannt: ${results[0].label} (${(results[0].confidence * 100).toFixed(2)} %)`;
  } catch (error) {
    userFeedback.textContent = "Fehler bei der Klassifikation des Benutzerbilds.";
    console.error(error);
  } finally {
    classifyBtn.disabled = false;
  }
}

function clearUserArea() {
  fileInput.value = "";
  userImage.src = "";
  userImage.style.display = "none";
  classifyBtn.disabled = true;
  userFeedback.textContent = "Noch kein Bild geladen.";

  if (userChartInstance) {
    userChartInstance.destroy();
    userChartInstance = null;
  }
}

function handleFileInputChange(event) {
  const file = event.target.files[0];
  loadUserFile(file);
}

function handleDragOver(event) {
  event.preventDefault();
  dropZone.classList.add("dragover");
}

function handleDragLeave() {
  dropZone.classList.remove("dragover");
}

function handleDrop(event) {
  event.preventDefault();
  dropZone.classList.remove("dragover");

  const file = event.dataTransfer.files[0];
  loadUserFile(file);
}

function initClassifier() {
  classifier = ml5.imageClassifier("MobileNet", () => {
    modelStatus.innerHTML = "<strong>Modellstatus:</strong> MobileNet erfolgreich geladen.";
    createAllSampleCards();
  });
}

function initEvents() {
  fileInput.addEventListener("change", handleFileInputChange);
  classifyBtn.addEventListener("click", classifyUserImage);
  clearBtn.addEventListener("click", clearUserArea);

  dropZone.addEventListener("dragover", handleDragOver);
  dropZone.addEventListener("dragleave", handleDragLeave);
  dropZone.addEventListener("drop", handleDrop);
}

document.addEventListener("DOMContentLoaded", () => {
  initEvents();
  initClassifier();
});