# ReST-Lake Memory vs Baseline experiment

Open /memory-baseline-test/ and use the original Colab lake data workflow (format unchanged) or upload an existing model-input CSV. Either method loads the **same dataset** into both independent model tabs.

## With Memory
The /with-memory/ app is a byte-for-byte copy of the original root app, including its model fitting, validation, plots, and application code. It estimates tau and M as before.

## Baseline
The /baseline/ app separately refits four predictor coefficients: T_L(t) = beta0 + betaT * Ta(t) + betaS * SW(t) + betaU * U(t). M is exactly zero and tau is not fitted (null). It does not use previous LST in calibration, held-out validation, reconstruction, or prediction. It uses the same original optimizer structure, soft-L1 residual criterion, predictor bounds, and nine starts; the first training observation is omitted from calibration residuals to match the memory model's anchor convention. Chronological 70:30 split remains on *observed LST dates*, not daily rows.

Run independent validation in BOTH tabs and compare the exact same held-out dates. Do not interpret the all-observation calibration metrics as independent validation. No results are bundled or fabricated.

The root, /Test1/, /base/, and /insitu-test/ are completely unchanged.