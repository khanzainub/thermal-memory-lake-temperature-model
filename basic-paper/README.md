# ReST-Lake — Basic Paper

A simple, independent two-model version of the ReST-Lake application.

- **With Memory:** original recursive thermal-response model with estimated memory time scale (tau).
- **Baseline (M = 0):** independently fitted zero-memory reference model.

Open `basic-paper/index.html` in the same GitHub Pages site. In each model, upload an existing five-column model-input CSV; then use the original calibration, chronological held-out validation, final-model and plotting controls. The underlying model equations, optimizers, validation logic, inputs and outputs have not been changed.

Input columns: `date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c`.

This Basic Paper version deliberately **does not include** the in-situ calibration tab, automatic/manual additive-bias corrections, the Google Colab satellite/weather data downloader, or any associated backend scripts. The Classic and Animated editions are unaffected.
