# A Thermal-Memory Model for Reconstruction and Projection of Lake Surface Temperature from Atmospheric Forcing

This repository contains a Python/Streamlit implementation of a reduced-order thermal-memory model for reconstructing and projecting **Lake Surface Temperature (LST)** from sparse observed LST and continuous atmospheric forcing.

> In this repository, **LST means Lake Surface Temperature**. In publications, `LSWT` may be preferable because `LST` is also commonly used for Land Surface Temperature.

## Core inputs

The web tool uses:

- air temperature (`Tₐ`), °C
- incoming shortwave solar radiation (`S↓`), W m⁻²
- wind speed (`U`), m s⁻¹
- sparse observed Lake Surface Temperature, °C

The core atmospheric forcing is

$$
T_E(t)=\beta_0+\beta_T T_a(t)+\beta_S S_{\downarrow}(t)+\beta_U U(t)
$$

and the recursive thermal-memory model is

$$
T_L(t)
=
e^{-\Delta t/\tau}T_L(t-\Delta t)
+
\left(1-e^{-\Delta t/\tau}\right)T_E(t).
$$

Therefore,

$$
T_L(t)
=
e^{-\Delta t/\tau}T_L(t-\Delta t)
+
\left(1-e^{-\Delta t/\tau}\right)
\left[
\beta_0
+\beta_T T_a(t)
+\beta_S S_{\downarrow}(t)
+\beta_U U(t)
\right].
$$

Here $\tau$ is the characteristic thermal response time and

$$
M=e^{-\Delta t/\tau}
$$

is the thermal-memory coefficient.

## Input CSV

Use these exact columns:

```text
date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c
```

Example:

```text
date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c
2026-06-01,15.2,410,2.4,10.0
2026-06-02,15.8,430,2.1,
2026-06-03,16.1,445,2.8,
...
2026-06-10,18.3,505,1.9,11.4
```

`observed_lst_c` may be blank. The three atmospheric forcing columns may **not** be blank.

## Temporal-resolution rule

Choose one resolution per run.

### Daily

Provide one atmospheric row for **every day**. Observed LST may be sparse. The model predicts daily LST.

### Monthly

Provide one atmospheric row for **every month**. Observed LST may be available only for some months. The model predicts monthly LST.

### Yearly

Provide one atmospheric row for **every year**. Observed LST may be available only for some years. The model predicts yearly LST.

Do not mix daily, monthly, and yearly data in the same model run.

Whenever fine-resolution atmospheric data are available, it is scientifically preferable to run the model at that finer resolution and aggregate the modeled LST afterward.

## Calibration

The basic model estimates five parameters jointly:

$$
\Theta=
\left\{
\beta_0,
\beta_T,
\beta_S,
\beta_U,
\tau
\right\}.
$$

The implementation minimizes errors between simulated and observed LST at dates where observed LST exists.

The first observed LST initializes the recursive state. Later observed LST values constrain the parameters.

The current tool requires at least **10 observed LST values**. Treat 10–12 as an exploratory minimum; more observations across contrasting conditions are preferable.

## Free-run fit vs operational reconstruction

During calibration, the model is **not reset** to every observation. It free-runs from the first observed LST so that the fitted dynamics are actually tested.

After calibration, the operational reconstruction series **is re-anchored** whenever a reliable observed LST is available. This limits drift during long observation-free intervals.

## Run locally

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## Deploy as a public web tool

Store this repository on GitHub and deploy `streamlit_app.py` using Streamlit Community Cloud.

Your GitHub repository remains the source of the app, so later pushes to the repository update the deployed app.

## Repository structure

```text
.
├── streamlit_app.py
├── model.py
├── requirements.txt
├── README.md
└── examples/
    ├── daily_example.csv
    ├── monthly_example.csv
    └── yearly_example.csv
```

## Scientific status

This is a **research prototype**.

Before using it for publication-quality reconstruction or future climate projections, the formulation should be tested for:

- parameter identifiability;
- sensitivity to the number and timing of sparse LST observations;
- out-of-sample validation;
- uncertainty in $\tau$ and the $\beta$ coefficients;
- comparison against simpler baselines;
- performance across different lake types and climatic settings.

The framework is not geographically restricted by its equations. Region-specific application requires region-specific calibration and validation.

## References

Rodhe, B. (1952). *On the Relation Between Air Temperature and Ice Formation in the Baltic*. Geografiska Annaler, 34(3–4), 175–202.

Piccolroaz, S., Toffolon, M., & Majone, B. (2013). *A simple lumped model to convert air temperature into surface water temperature in lakes*. Hydrology and Earth System Sciences, 17, 3323–3338.

Toffolon, M., Piccolroaz, S., Majone, B., Soja, A.-M., Peeters, F., Schmid, M., & Wüest, A. (2014). *Prediction of surface temperature in lakes with different morphology using air temperature*. Limnology and Oceanography, 59(6), 2185–2202.

Piccolroaz, S., Zhu, S., Ladwig, R., Carrea, L., Oliver, S., Piotrowski, A. P., et al. (2024). *Lake Water Temperature Modeling in an Era of Climate Change: Data Sources, Models, and Future Prospects*. Reviews of Geophysics, 62, e2023RG000816.

Tau, G., Enzel, Y., McGowan, H., Lyakhovsky, V., & Lensky, N. G. (2025). *Thermal Response of Lakes to Cyclic Environmental Forcing*. Geophysical Research Letters, 52, e2025GL117731.
