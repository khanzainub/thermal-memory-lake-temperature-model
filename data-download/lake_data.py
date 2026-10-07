"""Lake data pipeline adapted from the user's Colab cell.

The data-selection, pixel sampling, conversion, aggregation, rounding and
CSV schema retain the supplied pipeline. Configuration and result packaging
are handled by the generated notebook outside these functions.
"""
from pathlib import Path
import numpy as np
import pandas as pd
import requests
import rasterio
from pyproj import Transformer
import pystac_client
import planetary_computer
from tqdm.auto import tqdm

MAX_SCENE_CLOUD_PERCENT = 2.0
COLUMNS = ['date', 'air_temp_c', 'shortwave_w_m2', 'wind_speed_m_s', 'observed_lst_c']


def get_daily_weather(lat, lon, start_date, end_date):
    response = requests.get('https://archive-api.open-meteo.com/v1/archive', params={
        'latitude': lat, 'longitude': lon, 'start_date': start_date, 'end_date': end_date,
        'hourly': 'temperature_2m,shortwave_radiation,wind_speed_10m',
        'timezone': 'Asia/Kolkata', 'wind_speed_unit': 'ms', 'models': 'era5'
    }, timeout=180)
    response.raise_for_status()
    data = response.json()
    if 'hourly' not in data:
        raise RuntimeError(f'Open-Meteo did not return hourly data:\n{data}')
    hourly = pd.DataFrame({
        'time': pd.to_datetime(data['hourly']['time']),
        'air_temp_c': data['hourly']['temperature_2m'],
        'shortwave_w_m2': data['hourly']['shortwave_radiation'],
        'wind_speed_m_s': data['hourly']['wind_speed_10m']
    })
    hourly['date'] = hourly['time'].dt.date.astype(str)
    return hourly.groupby('date', as_index=False).agg(
        air_temp_c=('air_temp_c', 'mean'), shortwave_w_m2=('shortwave_w_m2', 'mean'),
        wind_speed_m_s=('wind_speed_m_s', 'mean')
    ).sort_values('date').reset_index(drop=True)


def search_landsat(catalog, lat, lon, start_date, end_date):
    search = catalog.search(collections=['landsat-c2-l2'],
        intersects={'type': 'Point', 'coordinates': [lon, lat]},
        datetime=f'{start_date}/{end_date}',
        query={'eo:cloud_cover': {'lt': MAX_SCENE_CLOUD_PERCENT}})
    selected = []
    for item in search.items():
        if item.properties.get('platform', '') not in {'landsat-8', 'landsat-9'}:
            continue
        if 'lwir11' not in item.assets:
            continue
        selected.append(item)
    selected.sort(key=lambda x: x.datetime)
    return selected


def read_exact_pixel(asset_url, lon, lat):
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'):
        with rasterio.open(asset_url) as src:
            transformer = Transformer.from_crs('EPSG:4326', src.crs, always_xy=True)
            x, y = transformer.transform(lon, lat)
            value = next(src.sample([(x, y)], indexes=1, masked=True))[0]
            if np.ma.is_masked(value):
                return None
            value = float(value)
            if value == 0:
                return None
            return value


def get_landsat_temperature(item, lat, lon):
    try:
        temp_dn = read_exact_pixel(item.assets['lwir11'].href, lon, lat)
    except Exception:
        return None
    if temp_dn is None:
        return None
    temp_c = temp_dn * 0.00341802 + 149.0 - 273.15
    acquisition_date = pd.Timestamp(item.datetime).strftime('%Y-%m-%d')
    return {'date': acquisition_date, 'observed_lst_c': float(temp_c)}


def build_lake_file(lake_name, cfg, catalog, start_date, end_date, output_dir):
    lat, lon = cfg['lat'], cfg['lon']
    print('\n' + '=' * 70 + '\n' + lake_name + '\n' + '=' * 70)
    print('Downloading daily atmospheric forcing...')
    weather = get_daily_weather(lat, lon, start_date, end_date)
    print('Searching Landsat 8/9 scenes with <2% cloud cover...')
    scenes = search_landsat(catalog, lat, lon, start_date, end_date)
    print(f'Candidate Landsat scenes: {len(scenes)}')
    observations = []
    for scene in tqdm(scenes, desc=f'{lake_name} Landsat'):
        result = get_landsat_temperature(scene, lat, lon)
        if result is not None:
            observations.append(result)
    if observations:
        observations_df = pd.DataFrame(observations).groupby('date', as_index=False).agg(
            observed_lst_c=('observed_lst_c', 'mean'))
    else:
        observations_df = pd.DataFrame(columns=['date', 'observed_lst_c'])
    print(f'Usable Landsat observations: {len(observations_df)}')
    final = weather.merge(observations_df, on='date', how='left')[COLUMNS]
    for column in COLUMNS[1:]:
        final[column] = final[column].round(3)
    output_file = Path(output_dir) / f"{cfg['file_stem']}_daily_model_input.csv"
    final.to_csv(output_file, index=False, na_rep='')
    print(f'Saved: {output_file}\nTotal daily rows: {len(final)}')
    print(f"Observed LST dates: {final['observed_lst_c'].notna().sum()}")
    return final, output_file
