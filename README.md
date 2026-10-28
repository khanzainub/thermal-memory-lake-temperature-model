# ReST-Lake — Remote Sensing–Integrated Thermal Response Model

This repository maintains **two versions of the same research application**:

- **Normal (classic) interface:** https://khanzainub.github.io/thermal-memory-lake-temperature-model/memory-baseline-test/calibration/
- **Animated interface:** https://khanzainub.github.io/thermal-memory-lake-temperature-model/animated-test/

Both contain **With-Memory ReST**, **Zero-Memory Baseline (M = 0)**, and **In-Situ Calibration**. Both have independent optional additive bias-correction checkboxes with an editable bias (°C) value, auto-filled from the active lake's saved in-situ calibration or set manually.

The original model algorithms, input CSV structure, and validation methods are preserved. Older duplicate experiments (Test1, base, insitu-test, and other redundant copies) are retired and recoverable from Git history. The repository home URL opens the **Normal** version; the animated version remains separately accessible.

`LSWT_corrected = LSWT_satellite + additive_bias_c`
