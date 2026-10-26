# ReST-Lake experimental workspace

## Open the applications

- Original: `../`
- Unchanged baseline clone: `../base/`
- Experimental clone: `./`

The original root and Test1 files are preserved. The baseline contains byte-identical application, Python, example, data-download and documentation files from commit `28e651cfea62aa19e520ff99b3958a88c5685d4d`. Each browser page loads its own relative assets. Existing Pages workflows publish the repository, including both new subfolders; no root routing or workflow modification is necessary.

## Usage

1. Select a lake (or add its exact name).
2. Upload that lake's original **daily** model-input CSV, or explicitly copy the daily dataset loaded in the preserved workflow below the experimental panel. The experimental input requires at least 12 satellite observations and complete daily predictors. The unchanged workflow still supports monthly/yearly data; the new experimental module deliberately uses daily dates for unambiguous in-situ matching.
3. Enter irregular in-situ measurements manually or upload a CSV with `lake_name,date,insitu_temp_c`. Download `insitu_template.csv` or use the template button. The template has headers only; no invented measurements are included. Example dates are not observations.
4. Edit/remove records as needed. Undo restores edits/removals; Restore last saved discards draft changes. Click **Save observations**, then tick **Use saved in-situ observations to bias-correct satellite LST**. An edit disables correction until saved again.
5. Inspect pairs; adjust maximum separation (0–365 days). Click a matched calibration point or connecting line to exclude/restore it. Undo exclusion, Restore All (undoable), and Reset Selection (clears selection history) operate only on selection, never source data.
6. Leave correction at **matched calibration observations only**, or explicitly select mean bias and an inclusive application start/end date.
7. Run four models. Export metrics/parameters, prediction rows, provenance, pairs, corrected/source columns, and saved observations. Each figure offers SVG and 4000-pixel-wide PNG downloads. Some browsers ask permission for multiple downloads from one click.

Data and draft/saved observations are stored per lake under `rest-lake:insitu-test:v1` in this browser's local storage. They are not uploaded to a server or shared with the original/base app. Export backups before clearing browser storage. Inputs can be restored after page refresh; fitted results can be regenerated. No real in-situ measurements are bundled, so actual lake-specific results require the user's measured data.

## Input checks

In-situ dates must be real ISO dates, YYYY-MM-DD. Duplicate dates in the same lake are rejected, including duplicates across uploads. Users must explicitly resolve replicate measurements. CSV quoting, field counts, lake identity, missing temperatures and numeric values are checked. Values must be Celsius, within a sanity envelope of −5 to 60 °C; no automatic conversion is made. A plausible numerical value alone cannot prove the correct unit, so users must confirm their source units. Satellite/predictor input validates dates, complete daily forcing, duplicates, numeric values, nonnegative radiation and wind. Original source values are retained.

## Matching and bias correction

For each calibration in-situ date, choose the temporally nearest valid original satellite observation of the selected lake, subject to the selected maximum separation. Exact dates win. Equal-distance satellite ties select the earlier satellite date and are flagged. If multiple in-situ observations choose the same satellite record, retain the pair with the smallest separation (then earliest in-situ date); flag the others rather than force alternative matches. Excluding a winning pair does not silently promote a duplicate. A nearest match across the chronological boundary is flagged and is not used for correction.

For accepted pair j:

`b_j = T_insitu,j − T_satellite,j`

- **Default matched-only:** add `b_j` only to that existing matched calibration satellite record. At nonzero separation, this maps an in-situ value onto a different satellite date and can include real temporal change; inspect separation and use a zero-day tolerance when exact coincidence is necessary.
- **Explicit mean-bias:** estimate `b_bar = mean(b_j)` using accepted calibration pairs only. Add this constant to existing satellite observations within the user's stated period. The user explicitly assumes a stable offset over that period. Application beyond calibration is extrapolation of the *bias assumption*, never fabrication of observations. Skin/bulk temperature differences, sampling time/depth, seasonal changes and temporal mismatch may violate the assumption.

Original observations remain unchanged. Exports retain original LST, corrected LST, applied bias, matching dates, temporal separation and correction status. Missing satellite dates stay missing. No interpolation or forced matches occur. Fewer than three accepted calibration pairs is visibly flagged as insufficient for reliable bias inference, while exploratory runs remain possible.

## Four experiments and optimizer

The preserved browser model defines:

`TE(t) = β0 + βT Ta(t) + βS S↓(t) + βU U(t)`

`TL(t) = M TL(t−1) + (1−M) TE(t)`, where `M = exp(−1/τ)` for daily timesteps.

A uses original targets and the existing `fitModel`/`simulateFreeRun`. C uses corrected targets and these exact same functions. The state is initialized from the first calibration observation, then free-runs without resets to subsequent observations. β and τ are re-estimated separately for A and C.

B and D directly compute `TL(t) = TE(t)` with `M=0` and no recursive dependency. τ is not evaluated or set to zero; it is exported as not applicable. All four β coefficients are re-estimated independently using original targets (B) or corrected targets (D).

The new no-memory fitter uses the existing browser Nelder–Mead implementation, parameter scaling, soft-L1 objective (`2[√(1+e²)−1]`), nine deterministic starts, 650 iterations and 1e−7 tolerance. Candidate selection uses the lowest squared residual sum, matching the original browser procedure. Initial β uses the original regression initializer. Four-dimensional starts are deterministically perturbed because there is no τ dimension. A/C retain the original nine log-spaced τ starts. The first calibration date is excluded from optimization residuals and reported calibration metrics for *all* experiments to match the memory model's anchor exclusion; B/D still predict that date from atmospheric forcing, without anchoring.

The preserved Python implementation uses SciPy least_squares rather than the browser's Nelder–Mead; new UI experiments run the browser solver, not a replacement Python engine.

## Leakage protection and references

`validationSplit(rows,70)` is reused unchanged. It chronologically divides satellite observation dates at nominal 70:30, preserving the original minimum of 10 earlier calibration observations and 2 later validation observations. Small datasets therefore do not always split exactly 70:30. The actual counts and cutoff are displayed and exported.

Only earlier calibration observations are available to parameter fitting. Bias estimation uses in-situ observations and satellite matches on or before the last calibration date. Later in-situ values cannot enter the correction or optimizer. Held-out satellite target values are masked from fitting; later atmospheric predictors drive free-running prediction. No automatic selection of a model from held-out scores is performed. Users should pre-specify matching and correction choices rather than repeatedly tune them against held-out scores.

Common-reference calibration and validation metrics for A–D use the **same original satellite observations on identical dates**. Separate own-target calibration diagnostics are labeled as non-comparable accuracy because corrected targets differ. These are earlier-subset fits, **not all-observation calibration**. The preserved original workflow below still provides its original all-observation fit and separate chronological validation.

Later in-situ observations are evaluated against all available model predictions on the same exact daily forcing dates, including days without satellite observations. Measurements outside the forcing grid are counted but not interpolated/extrapolated for evaluation. Fewer than three such measurements is flagged as insufficient for robust inference.

Report RMSE, MAE, Pearson r, and `R² = 1−SSE/SST` (not squared correlation), with undefined metrics left blank. A lower error against a changed calibration target, or against satellite data, is not proof of improved independent in-situ accuracy. Observational uncertainty and model identifiability are not quantified by these experiments.

## Figures and exports

Matching plots show source observations, pair lines, dates, bias and temporal separations; excluded observations remain visible. Additional plots show accepted bias against date/separation, original/corrected LST, observed-versus-predicted points for each model, empirical residual distributions (no hidden smoothing), and RMSE/MAE by experiment. Error-reduction tables separate calibration, held-out satellite and independent in-situ references. Legends and cutoff markers identify evaluation partitions. Series can be toggled; hover/focus exposes exact point details. SVG is resolution-independent; PNG is exported at 4× chart resolution.

## Reproducible checks

Run `node insitu-test/tests/core.test.cjs` from repository root. Tests use explicitly synthetic fixtures solely to test algorithms, not as research observations. They check input failures, matching, ties/reuse, boundary protection, exclusion, correction arithmetic, all four experiments, the M=0 equation, source immutability and parameter invariance to held-out satellite/in-situ changes.
