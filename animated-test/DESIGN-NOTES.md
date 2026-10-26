# Animated Test v2 — Design and validation notes

All scientific algorithm and data-processing assets in this clone are copied byte-for-byte from `memory-baseline-test/calibration` at the clone's baseline commit. Only these experimental presentation resources are added: `animated.css`, `control-center.css`, `control-center.js`, and four UI HTML entrypoints.

## Visual telemetry

Activity lights react to file chooser changes, existing model action buttons, existing success/error status text, and actual result sections. The lights do **not** represent inferred numerical progress. Colab executes outside this browser: the UI can observe local notebook preparation and result-file import, not remote Colab runtime state. The UI exposes live optimizer starting-point messages where the original model reports them.

## Verification checklist

- Navigate between all three model tabs, verify active sidebar and tab synchronization.
- Upload a valid/invalid CSV for With Memory and Baseline, verify source data preview and status light.
- Run calibration, validation, and final fit on each model; compare outputs to original.
- In-Situ: choose a lake, upload in-situ and original satellite CSV, match, calibrate, save, export; verify original CSV headers.
- Prepare/import Google Colab notebook result. External Colab run must be tested separately.
- Check desktop and narrow-width responsive layout and reduced-motion setting.

The original app is never edited by this experiment. The processing indicator is state-based rather than a fictitious percent-progress indicator.
