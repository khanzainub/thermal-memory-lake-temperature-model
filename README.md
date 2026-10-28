# ReST-Lake — Remote Sensing–Integrated Thermal Response Model

The **single maintained web application** is the [Animated Scientific Model](https://khanzainub.github.io/thermal-memory-lake-temperature-model/animated-test/).

The animated interface includes three integrated modules:

- **With-Memory ReST** — fit and validate the recursive thermal-response formulation.
- **Zero-Memory Baseline** — fit and validate the instantaneous reference model (M = 0).
- **In-Situ Calibration** — calculate and save a lake-specific additive satellite LSWT bias.

## Optional additive bias for both models

Each model tab has an independent **Apply In-Situ Bias Correction** checkbox and an editable **Additive bias (°C)** field. The field auto-fills using the active lake's saved in-situ calibration; users can type a signed manual value or choose **Use calculated bias** to restore it. When enabled, the signed bias is added only to non-missing satellite `observed_lst_c` values on the **next original CSV load**. Pre-corrected file names are not corrected twice. Unchecking preserves the original input unchanged.

The formula is:

`LSWT_corrected = LSWT_satellite + additive_bias_c`.

This is a data correction applied before model fitting; model equations, fitting optimizers, held-out validation, CSV formats and plots remain separate and unchanged.

## Project structure

- `animated-test/` — the complete web application and the three necessary internal engines.
- `.github/` — GitHub Pages configuration.
- `LICENSE` — original license.

Earlier experimental versions were retired from the current default branch; prior files remain recoverable in Git commit history.
