"use strict";

const REQUIRED_COLUMNS = [
  "date",
  "air_temp_c",
  "shortwave_w_m2",
  "wind_speed_m_s",
  "observed_lst_c",
];

const state = {
  frequency: "Daily",
  rows: null,
  fit: null,
  reconstruction: null,
  sourceName: "",
};

const els = {
  csvFile: document.getElementById("csvFile"),
  dropZone: document.getElementById("dropZone"),
  fileName: document.getElementById("fileName"),
  statusBox: document.getElementById("statusBox"),
  loadDemoBtn: document.getElementById("loadDemoBtn"),
  downloadTemplateBtn: document.getElementById("downloadTemplateBtn"),
  dataSection: document.getElementById("dataSection"),
  inputMetrics: document.getElementById("inputMetrics"),
  previewBody: document.getElementById("previewBody"),
  previewNote: document.getElementById("previewNote"),
  runBtn: document.getElementById("runBtn"),
  runMessage: document.getElementById("runMessage"),
  resultsSection: document.getElementById("resultsSection"),
  resultMetrics: document.getElementById("resultMetrics"),
  memoryCaption: document.getElementById("memoryCaption"),
  parameterBody: document.getElementById("parameterBody"),
  chart: document.getElementById("chart"),
  targetSelect: document.getElementById("targetSelect"),
  targetResult: document.getElementById("targetResult"),
  downloadResultsBtn: document.getElementById("downloadResultsBtn"),
};

function setStatus(message, kind = "neutral") {
  els.statusBox.className = `status-box status-box--${kind}`;
  els.statusBox.textContent = message;
}

function getFrequency() {
  return document.querySelector('input[name="frequency"]:checked').value;
}

function metric(label, value) {
  return `<div class="metric"><span class="metric__label">${escapeHtml(label)}</span><span class="metric__value">${escapeHtml(String(value))}</span></div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  row.push(field.replace(/\r$/, ""));
  if (row.some((v) => v.trim() !== "")) rows.push(row);

  if (!rows.length) {
    throw new Error("The CSV file is empty.");
  }

  const headers = rows[0].map((h) =>
    h.trim().replace(/^\uFEFF/, "")
  );

  const missing = REQUIRED_COLUMNS.filter(
    (c) => !headers.includes(c)
  );

  if (missing.length) {
    throw new Error(
      `Missing required columns: ${missing.join(", ")}`
    );
  }

  return rows.slice(1).map((values) => {
    const obj = {};

    headers.forEach((h, idx) => {
      obj[h] = (values[idx] ?? "").trim();
    });

    return obj;
  });
}

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function parseDateStrict(value) {
  const text = String(value).trim();

  const m = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/
  );

  if (!m) {
    throw new Error(
      `Invalid date: ${text}. Use YYYY-MM-DD.`
    );
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const d = utcDate(year, month, day);

  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${text}.`);
  }

  return d;
}

function periodizeDate(date, frequency) {
  if (frequency === "Daily") {
    return utcDate(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate()
    );
  }

  if (frequency === "Monthly") {
    return utcDate(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      1
    );
  }

  return utcDate(
    date.getUTCFullYear(),
    1,
    1
  );
}

function dateKey(date) {
  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

function nextPeriod(date, frequency) {
  if (frequency === "Daily") {
    return new Date(date.getTime() + 86400000);
  }

  if (frequency === "Monthly") {
    return utcDate(
      date.getUTCFullYear(),
      date.getUTCMonth() + 2,
      1
    );
  }

  return utcDate(
    date.getUTCFullYear() + 1,
    1,
    1
  );
}

function numeric(value, allowBlank = false) {
  const text = String(value ?? "").trim();

  if (text === "" && allowBlank) {
    return null;
  }

  const n = Number(text);

  return Number.isFinite(n) ? n : null;
}

function prepareData(rawRows, frequency) {
  if (!rawRows.length) {
    throw new Error("The CSV contains no data rows.");
  }

  const rows = rawRows.map((r, index) => {
    const date = periodizeDate(
      parseDateStrict(r.date),
      frequency
    );

    const air = numeric(r.air_temp_c);
    const sw = numeric(r.shortwave_w_m2);
    const wind = numeric(r.wind_speed_m_s);
    const obs = numeric(r.observed_lst_c, true);

    if (
      air === null ||
      sw === null ||
      wind === null
    ) {
      throw new Error(
        `Atmospheric forcing cannot be missing or non-numeric. Check CSV data row ${index + 2}.`
      );
    }

    if (sw < 0) {
      throw new Error(
        "Incoming shortwave radiation must not be negative."
      );
    }

    if (wind < 0) {
      throw new Error(
        "Wind speed must not be negative."
      );
    }

    return {
      date,
      air_temp_c: air,
      shortwave_w_m2: sw,
      wind_speed_m_s: wind,
      observed_lst_c: obs,
    };
  });

  rows.sort((a, b) => a.date - b.date);

  const seen = new Set();

  for (const r of rows) {
    const key = dateKey(r.date);

    if (seen.has(key)) {
      throw new Error(
        `More than one row maps to the same selected timestep: ${key}.`
      );
    }

    seen.add(key);
  }

  if (rows.length > 1) {
    const present = new Set(
      rows.map((r) => dateKey(r.date))
    );

    const missing = [];

    for (
      let d = rows[0].date;
      d <= rows[rows.length - 1].date;
      d = nextPeriod(d, frequency)
    ) {
      if (!present.has(dateKey(d))) {
        missing.push(dateKey(d));
      }

      if (missing.length >= 9) break;
    }

    if (missing.length) {
      const unit =
        frequency === "Daily"
          ? "day"
          : frequency === "Monthly"
          ? "month"
          : "year";

      throw new Error(
        `Atmospheric forcing must contain every ${unit} between the first and last row. Missing timestep(s): ${missing
          .slice(0, 8)
          .join(", ")}${missing.length > 8 ? " ..." : ""}`
      );
    }
  }

  return rows;
}

function tauBounds(frequency) {
  if (frequency === "Daily") {
    return [0.25, 365.0];
  }

  if (frequency === "Monthly") {
    return [0.10, 60.0];
  }

  return [0.05, 20.0];
}

function simulateFreeRun(
  rows,
  beta0,
  betaT,
  betaS,
  betaU,
  tau
) {
  const obsIndices = rows
    .map((r, i) =>
      r.observed_lst_c !== null ? i : -1
    )
    .filter((i) => i >= 0);

  if (!obsIndices.length) {
    throw new Error(
      "At least one observed LST is required."
    );
  }

  const first = obsIndices[0];

  const pred = Array(rows.length).fill(null);

  pred[first] =
    rows[first].observed_lst_c;

  const m = Math.exp(-1 / tau);

  for (let i = first + 1; i < rows.length; i++) {
    const te =
      beta0 +
      betaT * rows[i].air_temp_c +
      betaS * rows[i].shortwave_w_m2 +
      betaU * rows[i].wind_speed_m_s;

    pred[i] =
      m * pred[i - 1] +
      (1 - m) * te;
  }

  return pred;
}

function solveLinearSystem(A, b) {
  const n = b.length;

  const M = A.map((row, i) => [
    ...row,
    b[i],
  ]);

  for (let col = 0; col < n; col++) {
    let pivot = col;

    for (let r = col + 1; r < n; r++) {
      if (
        Math.abs(M[r][col]) >
        Math.abs(M[pivot][col])
      ) {
        pivot = r;
      }
    }

    if (
      Math.abs(M[pivot][col]) < 1e-12
    ) {
      throw new Error("Singular matrix");
    }

    [M[col], M[pivot]] = [
      M[pivot],
      M[col],
    ];

    const p = M[col][col];

    for (let c = col; c <= n; c++) {
      M[col][c] /= p;
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue;

      const f = M[r][col];

      for (let c = col; c <= n; c++) {
        M[r][c] -= f * M[col][c];
      }
    }
  }

  return M.map((row) => row[n]);
}

function initialBetaGuess(rows) {
  const obs = rows.filter(
    (r) => r.observed_lst_c !== null
  );

  try {
    const XtX = Array.from(
      { length: 4 },
      () => Array(4).fill(0)
    );

    const Xty = Array(4).fill(0);

    for (const r of obs) {
      const x = [
        1,
        r.air_temp_c,
        r.shortwave_w_m2,
        r.wind_speed_m_s,
      ];

      for (let i = 0; i < 4; i++) {
        Xty[i] +=
          x[i] * r.observed_lst_c;

        for (let j = 0; j < 4; j++) {
          XtX[i][j] +=
            x[i] * x[j];
        }
      }
    }

    const beta =
      solveLinearSystem(XtX, Xty);

    if (!beta.every(Number.isFinite)) {
      throw new Error(
        "Non-finite OLS result"
      );
    }

    return beta;
  } catch {
    return [
      0.0,
      0.8,
      0.002,
      0.0,
    ];
  }
}

function geomspace(start, end, n) {
  if (n === 1) {
    return [start];
  }

  const a = Math.log(start);
  const b = Math.log(end);

  return Array.from(
    { length: n },
    (_, i) =>
      Math.exp(
        a +
          ((b - a) * i) /
            (n - 1)
      )
  );
}

function clamp(v, lo, hi) {
  return Math.max(
    lo,
    Math.min(hi, v)
  );
}

function nelderMead(
  objective,
  start,
  options = {}
) {
  const n = start.length;

  const maxIter =
    options.maxIter ?? 700;

  const tol =
    options.tol ?? 1e-8;

  const simplex = [
    start.slice(),
  ];

  for (let i = 0; i < n; i++) {
    const p =
      start.slice();

    p[i] = clamp(
      p[i] + 0.045,
      0,
      1
    );

    if (
      Math.abs(
        p[i] - start[i]
      ) < 1e-10
    ) {
      p[i] = clamp(
        p[i] - 0.045,
        0,
        1
      );
    }

    simplex.push(p);
  }

  let values =
    simplex.map(objective);

  const alpha = 1;
  const gamma = 2;
  const rho = 0.5;
  const sigma = 0.5;

  const averagePoint = (pts) =>
    Array.from(
      { length: n },
      (_, d) =>
        pts.reduce(
          (s, p) => s + p[d],
          0
        ) / pts.length
    );

  const combine = (
    a,
    b,
    wa,
    wb
  ) =>
    a.map(
      (v, i) =>
        clamp(
          wa * v +
            wb * b[i],
          0,
          1
        )
    );

  for (
    let iter = 0;
    iter < maxIter;
    iter++
  ) {
    const order = values
      .map((v, i) => [v, i])
      .sort(
        (a, b) =>
          a[0] - b[0]
      )
      .map((x) => x[1]);

    const pts =
      order.map(
        (i) => simplex[i]
      );

    const vals =
      order.map(
        (i) => values[i]
      );

    for (
      let i = 0;
      i <= n;
      i++
    ) {
      simplex[i] = pts[i];
      values[i] = vals[i];
    }

    const spread =
      Math.max(...values) -
      Math.min(...values);

    const coordSpread =
      Math.max(
        ...Array.from(
          { length: n },
          (_, d) =>
            Math.max(
              ...simplex.map(
                (p) => p[d]
              )
            ) -
            Math.min(
              ...simplex.map(
                (p) => p[d]
              )
            )
        )
      );

    if (
      spread < tol &&
      coordSpread < 1e-6
    ) {
      break;
    }

    const centroid =
      averagePoint(
        simplex.slice(0, n)
      );

    const worst =
      simplex[n];

    const reflected =
      combine(
        centroid,
        worst,
        1 + alpha,
        -alpha
      );

    const fr =
      objective(reflected);

    if (
      fr < values[0]
    ) {
      const expanded =
        combine(
          centroid,
          reflected,
          1 - gamma,
          gamma
        );

      const fe =
        objective(expanded);

      if (fe < fr) {
        simplex[n] =
          expanded;

        values[n] = fe;
      } else {
        simplex[n] =
          reflected;

        values[n] = fr;
      }
    } else if (
      fr < values[n - 1]
    ) {
      simplex[n] =
        reflected;

      values[n] = fr;
    } else {
      const outside =
        fr < values[n];

      const contracted =
        outside
          ? combine(
              centroid,
              reflected,
              1 - rho,
              rho
            )
          : combine(
              centroid,
              worst,
              1 - rho,
              rho
            );

      const fc =
        objective(contracted);

      if (
        fc <
        (outside
          ? fr
          : values[n])
      ) {
        simplex[n] =
          contracted;

        values[n] = fc;
      } else {
        const best =
          simplex[0].slice();

        for (
          let i = 1;
          i <= n;
          i++
        ) {
          simplex[i] =
            combine(
              best,
              simplex[i],
              1 - sigma,
              sigma
            );

          values[i] =
            objective(
              simplex[i]
            );
        }
      }
    }
  }

  let bestI = 0;

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    if (
      values[i] <
      values[bestI]
    ) {
      bestI = i;
    }
  }

  return {
    x: simplex[
      bestI
    ].slice(),
    value:
      values[bestI],
  };
}

async function fitModel(
  rows,
  frequency,
  minObservations = 10
) {
  const obsIdx = rows
    .map((r, i) =>
      r.observed_lst_c !== null
        ? i
        : -1
    )
    .filter((i) => i >= 0);

  const nObs =
    obsIdx.length;

  if (
    nObs <
    minObservations
  ) {
    throw new Error(
      `This tool requires at least ${minObservations} observed LST values for calibration. Found ${nObs}.`
    );
  }

  const firstObs =
    obsIdx[0];

  const fitObsIdx =
    obsIdx.filter(
      (i) => i > firstObs
    );

  if (
    fitObsIdx.length < 5
  ) {
    throw new Error(
      "Too few observed LST values occur after the first anchor observation."
    );
  }

  const betaInit =
    initialBetaGuess(rows);

  const [
    tauLo,
    tauHi,
  ] =
    tauBounds(frequency);

  const lower = [
    -100,
    -5,
    -0.10,
    -10,
    Math.log(tauLo),
  ];

  const upper = [
    100,
    5,
    0.10,
    10,
    Math.log(tauHi),
  ];

  const toX = (y) =>
    y.map(
      (v, i) =>
        lower[i] +
        v *
          (
            upper[i] -
            lower[i]
          )
    );

  const toY = (x) =>
    x.map(
      (v, i) =>
        (
          clamp(
            v,
            lower[i],
            upper[i]
          ) -
          lower[i]
        ) /
        (
          upper[i] -
          lower[i]
        )
    );

  const residualVector = (x) => {
    const [
      b0,
      bt,
      bs,
      bu,
      logTau,
    ] = x;

    const tau =
      Math.exp(logTau);

    const pred =
      simulateFreeRun(
        rows,
        b0,
        bt,
        bs,
        bu,
        tau
      );

    return fitObsIdx.map(
      (i) =>
        pred[i] -
        rows[i]
          .observed_lst_c
    );
  };

  const softL1 = (x) => {
    const r =
      residualVector(x);

    let total = 0;

    for (const e of r) {
      total +=
        2 *
        (
          Math.sqrt(
            1 + e * e
          ) -
          1
        );
    }

    return Number.isFinite(
      total
    )
      ? total
      : 1e100;
  };

  const tauStarts =
    geomspace(
      Math.max(
        tauLo * 1.5,
        0.5
      ),
      Math.min(
        tauHi / 1.5,
        60.0
      ),
      9
    );

  const candidates = [];

  for (
    let k = 0;
    k <
    tauStarts.length;
    k++
  ) {
    const x0 = [
      betaInit[0],
      betaInit[1],
      betaInit[2],
      betaInit[3],
      Math.log(
        tauStarts[k]
      ),
    ].map(
      (v, i) =>
        clamp(
          v,
          lower[i] +
            1e-10,
          upper[i] -
            1e-10
        )
    );

    const result =
      nelderMead(
        (y) =>
          softL1(
            toX(y)
          ),
        toY(x0),
        {
          maxIter: 650,
          tol: 1e-7,
        }
      );

    const x =
      toX(result.x);

    const residuals =
      residualVector(x);

    const sse =
      residuals.reduce(
        (s, e) =>
          s + e * e,
        0
      );

    if (
      x.every(
        Number.isFinite
      ) &&
      Number.isFinite(sse)
    ) {
      candidates.push({
        x,
        sse,
      });
    }

    els.runMessage.textContent =
      `Calibrating… ${k + 1} / ${tauStarts.length} starting points`;

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          0
        )
    );
  }

  if (
    !candidates.length
  ) {
    throw new Error(
      "Calibration failed for all optimization starting points."
    );
  }

  candidates.sort(
    (a, b) =>
      a.sse - b.sse
  );

  const [
    beta0,
    betaT,
    betaS,
    betaU,
    logTau,
  ] =
    candidates[0].x;

  const tau =
    Math.exp(logTau);

  const pred =
    simulateFreeRun(
      rows,
      beta0,
      betaT,
      betaS,
      betaU,
      tau
    );

  const yTrue =
    fitObsIdx.map(
      (i) =>
        rows[i]
          .observed_lst_c
    );

  const yPred =
    fitObsIdx.map(
      (i) => pred[i]
    );

  const errors =
    yPred.map(
      (v, i) =>
        v - yTrue[i]
    );

  const rmse =
    Math.sqrt(
      errors.reduce(
        (s, e) =>
          s + e * e,
        0
      ) /
        errors.length
    );

  const mae =
    errors.reduce(
      (s, e) =>
        s + Math.abs(e),
      0
    ) /
    errors.length;

  const meanY =
    yTrue.reduce(
      (a, b) => a + b,
      0
    ) /
    yTrue.length;

  const sst =
    yTrue.reduce(
      (s, y) =>
        s +
        (
          y - meanY
        ) ** 2,
      0
    );

  const r2 =
    sst > 0
      ? 1 -
        errors.reduce(
          (s, e) =>
            s + e * e,
          0
        ) /
          sst
      : NaN;

  return {
    beta0,
    betaT,
    betaS,
    betaU,
    tau,
    rmse,
    mae,
    r2,
    nObserved:
      nObs,
    freeRun:
      pred,
  };
}

function reconstruct(
  rows,
  fit
) {
  const obsIdx = rows
    .map((r, i) =>
      r.observed_lst_c !== null
        ? i
        : -1
    )
    .filter((i) => i >= 0);

  const first =
    obsIdx[0];

  const pred =
    Array(
      rows.length
    ).fill(null);

  const source =
    Array(
      rows.length
    ).fill("");

  pred[first] =
    rows[first]
      .observed_lst_c;

  source[first] =
    "Observed anchor";

  const m =
    Math.exp(
      -1 / fit.tau
    );

  for (
    let i =
      first + 1;
    i <
    rows.length;
    i++
  ) {
    if (
      rows[i]
        .observed_lst_c !==
      null
    ) {
      pred[i] =
        rows[i]
          .observed_lst_c;

      source[i] =
        "Observed anchor";
    } else {
      const te =
        fit.beta0 +
        fit.betaT *
          rows[i]
            .air_temp_c +
        fit.betaS *
          rows[i]
            .shortwave_w_m2 +
        fit.betaU *
          rows[i]
            .wind_speed_m_s;

      pred[i] =
        m *
          pred[i - 1] +
        (1 - m) *
          te;

      source[i] =
        "Model";
    }
  }

  return rows.map(
    (r, i) => ({
      ...r,
      reconstructed_lst_c:
        pred[i],
      state_source:
        source[i],
    })
  );
}

function renderInput(rows) {
  const nObs =
    rows.filter(
      (r) =>
        r.observed_lst_c !==
        null
    ).length;

  els.inputMetrics.innerHTML =
    [
      metric(
        "Rows / timesteps",
        rows.length
      ),
      metric(
        "Observed LST values",
        nObs
      ),
      metric(
        "Missing LST to reconstruct",
        rows.length - nObs
      ),
    ].join("");

  const maxRows = 12;

  els.previewBody.innerHTML =
    rows
      .slice(
        0,
        maxRows
      )
      .map(
        (r) => `
    <tr>
      <td>${dateKey(r.date)}</td>
      <td>${formatNumber(r.air_temp_c, 3)}</td>
      <td>${formatNumber(r.shortwave_w_m2, 3)}</td>
      <td>${formatNumber(r.wind_speed_m_s, 3)}</td>
      <td>${r.observed_lst_c === null ? "—" : formatNumber(r.observed_lst_c, 3)}</td>
    </tr>`
      )
      .join("");

  els.previewNote.textContent =
    rows.length >
    maxRows
      ? `Showing the first ${maxRows} of ${rows.length} rows.`
      : `Showing all ${rows.length} rows.`;

  els.dataSection.classList.remove(
    "hidden"
  );

  els.resultsSection.classList.add(
    "hidden"
  );

  els.runBtn.disabled =
    nObs < 10;

  if (nObs < 10) {
    setStatus(
      `Dataset is structurally valid, but only ${nObs} observed LST values are present. At least 10 are required for calibration.`,
      "warning"
    );
  } else {
    setStatus(
      `Dataset validated: ${rows.length} timesteps and ${nObs} observed LST values are ready for calibration.`,
      "success"
    );
  }
}

function formatNumber(
  value,
  digits = 4
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "—";
  }

  const n =
    Number(value);

  if (
    Math.abs(n) >=
      1000 ||
    (
      Math.abs(n) >
        0 &&
      Math.abs(n) <
        0.001
    )
  ) {
    return n.toExponential(
      3
    );
  }

  return n
    .toFixed(digits)
    .replace(
      /\.0+$|(?<=\.\d*?)0+$/g,
      ""
    )
    .replace(
      /\.$/,
      ""
    );
}

function displayDate(
  date,
  frequency
) {
  if (
    frequency === "Daily"
  ) {
    return dateKey(date);
  }

  if (
    frequency === "Monthly"
  ) {
    return `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1
    ).padStart(2, "0")}`;
  }

  return String(
    date.getUTCFullYear()
  );
}

function renderResults(
  fit,
  recon,
  frequency
) {
  const unit =
    frequency === "Daily"
      ? "days"
      : frequency === "Monthly"
      ? "months"
      : "years";

  const M =
    Math.exp(
      -1 / fit.tau
    );

  const horizon =
    3 * fit.tau;

  els.resultMetrics.innerHTML =
    [
      metric(
        "τ (response time)",
        `${fit.tau.toFixed(3)} ${unit}`
      ),
      metric(
        "Memory coefficient M",
        M.toFixed(4)
      ),
      metric(
        "RMSE",
        `${fit.rmse.toFixed(3)} °C`
      ),
      metric(
        "MAE",
        `${fit.mae.toFixed(3)} °C`
      ),
      metric(
        "R²",
        Number.isFinite(
          fit.r2
        )
          ? fit.r2.toFixed(3)
          : "—"
      ),
    ].join("");

  els.memoryCaption.textContent =
    `Approximate 5%-memory horizon ≈ 3τ = ${horizon.toFixed(2)} ${unit}. This is an interpretation aid, not a hard cutoff.`;

  const params = [
    [
      "β₀",
      fit.beta0,
      "Intercept",
    ],
    [
      "βT",
      fit.betaT,
      "Air-temperature coefficient",
    ],
    [
      "βS",
      fit.betaS,
      "Shortwave-radiation coefficient",
    ],
    [
      "βU",
      fit.betaU,
      "Wind-speed coefficient",
    ],
    [
      "τ",
      fit.tau,
      `Characteristic thermal response time (${unit})`,
    ],
  ];

  els.parameterBody.innerHTML =
    params
      .map(
        ([
          p,
          v,
          meaning,
        ]) =>
          `<tr><td><strong>${p}</strong></td><td>${formatNumber(v, 6)}</td><td>${meaning}</td></tr>`
      )
      .join("");

  drawChart(
    recon,
    frequency
  );

  const valid =
    recon
      .map(
        (r, i) =>
          r.reconstructed_lst_c !==
          null
            ? i
            : -1
      )
      .filter(
        (i) => i >= 0
      );

  els.targetSelect.innerHTML =
    valid
      .map(
        (i) =>
          `<option value="${i}">${displayDate(recon[i].date, frequency)}</option>`
      )
      .join("");

  if (valid.length) {
    els.targetSelect.value =
      String(
        valid[
          valid.length -
            1
        ]
      );
  }

  updateTargetResult();

  els.resultsSection.classList.remove(
    "hidden"
  );

  els.resultsSection.scrollIntoView(
    {
      behavior:
        "smooth",
      block: "start",
    }
  );
}

function drawChart(
  rows,
  frequency
) {
  const valid = rows
    .map(
      (r, i) =>
        r.reconstructed_lst_c !==
        null
          ? {
              ...r,
              i,
            }
          : null
    )
    .filter(Boolean);

  if (!valid.length) {
    els.chart.innerHTML =
      "<p>No reconstructed values to plot.</p>";
    return;
  }

  const values =
    valid
      .flatMap(
        (r) => [
          r.reconstructed_lst_c,
          r.observed_lst_c,
        ]
      )
      .filter(
        (v) =>
          v !== null &&
          Number.isFinite(v)
      );

  let yMin =
    Math.min(...values);

  let yMax =
    Math.max(...values);

  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const pad =
    (yMax - yMin) *
    0.12;

  yMin -= pad;
  yMax += pad;

  const W = 1000;
  const H = 360;
  const left = 58;
  const right = 20;
  const top = 20;
  const bottom = 48;

  const plotW =
    W - left - right;

  const plotH =
    H - top - bottom;

  const x = (index) =>
    left +
    (
      valid.length ===
      1
        ? plotW / 2
        : (
            index /
            (
              valid.length -
              1
            )
          ) *
          plotW
    );

  const y = (value) =>
    top +
    (
      (
        yMax -
        value
      ) /
      (
        yMax -
        yMin
      )
    ) *
      plotH;

  const ticks = 5;

  let grid = "";

  for (
    let t = 0;
    t <= ticks;
    t++
  ) {
    const val =
      yMin +
      (
        (
          yMax -
          yMin
        ) *
        t
      ) /
        ticks;

    const yy =
      y(val);

    grid +=
      `<line x1="${left}" y1="${yy}" x2="${W - right}" y2="${yy}" stroke="#e5edf0" stroke-width="1" />`;

    grid +=
      `<text x="${left - 10}" y="${yy + 4}" text-anchor="end">${val.toFixed(1)}</text>`;
  }

  const xTickCount =
    Math.min(
      5,
      valid.length
    );

  let xLabels = "";

  for (
    let t = 0;
    t < xTickCount;
    t++
  ) {
    const idx =
      Math.round(
        (
          (
            valid.length -
            1
          ) *
          t
        ) /
          Math.max(
            1,
            xTickCount -
              1
          )
      );

    xLabels +=
      `<text x="${x(idx)}" y="${H - 17}" text-anchor="middle">${escapeHtml(displayDate(valid[idx].date, frequency))}</text>`;
  }

  const path =
    valid
      .map(
        (r, idx) =>
          `${idx === 0 ? "M" : "L"}${x(idx).toFixed(2)},${y(r.reconstructed_lst_c).toFixed(2)}`
      )
      .join(" ");

  const obs =
    valid
      .map(
        (r, idx) =>
          r.observed_lst_c ===
          null
            ? ""
            : `<circle cx="${x(idx)}" cy="${y(r.observed_lst_c)}" r="4.8" fill="#d05b58" stroke="#fff" stroke-width="2"><title>${displayDate(r.date, frequency)} · Observed ${r.observed_lst_c.toFixed(2)} °C</title></circle>`
      )
      .join("");

  els.chart.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      ${grid}
      <line x1="${left}" y1="${top}" x2="${left}" y2="${H - bottom}" stroke="#b8c8ce" />
      <line x1="${left}" y1="${H - bottom}" x2="${W - right}" y2="${H - bottom}" stroke="#b8c8ce" />
      <path d="${path}" fill="none" stroke="#0f6f76" stroke-width="3" vector-effect="non-scaling-stroke" />
      ${obs}
      ${xLabels}
      <text x="15" y="${top + plotH / 2}" text-anchor="middle" transform="rotate(-90 15 ${top + plotH / 2})">LST (°C)</text>
    </svg>`;
}

function updateTargetResult() {
  if (
    !state.reconstruction
  ) {
    return;
  }

  const i =
    Number(
      els.targetSelect.value
    );

  const row =
    state.reconstruction[i];

  if (!row) {
    return;
  }

  const observed =
    row.observed_lst_c !==
    null;

  els.targetResult.innerHTML =
    observed
      ? `<span>LST at selected timestep: <strong>${row.reconstructed_lst_c.toFixed(2)} °C</strong><br><small>An observation is available, so the model state is anchored to it.</small></span>`
      : `<span>Estimated LST at selected timestep: <strong>${row.reconstructed_lst_c.toFixed(2)} °C</strong></span>`;
}

function csvEscape(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const s =
    String(value);

  return /[",\n]/.test(s)
    ? `"${s.replaceAll('"', '""')}"`
    : s;
}

function rowsToCSV(rows) {
  const header = [
    "date",
    "air_temp_c",
    "shortwave_w_m2",
    "wind_speed_m_s",
    "observed_lst_c",
    "reconstructed_lst_c",
    "state_source",
  ];

  const lines = [
    header.join(","),
  ];

  for (const r of rows) {
    lines.push(
      [
        dateKey(r.date),
        r.air_temp_c,
        r.shortwave_w_m2,
        r.wind_speed_m_s,
        r.observed_lst_c ===
        null
          ? ""
          : r.observed_lst_c,
        r.reconstructed_lst_c ===
        null
          ? ""
          : r.reconstructed_lst_c,
        r.state_source,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return lines.join(
    "\n"
  );
}

function downloadText(
  text,
  filename,
  type = "text/plain"
) {
  const blob =
    new Blob(
      [text],
      { type }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const a =
    document.createElement(
      "a"
    );

  a.href = url;

  a.download =
    filename;

  document.body.appendChild(
    a
  );

  a.click();

  a.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    500
  );
}

function generateDemoCSV() {
  const lines = [
    "date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c",
  ];

  const start =
    utcDate(
      2026,
      4,
      1
    );

  let lake = 10.8;

  const b0 = 1.8;
  const bt = 0.58;
  const bs = 0.006;
  const bu = -0.18;
  const tau = 9.5;

  const M =
    Math.exp(
      -1 / tau
    );

  for (
    let i = 0;
    i < 70;
    i++
  ) {
    const d =
      new Date(
        start.getTime() +
          i *
            86400000
      );

    const air =
      12.5 +
      0.085 * i +
      2.8 *
        Math.sin(
          i / 8
        );

    const sw =
      320 +
      2.6 * i +
      45 *
        Math.sin(
          i / 5.5
        );

    const wind =
      2.2 +
      0.55 *
        Math.cos(
          i / 6.5
        );

    const te =
      b0 +
      bt * air +
      bs * sw +
      bu * wind;

    if (i > 0) {
      lake =
        M * lake +
        (1 - M) *
          te;
    }

    const observed =
      i % 5 === 0 ||
      i === 69
        ? lake +
          0.18 *
            Math.sin(
              i * 1.7
            )
        : null;

    lines.push(
      `${dateKey(d)},${air.toFixed(3)},${sw.toFixed(3)},${wind.toFixed(3)},${observed === null ? "" : observed.toFixed(3)}`
    );
  }

  return lines.join(
    "\n"
  );
}

async function loadTextDataset(
  text,
  name
) {
  try {
    state.frequency =
      getFrequency();

    const parsed =
      parseCSV(text);

    const rows =
      prepareData(
        parsed,
        state.frequency
      );

    state.rows =
      rows;

    state.fit =
      null;

    state.reconstruction =
      null;

    state.sourceName =
      name;

    els.fileName.textContent =
      name;

    renderInput(rows);
  } catch (err) {
    state.rows =
      null;

    els.dataSection.classList.add(
      "hidden"
    );

    els.resultsSection.classList.add(
      "hidden"
    );

    setStatus(
      err.message ||
        String(err),
      "danger"
    );
  }
}

els.csvFile.addEventListener(
  "change",
  async () => {
    const file =
      els.csvFile.files?.[0];

    if (!file) {
      return;
    }

    await loadTextDataset(
      await file.text(),
      file.name
    );
  }
);

for (
  const radio of
    document.querySelectorAll(
      'input[name="frequency"]'
    )
) {
  radio.addEventListener(
    "change",
    () => {
      state.frequency =
        getFrequency();

      if (state.rows) {
        setStatus(
          "Temporal resolution changed. Reload the CSV so dates can be validated for the new resolution.",
          "warning"
        );

        state.rows =
          null;

        els.dataSection.classList.add(
          "hidden"
        );

        els.resultsSection.classList.add(
          "hidden"
        );

        els.fileName.textContent =
          "Reload dataset for the selected resolution";

        els.csvFile.value =
          "";
      }
    }
  );
}

[
  "dragenter",
  "dragover",
].forEach(
  (eventName) =>
    els.dropZone.addEventListener(
      eventName,
      (e) => {
        e.preventDefault();

        els.dropZone.classList.add(
          "dragover"
        );
      }
    )
);

[
  "dragleave",
  "drop",
].forEach(
  (eventName) =>
    els.dropZone.addEventListener(
      eventName,
      (e) => {
        e.preventDefault();

        els.dropZone.classList.remove(
          "dragover"
        );
      }
    )
);

els.dropZone.addEventListener(
  "drop",
  async (e) => {
    const file =
      e.dataTransfer
        ?.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(
          ".csv"
        )
    ) {
      setStatus(
        "Please drop a CSV file.",
        "danger"
      );

      return;
    }

    await loadTextDataset(
      await file.text(),
      file.name
    );
  }
);

els.loadDemoBtn.addEventListener(
  "click",
  async () => {
    document.querySelector(
      'input[name="frequency"][value="Daily"]'
    ).checked = true;

    state.frequency =
      "Daily";

    await loadTextDataset(
      generateDemoCSV(),
      "built-in_daily_demo.csv"
    );
  }
);

els.downloadTemplateBtn.addEventListener(
  "click",
  () => {
    const template =
      [
        "date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c",
        "2026-06-01,15.2,410,2.4,10.0",
        "2026-06-02,15.8,430,2.1,",
        "2026-06-03,16.1,445,2.8,",
      ].join(
        "\n"
      );

    downloadText(
      template,
      "thermal_memory_input_template.csv",
      "text/csv;charset=utf-8"
    );
  }
);

els.runBtn.addEventListener(
  "click",
  async () => {
    if (!state.rows) {
      return;
    }

    els.runBtn.disabled =
      true;

    els.runMessage.textContent =
      "Calibrating model…";

    try {
      const fit =
        await fitModel(
          state.rows,
          state.frequency,
          10
        );

      const recon =
        reconstruct(
          state.rows,
          fit
        );

      state.fit =
        fit;

      state.reconstruction =
        recon;

      renderResults(
        fit,
        recon,
        state.frequency
      );

      setStatus(
        `Calibration completed successfully using ${fit.nObserved} observed LST values.`,
        "success"
      );

      els.runMessage.textContent =
        "Calibration complete.";
    } catch (err) {
      setStatus(
        `Model calibration failed: ${err.message || String(err)}`,
        "danger"
      );

      els.runMessage.textContent =
        "Calibration failed.";
    } finally {
      els.runBtn.disabled =
        false;
    }
  }
);

els.targetSelect.addEventListener(
  "change",
  updateTargetResult
);

els.downloadResultsBtn.addEventListener(
  "click",
  () => {
    if (
      !state.reconstruction
    ) {
      return;
    }

    downloadText(
      rowsToCSV(
        state.reconstruction
      ),
      "reconstructed_lake_surface_temperature.csv",
      "text/csv;charset=utf-8"
    );
  }
);

window.__thermalMemoryApp = {
  generateDemoCSV,
  loadTextDataset,
  getState: () =>
    state,
};
