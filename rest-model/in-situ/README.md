# ReST-Lake — reusable lake satellite LST bias calibration

This is one additional calibration tab within the cloned `memory-baseline-test/calibration/` application. It is **not** a third lake-temperature model. Neither existing With-Memory nor Zero-Memory solver was changed.

## Irregular historical observation dates and multiple download periods

In-situ observations can be sporadic and span nonconsecutive months or years (for example, October 2018; May 2019; November 2022; March 2025). Upload the two-column data in one CSV or cumulatively across separate CSVs, or enter individual dates manually.

For every actual in-situ observation the calibration tab defines a satellite-search window of **one calendar month before and after its date**. Only overlapping/adjacent windows are merged. The date-window selector synchronizes the existing Colab download controls to each window in turn, without retrieving unnecessary intervening years. Download each available window and import its original Colab JSON or five-column CSV. Imports are merged by observation date; previously imported periods remain available. An existing date is not replaced by a different non-null LST value (conflicts are reported). A satellite date with no observation stays null.

Once all available periods are imported, match the complete set of in-situ dates (exact first, nearest subject to chosen tolerance) and calculate one mean offset from every matched genuine observation, **regardless of year**. Missing years and unmatched dates do not become fabricated calibration pairs. The saved offset can subsequently be applied to separate original satellite CSVs for other dates/years.

## Intended workflow
1. Select a lake. Enter measured water temperatures by date manually or upload `date,insitu_temp_c`.
2. Download historical satellite data around the in-situ period with the exact original Google Colab pipeline, or upload an original five-column ReST-Lake satellite CSV.
3. Match dates exactly where possible, otherwise use nearest satellite observations within a user-set maximum difference. Each satellite observation is used once.
4. Calculate one lake-specific additive correction value from **all** accepted historical pairs, `bias_C = mean(insitu_temp_c - observed_lst_c)`.
5. Save that one correction value per lake. Example: calibrate on October 2018 and reuse the stored value on 2019, 2020, etc. There is **no new 70:30 experiment** or auxiliary model in this tab.
6. When any newer original satellite CSV for that lake is imported into this tab, it is automatically corrected using the saved value: `corrected_LST = original_LST + bias_C`. Download it in the exact model-input schema, or use **Use calibrated CSV in With Memory & Baseline**.
7. The main calibration-page shared CSV loader also auto-applies an available saved bias for an *original* Daily CSV whose filename unambiguously starts with the selected lake's name, e.g. `Naini_daily_model_input.csv`. Its status explicitly reports the correction. Files visibly marked `corrected` or `calibrated` are not corrected again.

The unmodified five-column original CSV is `date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c`. Original observations are never overwritten, and only non-empty observed LST values receive a numerical offset. Missing values stay missing. The saved in-situ CSV, matched pairs, calibration metrics, correction value, corrected historical CSV, corrected future CSV and plot can be downloaded. Browser-local saved state is separate for each lake; download backups before clearing browser storage.

## Sources and scientific caution
The original download workflow is reused unmodified: Google Colab runs the existing Planetary Computer Landsat 8/9 STAC plus ERA5 (Open-Meteo) pipeline. It does **not** use the Google Earth Engine API despite the original shorthand. No new imagery retrieval implementation was substituted.

The saved mean bias is an **assumed constant systematic offset**, not an independently validated future-period calibration; sensor/overpass/skin-versus-bulk temperature differences or seasonal change may cause that offset to drift. RMSE and MAE before/after are calculated on the same historical pairs used to estimate the bias and must be labelled **in-sample calibration diagnostics**. They are not claimed to be held-out model validation. A nearest-date match can include true day-to-day thermal variation. There are no fabricated or silently interpolated satellite temperatures.

## Preserve old models
- Original `with-memory/app.js` untouched.
- Original `baseline/app.js` untouched.
- Parent `comparison.js` routes a **corrected input CSV** into the original model loaders when appropriate; it never changes either model's scientific calculation code.
- Distinct localStorage key: `restlake:insitu-calibration:2026-10-26:v1`, storing `calibration.version=2` for the new reusable mean-bias method. Legacy 70:30 in-situ results are not silently converted to new bias values.
