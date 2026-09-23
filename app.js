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
  validation: null,
  finalFit: null,
  applicationRows: null,
  applicationOutput: null,
  sourceName: "",
  applicationSourceName: "",
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

  validationSplit: document.getElementById("validationSplit"),
  validationSplitValue: document.getElementById("validationSplitValue"),
  runValidationBtn: document.getElementById("runValidationBtn"),
  validationRunMessage: document.getElementById("validationRunMessage"),
  validationResults: document.getElementById("validationResults"),
  validationMetrics: document.getElementById("validationMetrics"),
  validationCaption: document.getElementById("validationCaption"),
  validationTimeChart: document.getElementById("validationTimeChart"),
  validationScatterChart: document.getElementById("validationScatterChart"),
  validationTableBody: document.getElementById("validationTableBody"),
  downloadValidationBtn: document.getElementById("downloadValidationBtn"),

  buildFinalBtn: document.getElementById("buildFinalBtn"),
  finalRunMessage: document.getElementById("finalRunMessage"),
  finalModelSection: document.getElementById("finalModelSection"),
  finalMetrics: document.getElementById("finalMetrics"),
  finalMemoryCaption: document.getElementById("finalMemoryCaption"),
  finalParameterBody: document.getElementById("finalParameterBody"),
  finalStateSummary: document.getElementById("finalStateSummary"),
  downloadFinalParamsBtn: document.getElementById("downloadFinalParamsBtn"),

  applicationCsvFile: document.getElementById("applicationCsvFile"),
  applicationDropZone: document.getElementById("applicationDropZone"),
  applicationFileName: document.getElementById("applicationFileName"),
  applicationStatusBox: document.getElementById("applicationStatusBox"),

  initialStateMode: document.getElementById("initialStateMode"),
  useApplicationAnchors: document.getElementById("useApplicationAnchors"),
  applicationMode: document.getElementById("applicationMode"),

  runApplicationBtn: document.getElementById("runApplicationBtn"),
  applicationRunMessage: document.getElementById(
    "applicationRunMessage"
  ),

  applicationResults: document.getElementById("applicationResults"),
  applicationMetrics: document.getElementById("applicationMetrics"),
  applicationCaption: document.getElementById("applicationCaption"),
  applicationChart: document.getElementById("applicationChart"),
  applicationTargetSelect: document.getElementById(
    "applicationTargetSelect"
  ),
  applicationTargetResult: document.getElementById(
    "applicationTargetResult"
  ),
  applicationTableBody: document.getElementById(
    "applicationTableBody"
  ),

  downloadApplicationBtn: document.getElementById(
    "downloadApplicationBtn"
  ),

  downloadApplicationTemplateBtn: document.getElementById(
    "downloadApplicationTemplateBtn"
  ),
};


/* ============================================================
   GENERAL UI HELPERS
   ============================================================ */

function setStatus(message, kind = "neutral") {
  els.statusBox.className = `status-box status-box--${kind}`;
  els.statusBox.textContent = message;
}

function setApplicationStatus(message, kind = "neutral") {
  if (!els.applicationStatusBox) return;

  els.applicationStatusBox.className =
    `status-box status-box--${kind}`;

  els.applicationStatusBox.textContent = message;
}

function getFrequency() {
  return document.querySelector(
    'input[name="frequency"]:checked'
  ).value;
}

function metric(label, value) {
  return `
    <div class="metric">
      <span class="metric__label">
        ${escapeHtml(label)}
      </span>

      <span class="metric__value">
        ${escapeHtml(String(value))}
      </span>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value, digits = 4) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  const n = Number(value);

  if (
    Math.abs(n) >= 1000 ||
    (Math.abs(n) > 0 && Math.abs(n) < 0.001)
  ) {
    return n.toExponential(3);
  }

  return n
    .toFixed(digits)
    .replace(/\.0+$|(?<=\.\d*?)0+$/g, "")
    .replace(/\.$/, "");
}


/* ============================================================
   CSV PARSING
   ============================================================ */

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

      if (row.some((v) => v.trim() !== "")) {
        rows.push(row);
      }

      row = [];
      field = "";

    } else {
      field += ch;
    }
  }

  row.push(field.replace(/\r$/, ""));

  if (row.some((v) => v.trim() !== "")) {
    rows.push(row);
  }

  if (!rows.length) {
    throw new Error("The CSV file is empty.");
  }

  const headers = rows[0].map(
    (h) => h.trim().replace(/^\uFEFF/, "")
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


/* ============================================================
   DATE HELPERS
   ============================================================ */

function utcDate(year, month, day) {
  return new Date(
    Date.UTC(year, month - 1, day)
  );
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

  const d = utcDate(
    year,
    month,
    day
  );

  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    throw new Error(
      `Invalid date: ${text}.`
    );
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
  return (
    `${date.getUTCFullYear()}-` +
    `${String(date.getUTCMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getUTCDate()).padStart(2, "0")}`
  );
}

function nextPeriod(date, frequency) {
  if (frequency === "Daily") {
    return new Date(
      date.getTime() + 86400000
    );
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

function displayDate(date, frequency) {
  if (frequency === "Daily") {
    return dateKey(date);
  }

  if (frequency === "Monthly") {
    return (
      `${date.getUTCFullYear()}-` +
      `${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }

  return String(
    date.getUTCFullYear()
  );
}


/* ============================================================
   PREPARE INPUT DATA
   ============================================================ */

function numeric(value, allowBlank = false) {
  const text = String(
    value ?? ""
  ).trim();

  if (
    text === "" &&
    allowBlank
  ) {
    return null;
  }

  const n = Number(text);

  return Number.isFinite(n)
    ? n
    : null;
}

function prepareData(
  rawRows,
  frequency
) {
  if (!rawRows.length) {
    throw new Error(
      "The CSV contains no data rows."
    );
  }

  const rows = rawRows.map(
    (r, index) => {

      const date = periodizeDate(
        parseDateStrict(r.date),
        frequency
      );

      const air =
        numeric(r.air_temp_c);

      const sw =
        numeric(r.shortwave_w_m2);

      const wind =
        numeric(r.wind_speed_m_s);

      const obs =
        numeric(
          r.observed_lst_c,
          true
        );

      if (
        air === null ||
        sw === null ||
        wind === null
      ) {
        throw new Error(
          "Atmospheric forcing cannot be missing " +
          `or non-numeric. Check CSV data row ${index + 2}.`
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
    }
  );

  rows.sort(
    (a, b) => a.date - b.date
  );

  const seen =
    new Set();

  for (const r of rows) {
    const key =
      dateKey(r.date);

    if (seen.has(key)) {
      throw new Error(
        "More than one row maps to the same selected " +
        `timestep: ${key}.`
      );
    }

    seen.add(key);
  }

  if (rows.length > 1) {

    const present =
      new Set(
        rows.map(
          (r) => dateKey(r.date)
        )
      );

    const missing = [];

    for (
      let d = rows[0].date;
      d <= rows[rows.length - 1].date;
      d = nextPeriod(
        d,
        frequency
      )
    ) {

      if (
        !present.has(
          dateKey(d)
        )
      ) {
        missing.push(
          dateKey(d)
        );
      }

      if (
        missing.length >= 9
      ) {
        break;
      }
    }

    if (missing.length) {

      const unit =
        frequency === "Daily"
          ? "day"
          : frequency === "Monthly"
          ? "month"
          : "year";

      throw new Error(
        `Atmospheric forcing must contain every ${unit} ` +
        "between the first and last row. " +
        `Missing timestep(s): ${missing.slice(0, 8).join(", ")}`
      );
    }
  }

  return rows;
}


/* ============================================================
   MODEL
   ============================================================ */

function tauBounds(frequency) {
  if (frequency === "Daily") {
    return [
      0.25,
      365.0
    ];
  }

  if (frequency === "Monthly") {
    return [
      0.10,
      60.0
    ];
  }

  return [
    0.05,
    20.0
  ];
}

function simulateFreeRun(
  rows,
  beta0,
  betaT,
  betaS,
  betaU,
  tau
) {
  const obsIndices =
    rows
      .map(
        (r, i) =>
          r.observed_lst_c !== null
            ? i
            : -1
      )
      .filter(
        (i) => i >= 0
      );

  if (!obsIndices.length) {
    throw new Error(
      "At least one observed LST is required."
    );
  }

  const first =
    obsIndices[0];

  const pred =
    Array(
      rows.length
    ).fill(null);

  pred[first] =
    rows[first].observed_lst_c;

  const m =
    Math.exp(
      -1 / tau
    );

  for (
    let i = first + 1;
    i < rows.length;
    i++
  ) {

    const te =
      beta0 +
      betaT *
        rows[i].air_temp_c +
      betaS *
        rows[i].shortwave_w_m2 +
      betaU *
        rows[i].wind_speed_m_s;

    pred[i] =
      m * pred[i - 1] +
      (1 - m) * te;
  }

  return pred;
}


/* ============================================================
   LINEAR ALGEBRA
   ============================================================ */

function solveLinearSystem(
  A,
  b
) {
  const n =
    b.length;

  const M =
    A.map(
      (row, i) => [
        ...row,
        b[i]
      ]
    );

  for (
    let col = 0;
    col < n;
    col++
  ) {

    let pivot =
      col;

    for (
      let r = col + 1;
      r < n;
      r++
    ) {

      if (
        Math.abs(
          M[r][col]
        ) >
        Math.abs(
          M[pivot][col]
        )
      ) {
        pivot = r;
      }
    }

    if (
      Math.abs(
        M[pivot][col]
      ) < 1e-12
    ) {
      throw new Error(
        "Singular matrix"
      );
    }

    [
      M[col],
      M[pivot]
    ] = [
      M[pivot],
      M[col]
    ];

    const p =
      M[col][col];

    for (
      let c = col;
      c <= n;
      c++
    ) {
      M[col][c] /= p;
    }

    for (
      let r = 0;
      r < n;
      r++
    ) {

      if (r === col) {
        continue;
      }

      const factor =
        M[r][col];

      for (
        let c = col;
        c <= n;
        c++
      ) {
        M[r][c] -=
          factor *
          M[col][c];
      }
    }
  }

  return M.map(
    (row) => row[n]
  );
}

function leastSquares(
  X,
  y
) {
  const p =
    X[0].length;

  const XtX =
    Array.from(
      {
        length: p
      },
      () =>
        Array(p).fill(0)
    );

  const Xty =
    Array(p).fill(0);

  for (
    let i = 0;
    i < X.length;
    i++
  ) {

    for (
      let j = 0;
      j < p;
      j++
    ) {

      Xty[j] +=
        X[i][j] *
        y[i];

      for (
        let k = 0;
        k < p;
        k++
      ) {

        XtX[j][k] +=
          X[i][j] *
          X[i][k];
      }
    }
  }

  for (
    let i = 0;
    i < p;
    i++
  ) {
    XtX[i][i] +=
      1e-8;
  }

  return solveLinearSystem(
    XtX,
    Xty
  );
}

function initialBetaGuess(rows) {
  const obs =
    rows.filter(
      (r) =>
        r.observed_lst_c !== null
    );

  if (obs.length < 4) {
    return [
      0,
      0.8,
      0.003,
      -0.1
    ];
  }

  const X =
    obs.map(
      (r) => [
        1,
        r.air_temp_c,
        r.shortwave_w_m2,
        r.wind_speed_m_s
      ]
    );

  const y =
    obs.map(
      (r) =>
        r.observed_lst_c
    );

  try {
    return leastSquares(
      X,
      y
    );

  } catch {
    return [
      0,
      0.8,
      0.003,
      -0.1
    ];
  }
}


/* ============================================================
   NUMERICAL OPTIMIZATION
   ============================================================ */

function clamp(
  value,
  lo,
  hi
) {
  return Math.max(
    lo,
    Math.min(
      hi,
      value
    )
  );
}

function geomspace(
  start,
  stop,
  count
) {
  const values = [];

  const logStart =
    Math.log(start);

  const logStop =
    Math.log(stop);

  for (
    let i = 0;
    i < count;
    i++
  ) {

    const f =
      count === 1
        ? 0
        : i / (count - 1);

    values.push(
      Math.exp(
        logStart +
        f *
          (logStop - logStart)
      )
    );
  }

  return values;
}

function nelderMead(
  objective,
  start,
  options = {}
) {
  const maxIter =
    options.maxIter ?? 600;

  const tol =
    options.tol ?? 1e-7;

  const n =
    start.length;

  const simplex = [
    start.slice()
  ];

  for (
    let i = 0;
    i < n;
    i++
  ) {
    const point =
      start.slice();

    point[i] +=
      0.07;

    simplex.push(
      point
    );
  }

  let values =
    simplex.map(
      objective
    );

  const alpha = 1;
  const gamma = 2;
  const rho = 0.5;
  const sigma = 0.5;

  const combine = (
    a,
    b,
    wa,
    wb
  ) =>
    a.map(
      (v, i) =>
        wa * v +
        wb * b[i]
    );

  for (
    let iter = 0;
    iter < maxIter;
    iter++
  ) {

    const order =
      values
        .map(
          (v, i) => ({
            v,
            i
          })
        )
        .sort(
          (a, b) =>
            a.v - b.v
        );

    const orderedSimplex =
      order.map(
        (o) =>
          simplex[o.i]
      );

    const orderedValues =
      order.map(
        (o) => o.v
      );

    for (
      let i = 0;
      i <= n;
      i++
    ) {
      simplex[i] =
        orderedSimplex[i];

      values[i] =
        orderedValues[i];
    }

    const spread =
      Math.max(
        ...values
      ) -
      Math.min(
        ...values
      );

    if (
      spread < tol
    ) {
      break;
    }

    const centroid =
      Array(n).fill(0);

    for (
      let i = 0;
      i < n;
      i++
    ) {
      for (
        let j = 0;
        j < n;
        j++
      ) {
        centroid[j] +=
          simplex[i][j] /
          n;
      }
    }

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
      objective(
        reflected
      );

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
        objective(
          expanded
        );

      if (
        fe < fr
      ) {
        simplex[n] =
          expanded;

        values[n] =
          fe;

      } else {
        simplex[n] =
          reflected;

        values[n] =
          fr;
      }

    } else if (
      fr < values[n - 1]
    ) {

      simplex[n] =
        reflected;

      values[n] =
        fr;

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
        objective(
          contracted
        );

      if (
        fc <
        (
          outside
            ? fr
            : values[n]
        )
      ) {

        simplex[n] =
          contracted;

        values[n] =
          fc;

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
    x:
      simplex[bestI].slice(),

    value:
      values[bestI]
  };
}


/* ============================================================
   FIT MODEL
   ============================================================ */

async function fitModel(
  rows,
  frequency,
  minObservations = 10,
  onProgress = null
) {
  const obsIdx =
    rows
      .map(
        (r, i) =>
          r.observed_lst_c !== null
            ? i
            : -1
      )
      .filter(
        (i) => i >= 0
      );

  const nObs =
    obsIdx.length;

  if (
    nObs < minObservations
  ) {
    throw new Error(
      `This tool requires at least ${minObservations} ` +
      `observed LST values for calibration. Found ${nObs}.`
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
    initialBetaGuess(
      rows
    );

  const [
    tauLo,
    tauHi
  ] =
    tauBounds(
      frequency
    );

  const lower = [
    -100,
    -5,
    -0.10,
    -10,
    Math.log(tauLo)
  ];

  const upper = [
    100,
    5,
    0.10,
    10,
    Math.log(tauHi)
  ];

  const toX =
    (y) =>
      y.map(
        (v, i) =>
          lower[i] +
          v *
            (
              upper[i] -
              lower[i]
            )
      );

  const toY =
    (x) =>
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

  const residualVector =
    (x) => {

      const [
        b0,
        bt,
        bs,
        bu,
        logTau
      ] = x;

      const tau =
        Math.exp(
          logTau
        );

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
          rows[i].observed_lst_c
      );
    };

  const softL1 =
    (x) => {

      const r =
        residualVector(x);

      let total = 0;

      for (
        const e of r
      ) {

        total +=
          2 *
          (
            Math.sqrt(
              1 +
              e * e
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
    k < tauStarts.length;
    k++
  ) {

    const x0 = [
      betaInit[0],
      betaInit[1],
      betaInit[2],
      betaInit[3],
      Math.log(
        tauStarts[k]
      )
    ].map(
      (v, i) =>
        clamp(
          v,
          lower[i] + 1e-10,
          upper[i] - 1e-10
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
          tol: 1e-7
        }
      );

    const x =
      toX(
        result.x
      );

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
      Number.isFinite(
        sse
      )
    ) {

      candidates.push({
        x,
        sse
      });
    }

    if (
      typeof onProgress ===
      "function"
    ) {

      onProgress(
        k + 1,
        tauStarts.length
      );
    }

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
    logTau
  ] =
    candidates[0].x;

  const tau =
    Math.exp(
      logTau
    );

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
        rows[i].observed_lst_c
    );

  const yPred =
    fitObsIdx.map(
      (i) =>
        pred[i]
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
          s +
          e * e,
        0
      ) /
      errors.length
    );

  const mae =
    errors.reduce(
      (s, e) =>
        s +
        Math.abs(e),
      0
    ) /
    errors.length;

  const meanY =
    yTrue.reduce(
      (a, b) =>
        a + b,
      0
    ) /
    yTrue.length;

  const sst =
    yTrue.reduce(
      (s, y) =>
        s +
        (
          y -
          meanY
        ) ** 2,
      0
    );

  const r2 =
    sst > 0
      ? 1 -
        errors.reduce(
          (s, e) =>
            s +
            e * e,
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
      pred
  };
}


/* ============================================================
   RECONSTRUCTION
   ============================================================ */

function reconstruct(
  rows,
  fit
) {
  const obsIdx =
    rows
      .map(
        (r, i) =>
          r.observed_lst_c !== null
            ? i
            : -1
      )
      .filter(
        (i) => i >= 0
      );

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
    rows[first].observed_lst_c;

  source[first] =
    "Observed anchor";

  const m =
    Math.exp(
      -1 /
      fit.tau
    );

  for (
    let i = first + 1;
    i < rows.length;
    i++
  ) {

    if (
      rows[i].observed_lst_c !== null
    ) {

      pred[i] =
        rows[i].observed_lst_c;

      source[i] =
        "Observed anchor";

    } else {

      const te =
        fit.beta0 +
        fit.betaT *
          rows[i].air_temp_c +
        fit.betaS *
          rows[i].shortwave_w_m2 +
        fit.betaU *
          rows[i].wind_speed_m_s;

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
        source[i]
    })
  );
}


/* ============================================================
   INPUT DISPLAY
   ============================================================ */

function renderInput(rows) {
  const nObs =
    rows.filter(
      (r) =>
        r.observed_lst_c !== null
    ).length;

  els.inputMetrics.innerHTML = [
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
            <td>
              ${dateKey(r.date)}
            </td>

            <td>
              ${formatNumber(
                r.air_temp_c,
                3
              )}
            </td>

            <td>
              ${formatNumber(
                r.shortwave_w_m2,
                3
              )}
            </td>

            <td>
              ${formatNumber(
                r.wind_speed_m_s,
                3
              )}
            </td>

            <td>
              ${
                r.observed_lst_c === null
                  ? "—"
                  : formatNumber(
                      r.observed_lst_c,
                      3
                    )
              }
            </td>
          </tr>
        `
      )
      .join("");

  els.previewNote.textContent =
    rows.length > maxRows
      ? `Showing the first ${maxRows} of ${rows.length} rows.`
      : `Showing all ${rows.length} rows.`;

  els.dataSection
    .classList
    .remove(
      "hidden"
    );

  els.resultsSection
    .classList
    .add(
      "hidden"
    );

  state.validation = null;
  state.finalFit = null;
  state.applicationRows = null;
  state.applicationOutput = null;

  if (
    els.validationResults
  ) {
    els.validationResults
      .classList
      .add(
        "hidden"
      );
  }

  if (
    els.downloadValidationBtn
  ) {
    els.downloadValidationBtn.disabled =
      true;
  }

  if (
    els.finalModelSection
  ) {
    els.finalModelSection
      .classList
      .add(
        "hidden"
      );
  }

  if (
    els.downloadFinalParamsBtn
  ) {
    els.downloadFinalParamsBtn.disabled =
      true;
  }

  if (
    els.applicationResults
  ) {
    els.applicationResults
      .classList
      .add(
        "hidden"
      );
  }

  if (
    els.applicationFileName
  ) {
    els.applicationFileName.textContent =
      "No application dataset loaded";
  }

  if (
    els.applicationStatusBox
  ) {
    setApplicationStatus(
      "Load an application dataset after building the final model.",
      "neutral"
    );
  }

  els.runBtn.disabled =
    nObs < 10;

  if (
    nObs < 10
  ) {

    setStatus(
      `Dataset is structurally valid, but only ${nObs} ` +
      "observed LST values are present. At least 10 " +
      "are required for calibration.",
      "warning"
    );

  } else {

    setStatus(
      `Dataset validated: ${rows.length} timesteps and ` +
      `${nObs} observed LST values are ready for calibration.`,
      "success"
    );
  }
}


/* ============================================================
   CALIBRATION RESULTS
   ============================================================ */

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
      -1 /
      fit.tau
    );

  const horizon =
    3 *
    fit.tau;

  els.resultMetrics.innerHTML = [

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
    "Approximate 5%-memory horizon ≈ " +
    `3τ = ${horizon.toFixed(2)} ${unit}.`;

  const params = [

    [
      "β₀",
      fit.beta0,
      "Intercept"
    ],

    [
      "βT",
      fit.betaT,
      "Air-temperature coefficient"
    ],

    [
      "βS",
      fit.betaS,
      "Shortwave-radiation coefficient"
    ],

    [
      "βU",
      fit.betaU,
      "Wind-speed coefficient"
    ],

    [
      "τ",
      fit.tau,
      `Characteristic thermal response time (${unit})`
    ],

  ];

  els.parameterBody.innerHTML =
    params
      .map(
        (
          [
            p,
            v,
            meaning
          ]
        ) => `
          <tr>
            <td>
              <strong>
                ${p}
              </strong>
            </td>

            <td>
              ${formatNumber(
                v,
                6
              )}
            </td>

            <td>
              ${meaning}
            </td>
          </tr>
        `
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
          r.reconstructed_lst_c !== null
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
          `<option value="${i}">` +
          `${displayDate(recon[i].date, frequency)}` +
          "</option>"
      )
      .join("");

  if (
    valid.length
  ) {
    els.targetSelect.value =
      String(
        valid[
          valid.length - 1
        ]
      );
  }

  updateTargetResult();

  els.resultsSection
    .classList
    .remove(
      "hidden"
    );

  els.resultsSection
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}


/* ============================================================
   MAIN CHART
   ============================================================ */

function drawChart(
  rows,
  frequency
) {
  const valid =
    rows
      .map(
        (r, i) =>
          r.reconstructed_lst_c !== null
            ? {
                ...r,
                i
              }
            : null
      )
      .filter(
        Boolean
      );

  if (
    !valid.length
  ) {

    els.chart.innerHTML =
      "<p>No reconstructed values to plot.</p>";

    return;
  }

  const values =
    valid
      .flatMap(
        (r) => [
          r.reconstructed_lst_c,
          r.observed_lst_c
        ]
      )
      .filter(
        (v) =>
          v !== null &&
          Number.isFinite(v)
      );

  let yMin =
    Math.min(
      ...values
    );

  let yMax =
    Math.max(
      ...values
    );

  if (
    yMin === yMax
  ) {
    yMin -= 1;
    yMax += 1;
  }

  const pad =
    Math.max(
      0.8,
      (
        yMax -
        yMin
      ) *
      0.12
    );

  yMin -= pad;
  yMax += pad;

  const W = 1100;
  const H = 410;
  const left = 66;
  const right = 28;
  const top = 28;
  const bottom = 56;

  const plotW =
    W -
    left -
    right;

  const plotH =
    H -
    top -
    bottom;

  const x =
    (index) =>
      left +
      (
        valid.length === 1
          ? plotW / 2
          : index /
            (
              valid.length - 1
            ) *
            plotW
      );

  const y =
    (value) =>
      top +
      (
        yMax -
        value
      ) /
      (
        yMax -
        yMin
      ) *
      plotH;

  let grid = "";

  for (
    let t = 0;
    t <= 5;
    t++
  ) {

    const val =
      yMin +
      (
        yMax -
        yMin
      ) *
      t /
      5;

    const yy =
      y(val);

    grid += `
      <line
        x1="${left}"
        y1="${yy}"
        x2="${W - right}"
        y2="${yy}"
        stroke="#e7eef1"
        stroke-width="1"
      />
    `;

    grid += `
      <text
        x="${left - 11}"
        y="${yy + 4}"
        text-anchor="end"
      >
        ${val.toFixed(1)}
      </text>
    `;
  }

  let labels = "";

  const nTicks =
    Math.min(
      6,
      valid.length
    );

  for (
    let t = 0;
    t < nTicks;
    t++
  ) {

    const idx =
      Math.round(
        (
          valid.length -
          1
        ) *
        t /
        Math.max(
          1,
          nTicks -
          1
        )
      );

    labels += `
      <text
        x="${x(idx)}"
        y="${H - 19}"
        text-anchor="middle"
      >
        ${escapeHtml(
          displayDate(
            valid[idx].date,
            frequency
          )
        )}
      </text>
    `;
  }

  const linePath =
    valid
      .map(
        (r, i) =>
          `${i ? "L" : "M"}` +
          `${x(i).toFixed(2)},` +
          `${y(r.reconstructed_lst_c).toFixed(2)}`
      )
      .join(" ");

  const areaPath =
    `${linePath} ` +
    `L${x(valid.length - 1)},${H - bottom} ` +
    `L${x(0)},${H - bottom} Z`;

  const observedDots =
    valid
      .map(
        (r, i) =>
          r.observed_lst_c !== null
            ? `
              <circle
                cx="${x(i)}"
                cy="${y(r.observed_lst_c)}"
                r="4.9"
                fill="#d05b58"
                stroke="#fff"
                stroke-width="2"
              />
            `
            : ""
      )
      .join("");

  els.chart.innerHTML = `
    <div
      class="chart-tooltip"
      id="mainChartTooltip"
    ></div>

    <svg
      viewBox="0 0 ${W} ${H}"
      preserveAspectRatio="none"
      aria-hidden="true"
    >

      <defs>
        <linearGradient
          id="mainAreaGradient"
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >

          <stop
            offset="0%"
            stop-color="#0f6f76"
            stop-opacity="0.17"
          />

          <stop
            offset="100%"
            stop-color="#0f6f76"
            stop-opacity="0.01"
          />

        </linearGradient>
      </defs>

      ${grid}

      <line
        x1="${left}"
        y1="${top}"
        x2="${left}"
        y2="${H - bottom}"
        stroke="#b8c8ce"
      />

      <line
        x1="${left}"
        y1="${H - bottom}"
        x2="${W - right}"
        y2="${H - bottom}"
        stroke="#b8c8ce"
      />

      <path
        d="${areaPath}"
        fill="url(#mainAreaGradient)"
      />

      <path
        d="${linePath}"
        fill="none"
        stroke="#0f6f76"
        stroke-width="3"
        vector-effect="non-scaling-stroke"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      ${observedDots}

      <line
        id="mainCrosshair"
        x1="0"
        y1="${top}"
        x2="0"
        y2="${H - bottom}"
        stroke="#79939d"
        stroke-width="1"
        stroke-dasharray="4 5"
        opacity="0"
      />

      <circle
        id="mainHoverPoint"
        cx="0"
        cy="0"
        r="5.5"
        fill="#0f6f76"
        stroke="#fff"
        stroke-width="2"
        opacity="0"
      />

      ${labels}

      <text
        x="18"
        y="${top + plotH / 2}"
        text-anchor="middle"
        transform="rotate(-90 18 ${top + plotH / 2})"
      >
        LST (°C)
      </text>

    </svg>
  `;

  attachTimeTooltip(
    els.chart,
    valid,
    frequency,
    {
      W,
      H,
      left,
      right,
      top,
      bottom,
      x,
      y
    },
    "mainChartTooltip",
    "mainCrosshair",
    "mainHoverPoint",

    (r) => ({
      title:
        displayDate(
          r.date,
          frequency
        ),

      lines: [
        `Modeled: ${r.reconstructed_lst_c.toFixed(2)} °C`,
        r.observed_lst_c === null
          ? "Observed: —"
          : `Observed: ${r.observed_lst_c.toFixed(2)} °C`,
        `State source: ${r.state_source}`,
      ],
    })
  );
}


/* ============================================================
   CHART TOOLTIP
   ============================================================ */

function attachTimeTooltip(
  container,
  rows,
  frequency,
  dims,
  tooltipId,
  crosshairId,
  pointId,
  contentBuilder
) {
  const svg =
    container.querySelector(
      "svg"
    );

  const tooltip =
    container.querySelector(
      `#${tooltipId}`
    );

  const crosshair =
    container.querySelector(
      `#${crosshairId}`
    );

  const point =
    container.querySelector(
      `#${pointId}`
    );

  if (
    !svg ||
    !tooltip ||
    !crosshair ||
    !point
  ) {
    return;
  }

  const hide = () => {
    tooltip
      .classList
      .remove(
        "is-visible"
      );

    crosshair.setAttribute(
      "opacity",
      "0"
    );

    point.setAttribute(
      "opacity",
      "0"
    );
  };

  svg.addEventListener(
    "pointerleave",
    hide
  );

  svg.addEventListener(
    "pointermove",
    (event) => {

      const rect =
        svg.getBoundingClientRect();

      const scaleX =
        dims.W /
        rect.width;

      const px =
        (
          event.clientX -
          rect.left
        ) *
        scaleX;

      const frac =
        clamp(
          (
            px -
            dims.left
          ) /
          (
            dims.W -
            dims.left -
            dims.right
          ),
          0,
          1
        );

      const index =
        Math.round(
          frac *
          (
            rows.length -
            1
          )
        );

      const row =
        rows[index];

      const xx =
        dims.x(index);

      const value =
        row.reconstructed_lst_c ??
        row.predicted_lst_c ??
        row.modeled_lst_c;

      const yy =
        dims.y(value);

      crosshair.setAttribute(
        "x1",
        xx
      );

      crosshair.setAttribute(
        "x2",
        xx
      );

      crosshair.setAttribute(
        "opacity",
        "1"
      );

      point.setAttribute(
        "cx",
        xx
      );

      point.setAttribute(
        "cy",
        yy
      );

      point.setAttribute(
        "opacity",
        "1"
      );

      const content =
        contentBuilder(
          row
        );

      tooltip.innerHTML =
        `<strong>${escapeHtml(content.title)}</strong>` +
        content.lines
          .map(
            (line) =>
              `<div>${escapeHtml(line)}</div>`
          )
          .join("");

      tooltip.style.left =
        `${event.offsetX}px`;

      tooltip.style.top =
        `${event.offsetY}px`;

      tooltip
        .classList
        .add(
          "is-visible"
        );
    }
  );
}


/* ============================================================
   SELECTED HISTORICAL TIMESTEP
   ============================================================ */

function updateTargetResult() {
  const idx =
    Number(
      els.targetSelect.value
    );

  if (
    !state.reconstruction ||
    !state.reconstruction[idx]
  ) {

    els.targetResult.textContent =
      "Select a timestep.";

    return;
  }

  const row =
    state.reconstruction[idx];

  els.targetResult.innerHTML = `
    <div>
      <div>
        <strong>
          ${formatNumber(
            row.reconstructed_lst_c,
            3
          )} °C
        </strong>
      </div>

      <div>
        ${escapeHtml(
          displayDate(
            row.date,
            state.frequency
          )
        )}
      </div>

      <div class="helper">
        ${
          row.observed_lst_c !== null
            ? "Observed LST is available at this timestep."
            : "Modeled from atmospheric forcing and thermal memory."
        }
      </div>
    </div>
  `;
}


/* ============================================================
   CSV DOWNLOAD HELPERS
   ============================================================ */

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
    "state_source"
  ];

  const lines = [
    header.join(",")
  ];

  for (
    const r of rows
  ) {

    lines.push(
      [
        dateKey(r.date),
        r.air_temp_c,
        r.shortwave_w_m2,
        r.wind_speed_m_s,

        r.observed_lst_c === null
          ? ""
          : r.observed_lst_c,

        r.reconstructed_lst_c === null
          ? ""
          : r.reconstructed_lst_c,

        r.state_source,

      ]
        .map(
          csvEscape
        )
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
      {
        type
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const a =
    document.createElement(
      "a"
    );

  a.href =
    url;

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


/* ============================================================
   DEMO CSV
   ============================================================ */

function generateDemoCSV() {
  const lines = [
    "date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c"
  ];

  const start =
    utcDate(
      2026,
      5,
      1
    );

  let lake =
    10.8;

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
      0.085 *
      i +
      2.8 *
      Math.sin(
        i / 8
      );

    const sw =
      320 +
      2.6 *
      i +
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
      bt *
      air +
      bs *
      sw +
      bu *
      wind;

    if (
      i > 0
    ) {

      lake =
        M *
        lake +
        (
          1 -
          M
        ) *
        te;
    }

    const observed =
      i % 5 === 0 ||
      i === 69
        ? lake +
          0.18 *
          Math.sin(
            i *
            1.7
          )
        : null;

    lines.push(
      `${dateKey(d)},` +
      `${air.toFixed(3)},` +
      `${sw.toFixed(3)},` +
      `${wind.toFixed(3)},` +
      `${
        observed === null
          ? ""
          : observed.toFixed(3)
      }`
    );
  }

  return lines.join(
    "\n"
  );
}


/* ============================================================
   LOAD CALIBRATION DATASET
   ============================================================ */

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

    state.validation =
      null;

    state.finalFit =
      null;

    state.applicationRows =
      null;

    state.applicationOutput =
      null;

    state.sourceName =
      name;

    els.fileName.textContent =
      name;

    renderInput(
      rows
    );

  } catch (err) {

    state.rows =
      null;

    els.dataSection
      .classList
      .add(
        "hidden"
      );

    els.resultsSection
      .classList
      .add(
        "hidden"
      );

    setStatus(
      err.message ||
      String(err),
      "danger"
    );
  }
}


/* ============================================================
   VALIDATION
   ============================================================ */

function validationSplit(
  rows,
  calibrationPercent
) {
  const obsIdx =
    rows
      .map(
        (r, i) =>
          r.observed_lst_c !== null
            ? i
            : -1
      )
      .filter(
        (i) => i >= 0
      );

  if (
    obsIdx.length < 12
  ) {
    throw new Error(
      "At least 12 observed LST values are recommended " +
      "for chronological hold-out validation."
    );
  }

  let nTrain =
    Math.floor(
      obsIdx.length *
      calibrationPercent /
      100
    );

  nTrain =
    Math.max(
      10,
      nTrain
    );

  nTrain =
    Math.min(
      nTrain,
      obsIdx.length - 2
    );

  const trainIdx =
    obsIdx.slice(
      0,
      nTrain
    );

  const testIdx =
    obsIdx.slice(
      nTrain
    );

  const maskedRows =
    rows.map(
      (r, i) => ({
        ...r,

        observed_lst_c:
          trainIdx.includes(i)
            ? r.observed_lst_c
            : null
      })
    );

  return {
    obsIdx,
    trainIdx,
    testIdx,
    maskedRows
  };
}

function validationStats(
  originalRows,
  predictions,
  testIdx
) {
  const observed =
    testIdx.map(
      (i) =>
        originalRows[i].observed_lst_c
    );

  const predicted =
    testIdx.map(
      (i) =>
        predictions[i]
    );

  const errors =
    predicted.map(
      (v, i) =>
        v -
        observed[i]
    );

  const rmse =
    Math.sqrt(
      errors.reduce(
        (s, e) =>
          s +
          e * e,
        0
      ) /
      errors.length
    );

  const mae =
    errors.reduce(
      (s, e) =>
        s +
        Math.abs(e),
      0
    ) /
    errors.length;

  const bias =
    errors.reduce(
      (a, b) =>
        a + b,
      0
    ) /
    errors.length;

  const meanY =
    observed.reduce(
      (a, b) =>
        a + b,
      0
    ) /
    observed.length;

  const sst =
    observed.reduce(
      (s, y) =>
        s +
        (
          y -
          meanY
        ) ** 2,
      0
    );

  const sse =
    errors.reduce(
      (s, e) =>
        s +
        e * e,
      0
    );

  const r2 =
    sst > 0
      ? 1 -
        sse /
        sst
      : NaN;

  return {
    observed,
    predicted,
    errors,
    rmse,
    mae,
    bias,
    r2
  };
}

function renderValidation(
  validation,
  frequency
) {
  const {
    calibrationPercent,
    split,
    fit,
    stats,
    entries
  } =
    validation;

  const M =
    Math.exp(
      -1 /
      fit.tau
    );

  els.validationMetrics.innerHTML = [

    metric(
      "Calibration observations",
      split.trainIdx.length
    ),

    metric(
      "Held-out observations",
      split.testIdx.length
    ),

    metric(
      "Validation RMSE",
      `${stats.rmse.toFixed(3)} °C`
    ),

    metric(
      "Validation MAE",
      `${stats.mae.toFixed(3)} °C`
    ),

    metric(
      "Validation R²",
      Number.isFinite(stats.r2)
        ? stats.r2.toFixed(3)
        : "—"
    ),

    metric(
      "Mean bias",
      `${stats.bias.toFixed(3)} °C`
    ),

    metric(
      "Validation τ",
      formatNumber(
        fit.tau,
        3
      )
    ),

    metric(
      "Validation M",
      M.toFixed(4)
    ),

  ].join("");

  els.validationCaption.textContent =
    `${calibrationPercent}% of observed LST dates were used ` +
    "for chronological calibration; later observed dates " +
    "were withheld for independent evaluation.";

  els.validationTableBody.innerHTML =
    entries
      .map(
        (r) => `
          <tr>

            <td>
              ${dateKey(r.date)}
            </td>

            <td>
              ${formatNumber(
                r.observed_lst_c,
                3
              )}
            </td>

            <td>
              ${formatNumber(
                r.predicted_lst_c,
                3
              )}
            </td>

            <td>
              ${formatNumber(
                r.residual_c,
                3
              )}
            </td>

          </tr>
        `
      )
      .join("");

  drawValidationTimeChart(
    validation,
    frequency
  );

  drawValidationScatter(
    validation
  );

  els.validationResults
    .classList
    .remove(
      "hidden"
    );

  els.downloadValidationBtn.disabled =
    false;
}

function drawValidationTimeChart(
  validation,
  frequency
) {
  const {
    fit,
    split
  } =
    validation;

  const pred =
    fit.freeRun;

  const start =
    split.trainIdx[0];

  const rows =
    state.rows
      .slice(start)
      .map(
        (r, offset) => ({
          ...r,
          originalIndex:
            start + offset,
          predicted_lst_c:
            pred[
              start +
              offset
            ]
        })
      )
      .filter(
        (r) =>
          Number.isFinite(
            r.predicted_lst_c
          )
      );

  if (
    !rows.length
  ) {
    els.validationTimeChart.innerHTML =
      "<p>No validation predictions to plot.</p>";

    return;
  }

  const testSet =
    new Set(
      split.testIdx
    );

  const trainSet =
    new Set(
      split.trainIdx
    );

  const vals =
    rows
      .flatMap(
        (r) => [
          r.predicted_lst_c,
          r.observed_lst_c
        ]
      )
      .filter(
        (v) =>
          v !== null &&
          Number.isFinite(v)
      );

  let yMin =
    Math.min(
      ...vals
    );

  let yMax =
    Math.max(
      ...vals
    );

  if (
    yMin === yMax
  ) {
    yMin -= 1;
    yMax += 1;
  }

  const pad =
    Math.max(
      0.8,
      (
        yMax -
        yMin
      ) *
      0.12
    );

  yMin -= pad;
  yMax += pad;

  const W = 1100;
  const H = 410;
  const left = 66;
  const right = 28;
  const top = 28;
  const bottom = 56;

  const plotW =
    W -
    left -
    right;

  const plotH =
    H -
    top -
    bottom;

  const x =
    (i) =>
      left +
      (
        rows.length === 1
          ? plotW / 2
          : i /
            (
              rows.length -
              1
            ) *
            plotW
      );

  const y =
    (v) =>
      top +
      (
        yMax -
        v
      ) /
      (
        yMax -
        yMin
      ) *
      plotH;

  let grid = "";

  for (
    let t = 0;
    t <= 5;
    t++
  ) {

    const val =
      yMin +
      (
        yMax -
        yMin
      ) *
      t /
      5;

    const yy =
      y(val);

    grid += `
      <line
        x1="${left}"
        y1="${yy}"
        x2="${W - right}"
        y2="${yy}"
        stroke="#e7eef1"
      />

      <text
        x="${left - 11}"
        y="${yy + 4}"
        text-anchor="end"
      >
        ${val.toFixed(1)}
      </text>
    `;
  }

  let labels = "";

  const nTicks =
    Math.min(
      6,
      rows.length
    );

  for (
    let t = 0;
    t < nTicks;
    t++
  ) {

    const idx =
      Math.round(
        (
          rows.length -
          1
        ) *
        t /
        Math.max(
          1,
          nTicks -
          1
        )
      );

    labels += `
      <text
        x="${x(idx)}"
        y="${H - 19}"
        text-anchor="middle"
      >
        ${escapeHtml(
          displayDate(
            rows[idx].date,
            frequency
          )
        )}
      </text>
    `;
  }

  const path =
    rows
      .map(
        (r, i) =>
          `${i ? "L" : "M"}` +
          `${x(i).toFixed(2)},` +
          `${y(r.predicted_lst_c).toFixed(2)}`
      )
      .join(" ");

  const trainDots =
    rows
      .map(
        (r, i) =>
          trainSet.has(
            r.originalIndex
          ) &&
          r.observed_lst_c !== null
            ? `
              <circle
                cx="${x(i)}"
                cy="${y(r.observed_lst_c)}"
                r="4.2"
                fill="#0f6f76"
                stroke="#fff"
                stroke-width="2"
              />
            `
            : ""
      )
      .join("");

  const testDots =
    rows
      .map(
        (r, i) =>
          testSet.has(
            r.originalIndex
          ) &&
          r.observed_lst_c !== null
            ? `
              <circle
                cx="${x(i)}"
                cy="${y(r.observed_lst_c)}"
                r="5.5"
                fill="#d05b58"
                stroke="#fff"
                stroke-width="2.2"
              />
            `
            : ""
      )
      .join("");

  const cutoffPos =
    rows.findIndex(
      (r) =>
        r.originalIndex ===
        split.testIdx[0]
    );

  const cutoffX =
    cutoffPos >= 0
      ? x(cutoffPos)
      : null;

  els.validationTimeChart.innerHTML = `
    <div
      class="chart-tooltip"
      id="validationChartTooltip"
    ></div>

    <svg
      viewBox="0 0 ${W} ${H}"
      preserveAspectRatio="none"
      aria-hidden="true"
    >

      <defs>
        <linearGradient
          id="validationAreaGradient"
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >

          <stop
            offset="0%"
            stop-color="#5069a8"
            stop-opacity="0.17"
          />

          <stop
            offset="100%"
            stop-color="#5069a8"
            stop-opacity="0.01"
          />

        </linearGradient>
      </defs>

      ${grid}

      <line
        x1="${left}"
        y1="${top}"
        x2="${left}"
        y2="${H - bottom}"
        stroke="#b8c8ce"
      />

      <line
        x1="${left}"
        y1="${H - bottom}"
        x2="${W - right}"
        y2="${H - bottom}"
        stroke="#b8c8ce"
      />

      <path
        d="${path} L${x(rows.length - 1)},${H - bottom} L${x(0)},${H - bottom} Z"
        fill="url(#validationAreaGradient)"
      />

      <path
        d="${path}"
        fill="none"
        stroke="#5069a8"
        stroke-width="3"
        vector-effect="non-scaling-stroke"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      ${
        cutoffX === null
          ? ""
          : `
            <line
              x1="${cutoffX}"
              y1="${top}"
              x2="${cutoffX}"
              y2="${H - bottom}"
              stroke="#95a5ad"
              stroke-width="1.5"
              stroke-dasharray="7 6"
              vector-effect="non-scaling-stroke"
            />

            <text
              class="validation-cutoff-label"
              x="${Math.min(
                cutoffX + 7,
                W - right - 90
              )}"
              y="${top + 14}"
            >
              validation period
            </text>
          `
      }

      ${trainDots}
      ${testDots}

      <line
        id="validationCrosshair"
        x1="0"
        y1="${top}"
        x2="0"
        y2="${H - bottom}"
        stroke="#79939d"
        stroke-width="1"
        stroke-dasharray="4 5"
        opacity="0"
      />

      <circle
        id="validationHoverPoint"
        cx="0"
        cy="0"
        r="5.5"
        fill="#5069a8"
        stroke="#fff"
        stroke-width="2"
        opacity="0"
      />

      ${labels}

      <text
        x="18"
        y="${top + plotH / 2}"
        text-anchor="middle"
        transform="rotate(-90 18 ${top + plotH / 2})"
      >
        LST (°C)
      </text>

    </svg>
  `;

  attachTimeTooltip(
    els.validationTimeChart,
    rows,
    frequency,

    {
      W,
      H,
      left,
      right,
      top,
      bottom,
      x,
      y
    },

    "validationChartTooltip",
    "validationCrosshair",
    "validationHoverPoint",

    (r) => ({
      title:
        displayDate(
          r.date,
          frequency
        ),

      lines: [

        `Predicted: ${r.predicted_lst_c.toFixed(2)} °C`,

        r.observed_lst_c === null
          ? "Observed: —"
          : `Observed: ${r.observed_lst_c.toFixed(2)} °C`,

        testSet.has(
          r.originalIndex
        )
          ? "Role: held-out validation"
          : trainSet.has(
              r.originalIndex
            )
          ? "Role: calibration observation"
          : "Role: forcing-only timestep",

      ]
    })
  );
}

function drawValidationScatter(
  validation
) {
  const entries =
    validation.entries;

  if (
    !entries.length
  ) {

    els.validationScatterChart.innerHTML =
      "<p>No held-out observations to plot.</p>";

    return;
  }

  const values =
    entries.flatMap(
      (r) => [
        r.observed_lst_c,
        r.predicted_lst_c
      ]
    );

  let minV =
    Math.min(
      ...values
    );

  let maxV =
    Math.max(
      ...values
    );

  if (
    minV === maxV
  ) {
    minV -= 1;
    maxV += 1;
  }

  const pad =
    Math.max(
      0.5,
      (
        maxV -
        minV
      ) *
      0.12
    );

  minV -= pad;
  maxV += pad;

  const W = 520;
  const H = 410;
  const left = 62;
  const right = 24;
  const top = 28;
  const bottom = 56;

  const plotW =
    W -
    left -
    right;

  const plotH =
    H -
    top -
    bottom;

  const x =
    (v) =>
      left +
      (
        v -
        minV
      ) /
      (
        maxV -
        minV
      ) *
      plotW;

  const y =
    (v) =>
      top +
      (
        maxV -
        v
      ) /
      (
        maxV -
        minV
      ) *
      plotH;

  let grid = "";

  for (
    let t = 0;
    t <= 5;
    t++
  ) {

    const v =
      minV +
      (
        maxV -
        minV
      ) *
      t /
      5;

    const xx =
      x(v);

    const yy =
      y(v);

    grid += `
      <line
        x1="${left}"
        y1="${yy}"
        x2="${W - right}"
        y2="${yy}"
        stroke="#e7eef1"
      />

      <line
        x1="${xx}"
        y1="${top}"
        x2="${xx}"
        y2="${H - bottom}"
        stroke="#eef3f5"
      />

      <text
        x="${left - 9}"
        y="${yy + 4}"
        text-anchor="end"
      >
        ${v.toFixed(1)}
      </text>

      <text
        x="${xx}"
        y="${H - 19}"
        text-anchor="middle"
      >
        ${v.toFixed(1)}
      </text>
    `;
  }

  const dots =
    entries
      .map(
        (r) => `
          <circle
            class="scatter-point"
            cx="${x(r.observed_lst_c)}"
            cy="${y(r.predicted_lst_c)}"
            r="6"
            fill="#d05b58"
            stroke="#fff"
            stroke-width="2"
          >
            <title>
              ${dateKey(r.date)} ·
              Obs ${r.observed_lst_c.toFixed(2)} °C ·
              Pred ${r.predicted_lst_c.toFixed(2)} °C
            </title>
          </circle>
        `
      )
      .join("");

  els.validationScatterChart.innerHTML = `
    <svg
      viewBox="0 0 ${W} ${H}"
      preserveAspectRatio="none"
      aria-hidden="true"
    >

      ${grid}

      <line
        x1="${x(minV)}"
        y1="${y(minV)}"
        x2="${x(maxV)}"
        y2="${y(maxV)}"
        stroke="#5069a8"
        stroke-width="2"
        stroke-dasharray="7 6"
        vector-effect="non-scaling-stroke"
      />

      ${dots}

      <text
        x="${left + plotW / 2}"
        y="${H - 3}"
        text-anchor="middle"
      >
        Observed LST (°C)
      </text>

      <text
        x="17"
        y="${top + plotH / 2}"
        text-anchor="middle"
        transform="rotate(-90 17 ${top + plotH / 2})"
      >
        Predicted LST (°C)
      </text>

    </svg>
  `;
}

function validationRowsToCSV(
  validation
) {
  const lines = [
    [
      "date",
      "observed_lst_c",
      "predicted_lst_c",
      "residual_c"
    ].join(",")
  ];

  for (
    const r of validation.entries
  ) {

    lines.push(
      [
        dateKey(r.date),
        r.observed_lst_c,
        r.predicted_lst_c,
        r.residual_c
      ]
        .map(
          csvEscape
        )
        .join(",")
    );
  }

  return lines.join(
    "\n"
  );
}


/* ============================================================
   FINAL MODEL
   ============================================================ */

function renderFinalModel(
  fit,
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
      -1 /
      fit.tau
    );

  const horizon =
    3 *
    fit.tau;

  els.finalMetrics.innerHTML = [

    metric(
      "τ (final response time)",
      `${fit.tau.toFixed(3)} ${unit}`
    ),

    metric(
      "Final memory coefficient M",
      M.toFixed(4)
    ),

    metric(
      "Final RMSE",
      `${fit.rmse.toFixed(3)} °C`
    ),

    metric(
      "Final MAE",
      `${fit.mae.toFixed(3)} °C`
    ),

    metric(
      "Final R²",
      Number.isFinite(fit.r2)
        ? fit.r2.toFixed(3)
        : "—"
    ),

  ].join("");

  els.finalMemoryCaption.textContent =
    `Final model memory horizon ≈ 3τ = ` +
    `${horizon.toFixed(2)} ${unit}. ` +
    "These parameters are carried into Step 06.";

  const params = [

    [
      "β₀",
      fit.beta0,
      "Intercept"
    ],

    [
      "βT",
      fit.betaT,
      "Air-temperature coefficient"
    ],

    [
      "βS",
      fit.betaS,
      "Shortwave-radiation coefficient"
    ],

    [
      "βU",
      fit.betaU,
      "Wind-speed coefficient"
    ],

    [
      "τ",
      fit.tau,
      `Characteristic thermal response time (${unit})`
    ],

  ];

  els.finalParameterBody.innerHTML =
    params
      .map(
        (
          [
            p,
            v,
            meaning
          ]
        ) => `
          <tr>
            <td>
              <strong>
                ${p}
              </strong>
            </td>

            <td>
              ${formatNumber(
                v,
                6
              )}
            </td>

            <td>
              ${meaning}
            </td>
          </tr>
        `
      )
      .join("");

  const recon =
    state.reconstruction ||
    [];

  const lastRow =
    [...recon]
      .reverse()
      .find(
        (r) =>
          Number.isFinite(
            r.reconstructed_lst_c
          )
      );

  if (
    lastRow
  ) {

    els.finalStateSummary.innerHTML = `

      <div class="metric-inline">

        <strong>
          Historical calibration dataset
        </strong>

        <span>
          ${escapeHtml(
            state.sourceName ||
            "Uploaded calibration dataset"
          )}
        </span>

      </div>

      <div class="metric-inline">

        <strong>
          Observed LST used
        </strong>

        <span>
          ${fit.nObserved} values
        </span>

      </div>

      <div class="metric-inline">

        <strong>
          Last modeled historical state
        </strong>

        <span>
          ${displayDate(
            lastRow.date,
            frequency
          )}
          ·
          ${formatNumber(
            lastRow.reconstructed_lst_c,
            3
          )} °C
        </span>

      </div>

      <div class="metric-inline">

        <strong>
          Ready for Step 06
        </strong>

        <span>
          The final model can now be applied to another
          period of atmospheric forcing.
        </span>

      </div>
    `;

  } else {

    els.finalStateSummary.innerHTML = `
      <div class="metric-inline">
        <strong>
          Ready for Step 06
        </strong>

        <span>
          The final model is available for application.
        </span>
      </div>
    `;
  }

  els.finalModelSection
    .classList
    .remove(
      "hidden"
    );

  els.downloadFinalParamsBtn.disabled =
    false;
}

function finalParamsToJSON() {
  if (
    !state.finalFit
  ) {
    return "";
  }

  const lastRow =
    (
      state.reconstruction ||
      []
    )
      .slice()
      .reverse()
      .find(
        (r) =>
          Number.isFinite(
            r.reconstructed_lst_c
          )
      );

  return JSON.stringify(
    {

      source_dataset:
        state.sourceName,

      frequency:
        state.frequency,

      parameters: {

        beta0:
          state.finalFit.beta0,

        betaT:
          state.finalFit.betaT,

        betaS:
          state.finalFit.betaS,

        betaU:
          state.finalFit.betaU,

        tau:
          state.finalFit.tau,

        memory_coefficient_M:
          Math.exp(
            -1 /
            state.finalFit.tau
          )
      },

      calibration_statistics: {

        rmse:
          state.finalFit.rmse,

        mae:
          state.finalFit.mae,

        r2:
          state.finalFit.r2,

        observed_values:
          state.finalFit.nObserved
      },

      last_historical_modeled_state:
        lastRow
          ? {
              date:
                dateKey(
                  lastRow.date
                ),

              lst_c:
                lastRow.reconstructed_lst_c
            }
          : null
    },

    null,
    2
  );
}


/* ============================================================
   APPLICATION / RECONSTRUCTION / PREDICTION
   ============================================================ */

function applicationRowsToCSV(rows) {
  const lines = [

    [
      "date",
      "air_temp_c",
      "shortwave_w_m2",
      "wind_speed_m_s",
      "observed_lst_c",
      "modeled_lst_c",
      "state_source"
    ].join(",")

  ];

  for (
    const r of rows
  ) {

    lines.push(
      [
        dateKey(r.date),
        r.air_temp_c,
        r.shortwave_w_m2,
        r.wind_speed_m_s,
        r.observed_lst_c,
        r.modeled_lst_c,
        r.state_source
      ]
        .map(
          csvEscape
        )
        .join(",")
    );
  }

  return lines.join(
    "\n"
  );
}

async function loadApplicationDataset(
  text,
  name
) {
  try {

    const parsed =
      parseCSV(text);

    const rows =
      prepareData(
        parsed,
        state.frequency
      );

    state.applicationRows =
      rows;

    state.applicationOutput =
      null;

    state.applicationSourceName =
      name;

    els.applicationFileName.textContent =
      name;

    els.applicationResults
      .classList
      .add(
        "hidden"
      );

    setApplicationStatus(
      `Application dataset loaded: ${rows.length} timesteps ` +
      "are ready for reconstruction / prediction.",
      "success"
    );

  } catch (err) {

    state.applicationRows =
      null;

    state.applicationOutput =
      null;

    els.applicationFileName.textContent =
      "No application dataset loaded";

    setApplicationStatus(
      `Application dataset error: ` +
      `${err.message || String(err)}`,
      "danger"
    );
  }
}

function runApplicationModel() {
  if (
    !state.finalFit
  ) {
    throw new Error(
      "Build the final model first in Step 05."
    );
  }

  if (
    !state.applicationRows ||
    !state.applicationRows.length
  ) {
    throw new Error(
      "Load an application dataset first."
    );
  }

  if (
    !state.reconstruction ||
    !state.reconstruction.length
  ) {
    throw new Error(
      "Historical reconstruction is unavailable."
    );
  }

  const lastHistorical =
    [...state.reconstruction]
      .reverse()
      .find(
        (r) =>
          Number.isFinite(
            r.reconstructed_lst_c
          )
      );

  if (
    !lastHistorical
  ) {
    throw new Error(
      "Could not determine the last modeled historical LST."
    );
  }

  const mode =
    els.initialStateMode.value;

  const useObservedAnchors =
    !!els.useApplicationAnchors.checked;

  const appMode =
    els.applicationMode.value;

  const labelMap = {

    fill_gaps:
      "Gap-filling",

    hindcast:
      "Historical / remote-period reconstruction",

    forecast:
      "Prediction / projection"
  };

  const m =
    Math.exp(
      -1 /
      state.finalFit.tau
    );

  const rows =
    state.applicationRows.map(
      (r) => ({
        ...r
      })
    );

  const output = [];

  let previous;

  let startIndex = 0;


  /* --------------------------------------------------------
     INITIAL STATE OPTION 1:
     CONTINUE FROM LAST HISTORICAL MODELED STATE
     -------------------------------------------------------- */

  if (
    mode === "historical_last"
  ) {

    previous =
      lastHistorical.reconstructed_lst_c;

    const firstRow =
      rows[0];

    if (
      useObservedAnchors &&
      firstRow.observed_lst_c !== null
    ) {

      previous =
        firstRow.observed_lst_c;

      output.push({
        ...firstRow,

        modeled_lst_c:
          previous,

        state_source:
          "Observed anchor"
      });

    } else {

      const te =
        state.finalFit.beta0 +
        state.finalFit.betaT *
          firstRow.air_temp_c +
        state.finalFit.betaS *
          firstRow.shortwave_w_m2 +
        state.finalFit.betaU *
          firstRow.wind_speed_m_s;

      previous =
        m *
          previous +
        (
          1 -
          m
        ) *
          te;

      output.push({
        ...firstRow,

        modeled_lst_c:
          previous,

        state_source:
          "Model"
      });
    }

    startIndex = 1;
  }


  /* --------------------------------------------------------
     INITIAL STATE OPTION 2:
     USE FIRST AVAILABLE OBSERVED APPLICATION LST
     -------------------------------------------------------- */

  if (
    mode === "first_observed"
  ) {

    const firstObservedIndex =
      rows.findIndex(
        (r) =>
          r.observed_lst_c !== null
      );

    if (
      firstObservedIndex < 0
    ) {

      throw new Error(
        "The application dataset contains no observed LST " +
        "that can be used as the starting anchor."
      );
    }

    for (
      let i = 0;
      i < firstObservedIndex;
      i++
    ) {

      output.push({
        ...rows[i],

        modeled_lst_c:
          null,

        state_source:
          "Before initial anchor"
      });
    }

    previous =
      rows[
        firstObservedIndex
      ].observed_lst_c;

    output.push({
      ...rows[
        firstObservedIndex
      ],

      modeled_lst_c:
        previous,

      state_source:
        "Observed anchor"
    });

    startIndex =
      firstObservedIndex +
      1;
  }


  /* --------------------------------------------------------
     RECURSIVE APPLICATION
     -------------------------------------------------------- */

  for (
    let i = startIndex;
    i < rows.length;
    i++
  ) {

    const r =
      rows[i];

    if (
      useObservedAnchors &&
      r.observed_lst_c !== null
    ) {

      previous =
        r.observed_lst_c;

      output.push({
        ...r,

        modeled_lst_c:
          previous,

        state_source:
          "Observed anchor"
      });

    } else {

      const te =
        state.finalFit.beta0 +
        state.finalFit.betaT *
          r.air_temp_c +
        state.finalFit.betaS *
          r.shortwave_w_m2 +
        state.finalFit.betaU *
          r.wind_speed_m_s;

      previous =
        m *
          previous +
        (
          1 -
          m
        ) *
          te;

      output.push({
        ...r,

        modeled_lst_c:
          previous,

        state_source:
          "Model"
      });
    }
  }

  state.applicationOutput =
    output;

  return {

    rows:
      output,

    options: {

      initialStateMode:
        mode,

      useObservedAnchors,

      label:
        labelMap[appMode] ||
        "Application"
    }
  };
}


/* ============================================================
   APPLICATION RESULTS
   ============================================================ */

function renderApplicationResults(
  rows,
  options
) {
  const usableRows =
    rows.filter(
      (r) =>
        Number.isFinite(
          r.modeled_lst_c
        )
    );

  if (
    !usableRows.length
  ) {
    throw new Error(
      "No modeled application values were produced."
    );
  }

  const anchorCount =
    rows.filter(
      (r) =>
        r.state_source ===
        "Observed anchor"
    ).length;

  const lastRow =
    usableRows[
      usableRows.length -
      1
    ];

  const initialText =
    options.initialStateMode ===
    "first_observed"
      ? "First available observed LST in application file"
      : "Last modeled historical LST";

  els.applicationMetrics.innerHTML = [

    metric(
      "Application timesteps",
      rows.length
    ),

    metric(
      "Observed LST in application file",
      rows.filter(
        (r) =>
          r.observed_lst_c !== null
      ).length
    ),

    metric(
      "Observed anchors used",
      anchorCount
    ),

    metric(
      "Initial state",
      initialText
    ),

    metric(
      "Last modeled LST",
      `${formatNumber(
        lastRow.modeled_lst_c,
        3
      )} °C`
    )

  ].join("");

  els.applicationCaption.textContent =
    `${options.label} completed using the final model from Step 05. ` +
    `Observed anchors ${
      options.useObservedAnchors
        ? "were allowed whenever available"
        : "were not used after the starting condition"
    }.`;

  drawApplicationChart(
    rows,
    state.frequency
  );

  els.applicationTargetSelect.innerHTML =
    usableRows
      .map(
        (r, i) =>
          `<option value="${rows.indexOf(r)}">` +
          `${displayDate(r.date, state.frequency)}` +
          "</option>"
      )
      .join("");

  if (
    usableRows.length
  ) {

    els.applicationTargetSelect.value =
      String(
        rows.indexOf(
          lastRow
        )
      );
  }

  updateApplicationTargetResult();

  els.applicationTableBody.innerHTML =
    rows
      .slice(
        0,
        18
      )
      .map(
        (r) => `
          <tr>

            <td>
              ${dateKey(r.date)}
            </td>

            <td>
              ${
                r.observed_lst_c === null
                  ? "—"
                  : formatNumber(
                      r.observed_lst_c,
                      3
                    )
              }
            </td>

            <td>
              ${
                Number.isFinite(
                  r.modeled_lst_c
                )
                  ? formatNumber(
                      r.modeled_lst_c,
                      3
                    )
                  : "—"
              }
            </td>

            <td>
              ${escapeHtml(
                r.state_source
              )}
            </td>

          </tr>
        `
      )
      .join("");

  els.applicationResults
    .classList
    .remove(
      "hidden"
    );
}

function updateApplicationTargetResult() {
  const idx =
    Number(
      els.applicationTargetSelect?.value ??
      "-1"
    );

  if (
    !state.applicationOutput ||
    !Number.isFinite(idx) ||
    !state.applicationOutput[idx]
  ) {

    if (
      els.applicationTargetResult
    ) {
      els.applicationTargetResult.innerHTML =
        "Select an application timestep to inspect the modeled LST.";
    }

    return;
  }

  const row =
    state.applicationOutput[idx];

  const dateText =
    escapeHtml(
      displayDate(
        row.date,
        state.frequency
      )
    );

  if (
    !Number.isFinite(
      row.modeled_lst_c
    )
  ) {

    els.applicationTargetResult.innerHTML = `
      <div>
        <div>
          <strong>Not initialized</strong>
        </div>

        <div>
          ${dateText}
        </div>

        <div class="helper">
          This timestep occurs before the selected initial observed anchor.
        </div>
      </div>
    `;

    return;
  }

  els.applicationTargetResult.innerHTML = `
    <div>

      <div>
        <strong>
          ${formatNumber(
            row.modeled_lst_c,
            3
          )} °C
        </strong>
      </div>

      <div>
        ${dateText}
      </div>

      <div class="helper">
        State source:
        ${escapeHtml(
          row.state_source
        )}
      </div>

    </div>
  `;
}


/* ============================================================
   APPLICATION CHART
   ============================================================ */

function drawApplicationChart(
  rows,
  frequency
) {
  const valid =
    rows
      .map(
        (r, i) =>
          Number.isFinite(
            r.modeled_lst_c
          )
            ? {
                ...r,
                i
              }
            : null
      )
      .filter(
        Boolean
      );

  if (
    !valid.length
  ) {

    els.applicationChart.innerHTML =
      "<p>No modeled values to plot.</p>";

    return;
  }

  const values =
    valid
      .flatMap(
        (r) => [
          r.modeled_lst_c,
          r.observed_lst_c
        ]
      )
      .filter(
        (v) =>
          v !== null &&
          Number.isFinite(v)
      );

  let yMin =
    Math.min(
      ...values
    );

  let yMax =
    Math.max(
      ...values
    );

  if (
    yMin === yMax
  ) {
    yMin -= 1;
    yMax += 1;
  }

  const pad =
    Math.max(
      0.8,
      (
        yMax -
        yMin
      ) *
      0.12
    );

  yMin -= pad;
  yMax += pad;

  const W = 1100;
  const H = 410;
  const left = 66;
  const right = 28;
  const top = 28;
  const bottom = 56;

  const plotW =
    W -
    left -
    right;

  const plotH =
    H -
    top -
    bottom;

  const x =
    (index) =>
      left +
      (
        valid.length === 1
          ? plotW / 2
          : index /
            (
              valid.length -
              1
            ) *
            plotW
      );

  const y =
    (value) =>
      top +
      (
        yMax -
        value
      ) /
      (
        yMax -
        yMin
      ) *
      plotH;

  let grid = "";

  for (
    let t = 0;
    t <= 5;
    t++
  ) {

    const val =
      yMin +
      (
        yMax -
        yMin
      ) *
      t /
      5;

    const yy =
      y(val);

    grid += `
      <line
        x1="${left}"
        y1="${yy}"
        x2="${W - right}"
        y2="${yy}"
        stroke="#e7eef1"
        stroke-width="1"
      />

      <text
        x="${left - 11}"
        y="${yy + 4}"
        text-anchor="end"
      >
        ${val.toFixed(1)}
      </text>
    `;
  }

  let labels = "";

  const nTicks =
    Math.min(
      6,
      valid.length
    );

  for (
    let t = 0;
    t < nTicks;
    t++
  ) {

    const idx =
      Math.round(
        (
          valid.length -
          1
        ) *
        t /
        Math.max(
          1,
          nTicks -
          1
        )
      );

    labels += `
      <text
        x="${x(idx)}"
        y="${H - 19}"
        text-anchor="middle"
      >
        ${escapeHtml(
          displayDate(
            valid[idx].date,
            frequency
          )
        )}
      </text>
    `;
  }

  const linePath =
    valid
      .map(
        (r, i) =>
          `${i ? "L" : "M"}` +
          `${x(i).toFixed(2)},` +
          `${y(r.modeled_lst_c).toFixed(2)}`
      )
      .join(" ");

  const areaPath =
    `${linePath} ` +
    `L${x(valid.length - 1)},${H - bottom} ` +
    `L${x(0)},${H - bottom} Z`;

  const observedDots =
    valid
      .map(
        (r, i) =>
          r.observed_lst_c !== null
            ? `
              <circle
                cx="${x(i)}"
                cy="${y(r.observed_lst_c)}"
                r="4.9"
                fill="#d05b58"
                stroke="#fff"
                stroke-width="2"
              />
            `
            : ""
      )
      .join("");

  els.applicationChart.innerHTML = `

    <div
      class="chart-tooltip"
      id="applicationChartTooltip"
    ></div>

    <svg
      viewBox="0 0 ${W} ${H}"
      preserveAspectRatio="none"
      aria-hidden="true"
    >

      <defs>
        <linearGradient
          id="applicationAreaGradient"
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >

          <stop
            offset="0%"
            stop-color="#8b5cf6"
            stop-opacity="0.18"
          />

          <stop
            offset="100%"
            stop-color="#8b5cf6"
            stop-opacity="0.01"
          />

        </linearGradient>
      </defs>

      ${grid}

      <line
        x1="${left}"
        y1="${top}"
        x2="${left}"
        y2="${H - bottom}"
        stroke="#b8c8ce"
      />

      <line
        x1="${left}"
        y1="${H - bottom}"
        x2="${W - right}"
        y2="${H - bottom}"
        stroke="#b8c8ce"
      />

      <path
        d="${areaPath}"
        fill="url(#applicationAreaGradient)"
      />

      <path
        d="${linePath}"
        fill="none"
        stroke="#8b5cf6"
        stroke-width="3"
        vector-effect="non-scaling-stroke"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      ${observedDots}

      <line
        id="applicationCrosshair"
        x1="0"
        y1="${top}"
        x2="0"
        y2="${H - bottom}"
        stroke="#8e8e9b"
        stroke-width="1"
        stroke-dasharray="4 5"
        opacity="0"
      />

      <circle
        id="applicationHoverPoint"
        cx="0"
        cy="0"
        r="5.5"
        fill="#8b5cf6"
        stroke="#fff"
        stroke-width="2"
        opacity="0"
      />

      ${labels}

      <text
        x="18"
        y="${top + plotH / 2}"
        text-anchor="middle"
        transform="rotate(-90 18 ${top + plotH / 2})"
      >
        LST (°C)
      </text>

    </svg>
  `;

  attachTimeTooltip(
    els.applicationChart,
    valid,
    frequency,

    {
      W,
      H,
      left,
      right,
      top,
      bottom,
      x,
      y
    },

    "applicationChartTooltip",
    "applicationCrosshair",
    "applicationHoverPoint",

    (r) => ({
      title:
        displayDate(
          r.date,
          frequency
        ),

      lines: [

        `Modeled: ${r.modeled_lst_c.toFixed(2)} °C`,

        r.observed_lst_c === null
          ? "Observed: —"
          : `Observed: ${r.observed_lst_c.toFixed(2)} °C`,

        `State source: ${r.state_source}`

      ]
    })
  );
}


/* ============================================================
   FILE EVENTS
   ============================================================ */

els.csvFile.addEventListener(
  "change",
  async () => {

    const file =
      els.csvFile.files?.[0];

    if (
      !file
    ) {
      return;
    }

    await loadTextDataset(
      await file.text(),
      file.name
    );
  }
);


/* ------------------------------------------------------------
   TEMPORAL RESOLUTION
   ------------------------------------------------------------ */

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

      if (
        state.rows
      ) {

        setStatus(
          "Temporal resolution changed. Reload the CSV so dates " +
          "can be validated for the new resolution.",
          "warning"
        );

        state.rows =
          null;

        state.fit =
          null;

        state.validation =
          null;

        state.finalFit =
          null;

        state.applicationRows =
          null;

        state.applicationOutput =
          null;

        els.dataSection
          .classList
          .add(
            "hidden"
          );

        els.resultsSection
          .classList
          .add(
            "hidden"
          );

        els.fileName.textContent =
          "Reload dataset for the selected resolution";

        els.csvFile.value =
          "";

        if (
          els.applicationCsvFile
        ) {
          els.applicationCsvFile.value =
            "";
        }

        if (
          els.applicationFileName
        ) {
          els.applicationFileName.textContent =
            "No application dataset loaded";
        }
      }
    }
  );
}


/* ------------------------------------------------------------
   MAIN DRAG AND DROP
   ------------------------------------------------------------ */

[
  "dragenter",
  "dragover"
].forEach(
  (eventName) =>
    els.dropZone.addEventListener(
      eventName,
      (e) => {

        e.preventDefault();

        els.dropZone
          .classList
          .add(
            "dragover"
          );
      }
    )
);

[
  "dragleave",
  "drop"
].forEach(
  (eventName) =>
    els.dropZone.addEventListener(
      eventName,
      (e) => {

        e.preventDefault();

        els.dropZone
          .classList
          .remove(
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

    if (
      !file
    ) {
      return;
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(".csv")
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


/* ============================================================
   DEMO DATA
   ============================================================ */

els.loadDemoBtn.addEventListener(
  "click",
  async () => {

    document.querySelector(
      'input[name="frequency"][value="Daily"]'
    ).checked =
      true;

    state.frequency =
      "Daily";

    await loadTextDataset(
      generateDemoCSV(),
      "built-in_daily_demo.csv"
    );
  }
);


/* ============================================================
   DOWNLOAD CALIBRATION TEMPLATE
   ============================================================ */

els.downloadTemplateBtn.addEventListener(
  "click",
  () => {

    const template = [

      "date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c",

      "2026-06-01,15.2,410,2.4,10.0",

      "2026-06-02,15.8,430,2.1,",

      "2026-06-03,16.1,445,2.8,"

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


/* ============================================================
   STEP 03 CALIBRATION
   ============================================================ */

els.runBtn.addEventListener(
  "click",
  async () => {

    if (
      !state.rows
    ) {
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
          10,

          (k, total) => {

            els.runMessage.textContent =
              `Calibrating… ${k} / ${total} starting points`;
          }
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

      state.validation =
        null;

      state.finalFit =
        null;

      state.applicationRows =
        null;

      state.applicationOutput =
        null;

      if (
        els.validationResults
      ) {
        els.validationResults
          .classList
          .add(
            "hidden"
          );
      }

      if (
        els.downloadValidationBtn
      ) {
        els.downloadValidationBtn.disabled =
          true;
      }

      if (
        els.finalModelSection
      ) {
        els.finalModelSection
          .classList
          .add(
            "hidden"
          );
      }

      if (
        els.downloadFinalParamsBtn
      ) {
        els.downloadFinalParamsBtn.disabled =
          true;
      }

      if (
        els.applicationResults
      ) {
        els.applicationResults
          .classList
          .add(
            "hidden"
          );
      }

      renderResults(
        fit,
        recon,
        state.frequency
      );

      setStatus(
        "Calibration completed successfully using " +
        `${fit.nObserved} observed LST values.`,
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


/* ============================================================
   HISTORICAL TARGET
   ============================================================ */

els.targetSelect.addEventListener(
  "change",
  updateTargetResult
);


/* ============================================================
   DOWNLOAD HISTORICAL RECONSTRUCTION
   ============================================================ */

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


/* ============================================================
   VALIDATION SPLIT
   ============================================================ */

if (
  els.validationSplit
) {

  els.validationSplit.addEventListener(
    "input",
    () => {

      els.validationSplitValue.textContent =
        `${els.validationSplit.value}%`;
    }
  );
}


/* ============================================================
   STEP 04 VALIDATION
   ============================================================ */

if (
  els.runValidationBtn
) {

  els.runValidationBtn.addEventListener(
    "click",
    async () => {

      if (
        !state.rows ||
        !state.fit
      ) {

        setStatus(
          "Calibrate and reconstruct the model before running validation.",
          "warning"
        );

        return;
      }

      els.runValidationBtn.disabled =
        true;

      els.validationRunMessage.textContent =
        "Preparing chronological hold-out…";

      try {

        const calibrationPercent =
          Number(
            els.validationSplit.value ||
            70
          );

        const split =
          validationSplit(
            state.rows,
            calibrationPercent
          );

        const fit =
          await fitModel(
            split.maskedRows,
            state.frequency,
            10,

            (k, total) => {

              els.validationRunMessage.textContent =
                `Validation calibration… ${k} / ${total} starting points`;
            }
          );

        const stats =
          validationStats(
            state.rows,
            fit.freeRun,
            split.testIdx
          );

        const entries =
          split.testIdx.map(
            (i, j) => ({

              date:
                state.rows[i].date,

              observed_lst_c:
                state.rows[i].observed_lst_c,

              predicted_lst_c:
                fit.freeRun[i],

              residual_c:
                stats.errors[j]

            })
          );

        const validation = {

          calibrationPercent,
          split,
          fit,
          stats,
          entries

        };

        state.validation =
          validation;

        renderValidation(
          validation,
          state.frequency
        );

        els.validationRunMessage.textContent =
          "Independent validation complete.";

      } catch (err) {

        state.validation =
          null;

        els.validationResults
          .classList
          .add(
            "hidden"
          );

        els.downloadValidationBtn.disabled =
          true;

        els.validationRunMessage.textContent =
          `Validation failed: ${err.message || String(err)}`;

      } finally {

        els.runValidationBtn.disabled =
          false;
      }
    }
  );
}


/* ============================================================
   DOWNLOAD VALIDATION CSV
   ============================================================ */

if (
  els.downloadValidationBtn
) {

  els.downloadValidationBtn.addEventListener(
    "click",
    () => {

      if (
        !state.validation
      ) {
        return;
      }

      downloadText(
        validationRowsToCSV(
          state.validation
        ),
        "independent_validation_results.csv",
        "text/csv;charset=utf-8"
      );
    }
  );
}


/* ============================================================
   STEP 05 FINAL MODEL
   ============================================================ */

if (
  els.buildFinalBtn
) {

  els.buildFinalBtn.addEventListener(
    "click",
    async () => {

      if (
        !state.rows ||
        !state.fit
      ) {

        setStatus(
          "Calibrate the model first before building the final model.",
          "warning"
        );

        return;
      }

      els.buildFinalBtn.disabled =
        true;

      els.finalRunMessage.textContent =
        "Building final model…";

      try {

        const finalFit =
          await fitModel(
            state.rows,
            state.frequency,
            10,

            (k, total) => {

              els.finalRunMessage.textContent =
                `Final model calibration… ${k} / ${total} starting points`;
            }
          );

        state.finalFit =
          finalFit;

        renderFinalModel(
          finalFit,
          state.frequency
        );

        els.finalRunMessage.textContent =
          "Final model ready.";

        setApplicationStatus(
          "Final model is ready. You can now load an application dataset for reconstruction or prediction.",
          "success"
        );

      } catch (err) {

        state.finalFit =
          null;

        if (
          els.finalModelSection
        ) {
          els.finalModelSection
            .classList
            .add(
              "hidden"
            );
        }

        els.downloadFinalParamsBtn.disabled =
          true;

        els.finalRunMessage.textContent =
          `Final model failed: ${err.message || String(err)}`;

      } finally {

        els.buildFinalBtn.disabled =
          false;
      }
    }
  );
}


/* ============================================================
   DOWNLOAD FINAL PARAMETERS
   ============================================================ */

if (
  els.downloadFinalParamsBtn
) {

  els.downloadFinalParamsBtn.addEventListener(
    "click",
    () => {

      if (
        !state.finalFit
      ) {
        return;
      }

      downloadText(
        finalParamsToJSON(),
        "final_thermal_memory_parameters.json",
        "application/json;charset=utf-8"
      );
    }
  );
}


/* ============================================================
   APPLICATION FILE UPLOAD
   ============================================================ */

if (
  els.applicationCsvFile
) {

  els.applicationCsvFile.addEventListener(
    "change",
    async () => {

      const file =
        els.applicationCsvFile.files?.[0];

      if (
        !file
      ) {
        return;
      }

      await loadApplicationDataset(
        await file.text(),
        file.name
      );
    }
  );
}


/* ============================================================
   APPLICATION DRAG AND DROP
   ============================================================ */

if (
  els.applicationDropZone
) {

  [
    "dragenter",
    "dragover"
  ].forEach(
    (eventName) =>
      els.applicationDropZone.addEventListener(
        eventName,
        (e) => {

          e.preventDefault();

          els.applicationDropZone
            .classList
            .add(
              "dragover"
            );
        }
      )
  );

  [
    "dragleave",
    "drop"
  ].forEach(
    (eventName) =>
      els.applicationDropZone.addEventListener(
        eventName,
        (e) => {

          e.preventDefault();

          els.applicationDropZone
            .classList
            .remove(
              "dragover"
            );
        }
      )
  );

  els.applicationDropZone.addEventListener(
    "drop",
    async (e) => {

      const file =
        e.dataTransfer
          ?.files?.[0];

      if (
        !file
      ) {
        return;
      }

      if (
        !file.name
          .toLowerCase()
          .endsWith(".csv")
      ) {

        setApplicationStatus(
          "Please drop a CSV file.",
          "danger"
        );

        return;
      }

      await loadApplicationDataset(
        await file.text(),
        file.name
      );
    }
  );
}


/* ============================================================
   APPLICATION TEMPLATE
   ============================================================ */

if (
  els.downloadApplicationTemplateBtn
) {

  els.downloadApplicationTemplateBtn.addEventListener(
    "click",
    () => {

      const template = [

        "date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c",

        "2027-01-01,15.6,405,2.1,",

        "2027-01-02,15.9,418,2.0,",

        "2027-01-03,16.2,430,2.3,16.7"

      ].join(
        "\n"
      );

      downloadText(
        template,
        "thermal_memory_application_template.csv",
        "text/csv;charset=utf-8"
      );
    }
  );
}


/* ============================================================
   STEP 06 APPLICATION
   ============================================================ */

if (
  els.runApplicationBtn
) {

  els.runApplicationBtn.addEventListener(
    "click",
    () => {

      els.runApplicationBtn.disabled =
        true;

      els.applicationRunMessage.textContent =
        "Running reconstruction / prediction…";

      try {

        const {
          rows,
          options
        } =
          runApplicationModel();

        renderApplicationResults(
          rows,
          options
        );

        els.applicationRunMessage.textContent =
          "Application run complete.";

        setApplicationStatus(
          `Application run completed for ${rows.length} timesteps.`,
          "success"
        );

      } catch (err) {

        state.applicationOutput =
          null;

        if (
          els.applicationResults
        ) {
          els.applicationResults
            .classList
            .add(
              "hidden"
            );
        }

        els.applicationRunMessage.textContent =
          `Application run failed: ${err.message || String(err)}`;

        setApplicationStatus(
          `Application run failed: ${err.message || String(err)}`,
          "danger"
        );

      } finally {

        els.runApplicationBtn.disabled =
          false;
      }
    }
  );
}


/* ============================================================
   APPLICATION TARGET SELECT
   ============================================================ */

if (
  els.applicationTargetSelect
) {

  els.applicationTargetSelect.addEventListener(
    "change",
    updateApplicationTargetResult
  );
}


/* ============================================================
   DOWNLOAD APPLICATION RESULTS
   ============================================================ */

if (
  els.downloadApplicationBtn
) {

  els.downloadApplicationBtn.addEventListener(
    "click",
    () => {

      if (
        !state.applicationOutput
      ) {
        return;
      }

      downloadText(
        applicationRowsToCSV(
          state.applicationOutput
        ),
        "application_period_lake_surface_temperature.csv",
        "text/csv;charset=utf-8"
      );
    }
  );
}


/* ============================================================
   PUBLIC TEST HOOK
   ============================================================ */

window.__thermalMemoryApp = {

  generateDemoCSV,

  loadTextDataset,

  loadApplicationDataset,

  runApplicationModel,

  getState:
    () => state,

  validationSplit
};
