import io
import math

import numpy as np
import pandas as pd
import streamlit as st

from model import fit_model, prepare_data, reconstruct_with_observation_updates


st.set_page_config(
    page_title="Thermal-Memory Lake Surface Temperature Model",
    page_icon="🌊",
    layout="wide",
)

st.title("🌊 Thermal-Memory Lake Surface Temperature Model")
st.caption(
    "Reconstruct or project Lake Surface Temperature (LST) from sparse observed "
    "LST plus continuous air temperature, incoming shortwave radiation, and wind speed."
)

with st.expander("How to use this tool", expanded=True):
    st.markdown(
        """
**1. Choose one temporal resolution and keep it consistent.**

- **Daily mode:** one atmospheric row for **every day**. Sparse observed LST may be available only on some days. Predictions are daily.
- **Monthly mode:** one atmospheric row for **every month**. Sparse observed LST may be available only in some months. Predictions are monthly.
- **Yearly mode:** one atmospheric row for **every year**. Sparse observed LST may be available only in some years. Predictions are yearly.

**Do not mix daily, monthly, and yearly rows in one run.**

**2. Upload a CSV with these exact columns:**

`date, air_temp_c, shortwave_w_m2, wind_speed_m_s, observed_lst_c`

- `observed_lst_c` may be blank on most rows.
- Atmospheric forcing **must not be blank** and must cover every timestep from the first row through the target timestep.
- A practical exploratory minimum is **10–12 observed LST values**. More observations spanning different conditions are preferable.

**3. The tool automatically fits:**

- β₀ — intercept
- βT — air-temperature coefficient
- βS — shortwave-radiation coefficient
- βU — wind-speed coefficient
- τ — characteristic thermal response time

**4. Select a target timestep.**

The tool reports the reconstructed/projected LST and lets you download the full modeled series.
        """
    )

frequency = st.radio(
    "Temporal resolution",
    ["Daily", "Monthly", "Yearly"],
    horizontal=True,
)

st.info(
    "Important: sparse LST observations are allowed; sparse atmospheric forcing is not. "
    "The recursive model needs forcing at every selected timestep."
)

uploaded = st.file_uploader("Upload input CSV", type=["csv"])

if uploaded is None:
    st.markdown("### CSV template")
    st.code(
        "date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c\n"
        "2026-06-01,15.2,410,2.4,10.0\n"
        "2026-06-02,15.8,430,2.1,\n"
        "2026-06-03,16.1,445,2.8,\n"
        "2026-06-04,16.6,470,2.6,\n"
        "..."
    )
    st.stop()

try:
    raw = pd.read_csv(uploaded)
    data = prepare_data(raw, frequency)
except Exception as exc:
    st.error(str(exc))
    st.stop()

st.markdown("### Input preview")
edited = st.data_editor(
    data,
    use_container_width=True,
    hide_index=True,
    disabled=["date"],
    num_rows="fixed",
)

n_obs = int(pd.to_numeric(edited["observed_lst_c"], errors="coerce").notna().sum())
c1, c2, c3 = st.columns(3)
c1.metric("Rows / timesteps", len(edited))
c2.metric("Observed LST values", n_obs)
c3.metric("Missing LST values to reconstruct", int(edited["observed_lst_c"].isna().sum()))

if n_obs < 10:
    st.warning(
        "Fewer than 10 observed LST values are present. "
        "The current implementation will not calibrate the five-parameter model."
    )
    st.stop()

if st.button("Calibrate model and reconstruct LST", type="primary"):
    with st.spinner("Calibrating β coefficients and τ..."):
        try:
            fit = fit_model(edited, frequency, min_observations=10)
            recon = reconstruct_with_observation_updates(edited, fit)
        except Exception as exc:
            st.error(f"Model calibration failed: {exc}")
            st.stop()

    st.session_state["fit"] = fit
    st.session_state["recon"] = recon
    st.session_state["frequency"] = frequency

if "fit" not in st.session_state:
    st.stop()

fit = st.session_state["fit"]
recon = st.session_state["recon"]

unit = {"Daily": "days", "Monthly": "months", "Yearly": "years"}[frequency]
memory_m = float(np.exp(-1.0 / fit.tau))
memory_horizon = 3.0 * fit.tau

st.markdown("## Calibrated model")
m1, m2, m3, m4 = st.columns(4)
m1.metric("τ (response time)", f"{fit.tau:.3f} {unit}")
m2.metric("Memory coefficient M", f"{memory_m:.4f}")
m3.metric("RMSE", f"{fit.rmse:.3f} °C")
m4.metric("MAE", f"{fit.mae:.3f} °C")

st.caption(
    f"Approximate 5%-memory horizon ≈ 3τ = {memory_horizon:.2f} {unit}. "
    "This is an interpretation aid, not a hard cutoff."
)

coef = pd.DataFrame(
    {
        "Parameter": ["β₀", "βT", "βS", "βU", "τ"],
        "Estimate": [fit.beta0, fit.beta_t, fit.beta_s, fit.beta_u, fit.tau],
        "Meaning": [
            "Intercept",
            "Air-temperature coefficient",
            "Shortwave-radiation coefficient",
            "Wind-speed coefficient",
            "Characteristic thermal response time",
        ],
    }
)
st.dataframe(coef, use_container_width=True, hide_index=True)

st.markdown("### Model equation")
st.latex(
    r"T_L(t)=e^{-\Delta t/\tau}T_L(t-\Delta t)"
    r"+\left(1-e^{-\Delta t/\tau}\right)"
    r"\left[\beta_0+\beta_TT_a(t)+\beta_SS_{\downarrow}(t)+\beta_UU(t)\right]"
)

st.markdown("## Reconstructed series")
chart_df = recon.set_index("date")[["observed_lst_c", "reconstructed_lst_c"]].rename(
    columns={
        "observed_lst_c": "Observed LST",
        "reconstructed_lst_c": "Reconstructed / projected LST",
    }
)
st.line_chart(chart_df)

valid_targets = recon.loc[recon["reconstructed_lst_c"].notna(), "date"].tolist()
target = st.selectbox(
    "Select the timestep for which you want LST",
    valid_targets,
    index=len(valid_targets) - 1,
    format_func=lambda d: pd.Timestamp(d).strftime(
        "%Y-%m-%d" if frequency == "Daily" else ("%Y-%m" if frequency == "Monthly" else "%Y")
    ),
)

target_row = recon.loc[recon["date"] == target].iloc[0]
pred_value = float(target_row["reconstructed_lst_c"])
is_obs = pd.notna(target_row["observed_lst_c"])

if is_obs:
    st.success(
        f"LST at selected timestep: **{pred_value:.2f} °C** "
        "(an observed value is available, so the model state is anchored to it)."
    )
else:
    st.success(f"Estimated LST at selected timestep: **{pred_value:.2f} °C**")

download = recon.copy()
download["date"] = download["date"].dt.strftime("%Y-%m-%d")
csv_bytes = download.to_csv(index=False).encode("utf-8")

st.download_button(
    "Download reconstructed LST series",
    data=csv_bytes,
    file_name="reconstructed_lake_surface_temperature.csv",
    mime="text/csv",
)

with st.expander("Scientific interpretation and limitations"):
    st.markdown(
        """
This is a **reduced-order, physically motivated, semi-empirical model**.  
It is not a complete lake heat-budget or hydrodynamic model.

The model explicitly represents thermal memory through τ, but does not explicitly
simulate bathymetry, mixed-layer depth, longwave radiation, humidity, inflow heat,
sediment heat flux, ice processes, or vertical stratification.

A good numerical fit does not by itself establish physical validity. Parameters
should be validated on held-out LST observations before publication or future-climate use.
        """
    )
