from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

import numpy as np
import pandas as pd
from scipy.optimize import least_squares


Frequency = Literal["Daily", "Monthly", "Yearly"]


@dataclass
class FitResult:
    beta0: float
    beta_t: float
    beta_s: float
    beta_u: float
    tau: float
    rmse: float
    mae: float
    r2: float
    n_observed: int
    predictions_free_run: pd.DataFrame


def _periodize_dates(dates: pd.Series, frequency: Frequency) -> pd.Series:
    dates = pd.to_datetime(dates, errors="raise")
    if frequency == "Daily":
        return dates.dt.normalize()
    if frequency == "Monthly":
        return dates.dt.to_period("M").dt.to_timestamp()
    if frequency == "Yearly":
        return dates.dt.to_period("Y").dt.to_timestamp()
    raise ValueError(f"Unsupported frequency: {frequency}")


def prepare_data(df: pd.DataFrame, frequency: Frequency) -> pd.DataFrame:
    required = {"date", "air_temp_c", "shortwave_w_m2", "wind_speed_m_s", "observed_lst_c"}
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(
            "Missing required columns: " + ", ".join(sorted(missing))
        )

    out = df.copy()
    out["date"] = _periodize_dates(out["date"], frequency)

    for col in ["air_temp_c", "shortwave_w_m2", "wind_speed_m_s", "observed_lst_c"]:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    if out["date"].duplicated().any():
        dupes = out.loc[out["date"].duplicated(keep=False), "date"].dt.strftime("%Y-%m-%d").tolist()
        raise ValueError(
            "More than one row maps to the same selected timestep. "
            f"Duplicate periods include: {', '.join(dupes[:6])}"
        )

    out = out.sort_values("date").reset_index(drop=True)

    forcing_cols = ["air_temp_c", "shortwave_w_m2", "wind_speed_m_s"]
    if out[forcing_cols].isna().any().any():
        bad_rows = out.index[out[forcing_cols].isna().any(axis=1)].tolist()
        raise ValueError(
            "Atmospheric forcing cannot be missing. "
            f"Missing forcing found in row(s): {', '.join(map(str, bad_rows[:10]))}"
        )

    if (out["shortwave_w_m2"] < 0).any():
        raise ValueError("Incoming shortwave radiation must not be negative.")
    if (out["wind_speed_m_s"] < 0).any():
        raise ValueError("Wind speed must not be negative.")

    # Require a complete forcing grid at the chosen temporal resolution.
    if len(out) > 1:
        if frequency == "Daily":
            expected = pd.date_range(out["date"].iloc[0], out["date"].iloc[-1], freq="D")
        elif frequency == "Monthly":
            expected = pd.date_range(out["date"].iloc[0], out["date"].iloc[-1], freq="MS")
        else:
            expected = pd.date_range(out["date"].iloc[0], out["date"].iloc[-1], freq="YS")

        missing_dates = expected.difference(pd.DatetimeIndex(out["date"]))
        if len(missing_dates):
            shown = ", ".join(d.strftime("%Y-%m-%d") for d in missing_dates[:8])
            raise ValueError(
                f"Atmospheric forcing must contain every {frequency.lower()[:-2] if frequency != 'Daily' else 'day'} "
                f"between the first and last row. Missing timestep(s): {shown}"
                + (" ..." if len(missing_dates) > 8 else "")
            )

    return out


def _tau_bounds(frequency: Frequency) -> tuple[float, float]:
    # Tau is expressed in the same units as the chosen timestep.
    if frequency == "Daily":
        return 0.25, 365.0       # days
    if frequency == "Monthly":
        return 0.10, 60.0        # months
    if frequency == "Yearly":
        return 0.05, 20.0        # years
    raise ValueError(f"Unsupported frequency: {frequency}")


def _simulate_free_run(
    df: pd.DataFrame,
    beta0: float,
    beta_t: float,
    beta_s: float,
    beta_u: float,
    tau: float,
) -> np.ndarray:
    """
    Free-run simulation used for parameter fitting.

    The state is initialized from the first observed LST. It is then propagated
    without resetting to later observations. This avoids forcing an artificially
    perfect fit at every observation date during calibration.
    """
    obs_idx = np.flatnonzero(df["observed_lst_c"].notna().to_numpy())
    if len(obs_idx) == 0:
        raise ValueError("At least one observed LST is required.")

    first = int(obs_idx[0])
    pred = np.full(len(df), np.nan, dtype=float)
    pred[first] = float(df.loc[first, "observed_lst_c"])

    # With a complete regular forcing grid, Delta t = 1 selected time unit.
    m = float(np.exp(-1.0 / tau))

    for i in range(first + 1, len(df)):
        te = (
            beta0
            + beta_t * float(df.loc[i, "air_temp_c"])
            + beta_s * float(df.loc[i, "shortwave_w_m2"])
            + beta_u * float(df.loc[i, "wind_speed_m_s"])
        )
        pred[i] = m * pred[i - 1] + (1.0 - m) * te

    return pred


def _initial_beta_guess(df: pd.DataFrame) -> np.ndarray:
    obs = df.dropna(subset=["observed_lst_c"]).copy()
    X = np.column_stack(
        [
            np.ones(len(obs)),
            obs["air_temp_c"].to_numpy(float),
            obs["shortwave_w_m2"].to_numpy(float),
            obs["wind_speed_m_s"].to_numpy(float),
        ]
    )
    y = obs["observed_lst_c"].to_numpy(float)
    try:
        beta, *_ = np.linalg.lstsq(X, y, rcond=None)
        if not np.all(np.isfinite(beta)):
            raise ValueError
        return beta
    except Exception:
        return np.array([0.0, 0.8, 0.002, 0.0], dtype=float)


def fit_model(
    df: pd.DataFrame,
    frequency: Frequency,
    min_observations: int = 10,
) -> FitResult:
    data = prepare_data(df, frequency)

    obs_mask = data["observed_lst_c"].notna().to_numpy()
    obs_idx = np.flatnonzero(obs_mask)
    n_obs = int(obs_mask.sum())

    if n_obs < min_observations:
        raise ValueError(
            f"This tool requires at least {min_observations} observed LST values "
            f"for calibration. Found {n_obs}."
        )

    first_obs = int(obs_idx[0])
    # Only compare observations after the initial state; the first observation
    # initializes the recursive model and therefore carries no calibration residual.
    fit_obs_idx = obs_idx[obs_idx > first_obs]

    if len(fit_obs_idx) < 5:
        raise ValueError(
            "Too few observed LST values occur after the first anchor observation."
        )

    beta_init = _initial_beta_guess(data)
    tau_lo, tau_hi = _tau_bounds(frequency)

    # Parameter vector:
    # [beta0, betaT, betaS, betaU, log(tau)]
    #
    # Bounds are intentionally broad. BetaS is expressed per W/m^2.
    lower = np.array([-100.0, -5.0, -0.10, -10.0, np.log(tau_lo)])
    upper = np.array([ 100.0,  5.0,  0.10,  10.0, np.log(tau_hi)])

    def residuals(x: np.ndarray) -> np.ndarray:
        beta0, beta_t, beta_s, beta_u, log_tau = x
        tau = float(np.exp(log_tau))
        pred = _simulate_free_run(
            data, beta0, beta_t, beta_s, beta_u, tau
        )
        return pred[fit_obs_idx] - data.loc[fit_obs_idx, "observed_lst_c"].to_numpy(float)

    # Multi-start improves robustness for the nonlinear tau parameter.
    tau_starts = np.geomspace(max(tau_lo * 1.5, 0.5), min(tau_hi / 1.5, 60.0), 9)
    candidates = []
    for tau0 in tau_starts:
        x0 = np.array([*beta_init, np.log(tau0)], dtype=float)
        x0 = np.minimum(np.maximum(x0, lower + 1e-10), upper - 1e-10)
        try:
            res = least_squares(
                residuals,
                x0=x0,
                bounds=(lower, upper),
                loss="soft_l1",
                f_scale=1.0,
                max_nfev=6000,
            )
            if np.all(np.isfinite(res.x)):
                candidates.append(res)
        except Exception:
            pass

    if not candidates:
        raise RuntimeError("Calibration failed for all optimization starting points.")

    best = min(candidates, key=lambda r: float(np.sum(residuals(r.x) ** 2)))
    beta0, beta_t, beta_s, beta_u, log_tau = best.x
    tau = float(np.exp(log_tau))

    pred = _simulate_free_run(data, beta0, beta_t, beta_s, beta_u, tau)

    y_true = data.loc[fit_obs_idx, "observed_lst_c"].to_numpy(float)
    y_pred = pred[fit_obs_idx]
    errors = y_pred - y_true

    rmse = float(np.sqrt(np.mean(errors**2)))
    mae = float(np.mean(np.abs(errors)))
    if np.sum((y_true - y_true.mean()) ** 2) > 0:
        r2 = float(1.0 - np.sum(errors**2) / np.sum((y_true - y_true.mean()) ** 2))
    else:
        r2 = float("nan")

    out = data.copy()
    out["free_run_lst_c"] = pred

    return FitResult(
        beta0=float(beta0),
        beta_t=float(beta_t),
        beta_s=float(beta_s),
        beta_u=float(beta_u),
        tau=tau,
        rmse=rmse,
        mae=mae,
        r2=r2,
        n_observed=n_obs,
        predictions_free_run=out,
    )


def reconstruct_with_observation_updates(
    df: pd.DataFrame,
    fit: FitResult,
) -> pd.DataFrame:
    """
    Operational reconstruction.

    The fitted parameters stay fixed. When a real LST observation is available,
    the state is re-anchored to that observation. Missing periods are then
    simulated forward from the latest observed/updated state.
    """
    data = fit.predictions_free_run[
        ["date", "air_temp_c", "shortwave_w_m2", "wind_speed_m_s", "observed_lst_c"]
    ].copy()

    obs_idx = np.flatnonzero(data["observed_lst_c"].notna().to_numpy())
    first = int(obs_idx[0])

    pred = np.full(len(data), np.nan, dtype=float)
    source = np.full(len(data), "", dtype=object)
    pred[first] = float(data.loc[first, "observed_lst_c"])
    source[first] = "Observed anchor"

    m = float(np.exp(-1.0 / fit.tau))

    for i in range(first + 1, len(data)):
        if pd.notna(data.loc[i, "observed_lst_c"]):
            pred[i] = float(data.loc[i, "observed_lst_c"])
            source[i] = "Observed anchor"
        else:
            te = (
                fit.beta0
                + fit.beta_t * float(data.loc[i, "air_temp_c"])
                + fit.beta_s * float(data.loc[i, "shortwave_w_m2"])
                + fit.beta_u * float(data.loc[i, "wind_speed_m_s"])
            )
            pred[i] = m * pred[i - 1] + (1.0 - m) * te
            source[i] = "Model"

    out = data.copy()
    out["reconstructed_lst_c"] = pred
    out["state_source"] = source
    return out
