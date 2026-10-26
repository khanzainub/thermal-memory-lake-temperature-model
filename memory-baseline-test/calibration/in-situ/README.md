# Independent In-Situ Calibration tab

This folder is isolated from the original With-Memory and Zero-Memory implementations.

## Data acquisition
The original Google Colab interface and pipeline are reused without modification.
Its actual historical data backend is Landsat 8/9 STAC from Microsoft's Planetary Computer plus ERA5 from Open-Meteo, **not the Google Earth Engine API**. No substitute scientific algorithm or new imagery source was introduced.
Choose a lake, add geographical coordinates and save in-situ observations, then download using the original Colab controls. Search dates automatically span one calendar month before the first saved observation and one calendar month after the last, subject to the downloader's existing 10-day recency restriction. Existing model-input CSV is unchanged: `date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c`.

## In-situ input
Use exactly `date,insitu_temp_c` (YYYY-MM-DD, degrees C). Add, edit, remove and save individually per selected lake. The browser retains data using a separate `restlake:insitu-calibration:2026-10-26:v1` localStorage key. Clearing browser data removes it; back up with exports. No synthetic measurements are included.

## Matching
Only non-null satellite observations are considered. Dates are paired by minimum absolute separation under the selected maximum tolerance (0–365 days); exact matches are processed first, then nearest by increasing difference, earlier satellite date breaking ties. A given satellite date can be paired at most once. The full table includes unmatched observations. Day difference is signed as satellite date minus in-situ date.

## Additive correction
For chronological accepted pairs, the earlier 70% (at least 2 pairs when 3+ are available) form the calibration set and all later pairs are held out. A constant offset `mean(Tinsitu - Tsatellite)` is computed **only** from the calibration set and added only to existing satellite temperatures. It does not create data for absent dates. All-pairs diagnostics are displayed but are not independent evidence. Held-out before/after RMSE and MAE are shown separately. Very small pair counts are exploratory and should not be used as definitive scientific validation.

The system never modifies the original With Memory or Zero Memory engines, state, outputs or source data. Bias-corrected model-input CSV is exported separately and is not automatically loaded into either model. Plot points represent measured/retrieved dates only. The date connector length/label makes temporal mismatch explicit. In-situ skin/bulk temperature and overpass timing mismatch may affect the interpretation of bias.

## Files
`index.html`: independent iframe UI
`core.js`: standalone matching, validation and statistics
`ui.js`: tab-specific data input, import, download, plots and export
`lake-data-ui.js` and `data-download/lake_data.py`: byte-identical originals
