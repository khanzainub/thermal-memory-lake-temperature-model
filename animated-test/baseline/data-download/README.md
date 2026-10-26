# Colab lake-data workflow

Open **Get lake data with Google Colab** above the model workflow.

1. Enter lake names, latitude, longitude and dates (up to 20 lakes per notebook).
2. Download the prepared notebook and open Colab. Sign in to Google there if needed. Use **File → Upload notebook**, then **Runtime → Run all**.
3. Import the downloaded `lake_data_results.json` on the model page. Each lake has **Download CSV**, **Load for calibration** and **Load for application** buttons.

The bundle contains the original, separate CSV texts. Importing or downloading a CSV does not reformat its contents. Separate CSVs are also available in Colab's `lake_csv_outputs` folder. If one lake fails, the bundle reports that failure and retains other completed lakes.

The five columns stay in this order:

```
date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c
```

The pipeline retains the supplied data rules: ERA5 hourly-to-daily means in Asia/Kolkata; Landsat 8/9 Collection 2 Level 2 scene cloud strictly below 2%; `lwir11` pixel sampled at the coordinate; masked/zero fill omitted; Celsius conversion `DN × 0.00341802 + 149 − 273.15`; same-date observation means; three-decimal rounding; blank unobserved LST values. No pixel QA, water mask, additional temperature-range filter or interpolation was added.

CSV observations remain sparse; the existing model performs its reconstruction and prediction. Atmospheric inputs are not automatically interpolated, and the existing model input and observation requirements still apply. Use parameters calibrated for the same lake when loading application data.

This is an assisted Colab workflow. Google authentication happens on Colab; the website does not collect credentials, start a remote runtime, or automatically retrieve its files. The Colab runtime API currently requires a Google-approved project. Supporting fully automatic execution would require that access and OAuth setup, or deployment of a separate Python service.
