/* Colab data preparation/import only. Uses the existing model's input loaders. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const rows = el('lakeDataRows'), status = el('lakeDataStatus'), results = el('lakeDataResults');
  const end = new Date(); end.setDate(end.getDate() - 10);
  const localDate = value => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  el('lakeDataEnd').value = localDate(end);
  el('lakeDataEnd').max = localDate(end);
  el('lakeDataStart').max = localDate(end);
  let imported = [];
  let dataFrequency = 'Daily';
  const tabs = document.createElement('div'); tabs.className = 'action-row'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Lake data frequency');
  ['Daily', 'Monthly', 'Yearly'].forEach(frequency => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = frequency; button.setAttribute('role', 'tab');
    button.className = frequency === dataFrequency ? 'button button--secondary' : 'button button--ghost'; button.setAttribute('aria-selected', String(frequency === dataFrequency));
    button.addEventListener('click', () => { dataFrequency = frequency; [...tabs.children].forEach(tab => { const selected = tab.textContent === frequency; tab.setAttribute('aria-selected', String(selected)); tab.className = selected ? 'button button--secondary' : 'button button--ghost'; }); });
    tabs.append(button);
  });
  el('lakeDataForm').prepend(tabs);
  let rowCounter = 0;
  function show(message, kind = 'neutral') {
    status.className = `status-box status-box--${kind}`;
    status.textContent = message;
  }
  function save(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], {type}));
    const link = document.createElement('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function addRow(name = '', lat = '', lon = '') {
    const row = document.createElement('fieldset');
    row.className = 'lake-data-row';
    const legend = document.createElement('legend'); legend.textContent = 'Lake'; row.append(legend);
    const id = ++rowCounter;
    [['name','Lake name','text',name],['lat','Latitude (°)','number',lat],['lon','Longitude (°)','number',lon]].forEach(([key,label,type,value]) => {
      const wrap = document.createElement('label'); wrap.textContent = label;
      const input = document.createElement('input'); input.type = type; input.name = key;
      input.id = `lake-${id}-${key}`; input.value = value; input.required = true;
      if (type === 'number') { input.step = 'any'; input.min = key === 'lat' ? '-90' : '-180'; input.max = key === 'lat' ? '90' : '180'; }
      else input.maxLength = 80;
      wrap.append(input); row.append(wrap);
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button--ghost';
    remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove lake ${name || id}`);
    remove.addEventListener('click', () => {
      if (rows.children.length === 1) { show('Keep at least one lake.', 'warning'); return; }
      row.remove();
    });
    row.append(remove); rows.append(row);
  }
  addRow('Pangong Tso', 33.818895, 78.605780);
  addRow('Tso Moriri', 32.897510, 78.312963);
  el('addLakeDataRow').addEventListener('click', () => addRow());


  function parseLakeList(text) {
    const records = [];
    let record = [], field = '', quoted = false, closed = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
        else field += c;
      } else if (c === ',' || c === '\n' || c === '\r') {
        record.push(field); field = ''; closed = false;
        if (c !== ',') { if (c === '\r' && text[i+1] === '\n') i++; if (record.some(v => v.trim())) records.push(record); record = []; }
      } else if (c === '"' && !field && !closed) quoted = true;
      else { if (closed || c === '"') throw new Error('Invalid CSV quoting.'); field += c; }
    }
    if (quoted) throw new Error('Unclosed quoted field in CSV.');
    record.push(field); if (record.some(v => v.trim())) records.push(record);
    if (records.length < 2) throw new Error('Include a header and at least one lake.');
    const header = records.shift().map(v => v.trim().toLowerCase());
    const required = ['lake_name', 'latitude', 'longitude'];
    if (header.length !== 3 || required.some(k => header.filter(v => v === k).length !== 1)) throw new Error('CSV columns must be lake_name, latitude, longitude.');
    const seen = new Set();
    return records.map((r, i) => {
      if (r.length !== 3) throw new Error(`CSV data row ${i+1}: expected three columns.`);
      const name = r[header.indexOf('lake_name')].trim();
      const latitude = r[header.indexOf('latitude')].trim(), longitude = r[header.indexOf('longitude')].trim();
      const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
      const lat = Number(latitude), lon = Number(longitude);
      if (!name || name.length > 80 || !decimal.test(latitude) || !decimal.test(longitude) || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error(`CSV data row ${i+1}: use a lake name and valid latitude/longitude in decimal degrees.`);
      if (seen.has(name.toLowerCase())) throw new Error(`CSV data row ${i+1}: duplicate lake name "${name}".`);
      seen.add(name.toLowerCase());
      return {name, lat, lon};
    });
  }
  const listPanel = document.createElement('div'); listPanel.className = 'subpanel';
  const listTitle = document.createElement('h3'); listTitle.textContent = 'Upload multiple lakes';
  const listHint = document.createElement('p'); listHint.className = 'helper';
  listHint.textContent = 'CSV columns: lake_name, latitude, longitude. Use decimal degrees. Upload replaces the lake entries below; you can edit them before downloading one Colab notebook for the whole list, including 100 or more lakes.';
  const listActions = document.createElement('div'); listActions.className = 'action-row';
  const listLabel = document.createElement('label'); listLabel.className = 'button button--secondary'; listLabel.textContent = 'Upload lake list CSV';
  const listInput = document.createElement('input'); listInput.type = 'file'; listInput.accept = '.csv,text/csv'; listInput.setAttribute('aria-label', 'Upload lake list CSV');
  listLabel.append(listInput);
  const demo = document.createElement('button'); demo.type = 'button'; demo.className = 'button button--ghost'; demo.textContent = 'Download demo lake CSV';
  demo.addEventListener('click', () => save('lake_name,latitude,longitude\nPangong Tso,33.818895,78.605780\nTso Moriri,32.897510,78.312963\n', 'lake_list_demo.csv', 'text/csv;charset=utf-8'));
  listInput.addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 5000000) throw new Error('Lake list CSV exceeds 5 MB.');
      const lakes = parseLakeList(await file.text());
      rows.replaceChildren(); lakes.forEach(lake => addRow(lake.name, lake.lat, lake.lon));
      show(`Loaded ${lakes.length} lakes from CSV. Choose Daily, Monthly or Yearly and download the prepared Colab notebook.`, 'success');
    } catch (error) { show(`Lake list upload failed: ${error.message} Existing entries were kept.`, 'danger'); }
    finally { event.target.value = ''; }
  });
  listActions.append(listLabel, demo); listPanel.append(listTitle, listHint, listActions); rows.before(listPanel);

  function getConfig() {
    const name=el('lakeName').value.trim(),active=localStorage.getItem('restlake:insitu-active-lake:v1');
    if(!name||!active||name.toLowerCase()!==active.toLowerCase())
      throw new Error('First select the lake using "Use this lake".');
    const storage=JSON.parse(localStorage.getItem('restlake:insitu-calibration:2026-10-26:v1') || '{}');
    const item=Object.entries(storage.lakes||{}).find(([k])=>k.toLowerCase()===active.toLowerCase());
    const observations=item?.[1]?.saved||[];
    if(!observations.length)throw new Error('Save your in-situ measurements first.');
    const windows=ReSTInSituCore.searchWindows(observations);
    if(!windows.length)throw new Error('No satellite download windows found.');
    const number=s=>String(s).trim().replace(/[,。\u066B\uFF0E]/g,'.').replace(/\s*°\s*$/,'');
    const a=number(el('satelliteLat').value),b=number(el('satelliteLon').value);
    const dd=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
    if(!dd.test(a)||!dd.test(b)||Math.abs(Number(a))>90||Math.abs(Number(b))>180)
      throw new Error('Enter latitude and longitude in decimal degrees for satellite download.');
    const cutoff=localDate(end);
    if(windows.some(w=>w.start>cutoff||w.end>cutoff))
      throw new Error('One or more ±1-month satellite windows extend beyond '+cutoff+'. No windows can be silently excluded.');
    const stem=name.replace(/[^a-zA-Z0-9_-]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'lake';
    return {lake:{name,lat:Number(a),lon:Number(b),file_stem:stem},
      windows:windows.map(w=>({start_date:w.start,end_date:w.end,observation_count:w.observation_count})),
      n_insitu:observations.length,output_name:stem+'_satellite_LST_bias_calibration.csv'};
  }
  const codeCell = source => ({cell_type:'code', execution_count:null, metadata:{}, outputs:[], source});
  function makeNotebook(config, pipeline) {
    const setup='import json\nfrom pathlib import Path\nCONFIG=json.loads('+
      JSON.stringify(JSON.stringify(config))+')\nOUTPUT_DIR=Path("lake_csv_outputs")\nOUTPUT_DIR.mkdir(exist_ok=True)\n';
    const run=[
      'from tempfile import TemporaryDirectory',
      'from google.colab import files',
      'catalog = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=planetary_computer.sign_inplace)',
      'cfg = CONFIG["lake"]',
      'windows = CONFIG["windows"]',
      'frames = []',
      'failures = []',
      'print("Satellite windows:", len(windows), "Lake:", cfg["name"])',
      'for index, window in enumerate(windows, 1):',
      '    start, stop = window["start_date"], window["end_date"]',
      '    print("Window", index, "of", len(windows), ":", start, "to", stop)',
      '    for attempt in range(1, 4):',
      '        try:',
      '            with TemporaryDirectory(prefix="rest_lake_satellite_") as temp_dir:',
      '                df, _ = build_lake_file(cfg["name"], cfg, catalog, start, stop, Path(temp_dir))',
      '                if list(df.columns) != COLUMNS: raise ValueError("Unexpected satellite CSV schema")',
      '                if df.empty: raise ValueError("No daily forcing data found")',
      '                frames.append(df.copy())',
      '            print("Completed window", index, "daily rows:", len(df), "valid satellite LST:", int(df["observed_lst_c"].notna().sum()))',
      '            break',
      '        except Exception as error:',
      '            print("Attempt", attempt, "failed for", start, "to", stop, ":", error)',
      '            if attempt == 3: failures.append(str(start)+" to "+str(stop)+": "+str(error))',
      'if failures:',
      '    raise RuntimeError("Some windows failed; no falsely complete CSV was exported. "+ "; ".join(failures))',
      'if not frames: raise RuntimeError("No satellite windows produced data")',
      'combined=pd.concat(frames, ignore_index=True)',
      'combined["date"]=combined["date"].astype(str)',
      'combined=combined.sort_values("date").reset_index(drop=True)',
      'if combined["date"].duplicated().any():',
      '    raise RuntimeError("Overlapping daily rows detected; no duplicates were silently discarded")',
      'combined=combined[COLUMNS]',
      'path=OUTPUT_DIR / CONFIG["output_name"]',
      'combined.to_csv(path, index=False, na_rep="")',
      'print("All", len(windows), "download windows completed.")',
      'print("In-situ dates defining windows:", CONFIG["n_insitu"])',
      'print("Combined daily rows:", len(combined))',
      'print("Valid satellite LST observations:", int(combined["observed_lst_c"].notna().sum()))',
      'print("Absent satellite temperatures stay missing; no interpolation.")',
      'print("Downloading ONE combined file:", path.name)',
      'files.download(str(path))'
    ].join('\n');
    const notes=[
      '# ReST-Lake Satellite LST for In-Situ Bias Calibration',
      '',
      'Lake: '+config.lake.name,
      'Available in-situ dates: '+config.n_insitu,
      'Distinct ±1-month satellite download windows: '+config.windows.length,
      '',
      ...config.windows.map((w,i)=>(i+1)+'. '+w.start_date+' to '+w.end_date+' ('+w.observation_count+' in-situ dates)'),
      '',
      'Choose Runtime → Run all ONCE. This notebook uses the unchanged ERA5/Landsat pipeline over EVERY window and automatically downloads one combined CSV: '+config.output_name+'.',
      'The five original satellite CSV columns are preserved. Missing satellite observations are not interpolated; the number of valid Landsat dates may be less than the in-situ date count.'
    ].join('\n');
    return {nbformat:4,nbformat_minor:5,metadata:{colab:{name:'Satellite_all_insitu_windows.ipynb',provenance:[]},
      kernelspec:{display_name:'Python 3',name:'python3'},language_info:{name:'python'}},cells:[
      {cell_type:'markdown',metadata:{},source:notes},
      codeCell('%pip -q install pystac-client planetary-computer rasterio shapely pyproj requests pandas numpy tqdm\n'),
      codeCell(setup),codeCell(pipeline),codeCell(run)
    ]};
  }
  let pipelineText = null;
  let pipelineRequest = null;
  function loadPipeline() {
    if (!pipelineRequest) {
      pipelineRequest = fetch('data-download/lake_data.py').then(async response => {
        if (!response.ok) throw new Error('Could not load the data pipeline. Refresh and try again.');
        pipelineText = await response.text();
        return pipelineText;
      }).catch(error => { pipelineRequest = null; throw error; });
    }
    return pipelineRequest;
  }
  // Keep subsequent downloads within the user's click, without an awaited fetch.
  loadPipeline().catch(() => {});
  // A real download link retains the browser's direct user-click download action.
  const oldDownloadButton = el('prepareLakeNotebook');
  const notebookDownload = document.createElement('a');
  notebookDownload.id = oldDownloadButton.id;
  notebookDownload.className = oldDownloadButton.className;
  notebookDownload.textContent = oldDownloadButton.textContent;
  notebookDownload.href = '#';
  notebookDownload.download = 'Satellite_all_insitu_windows.ipynb';
  oldDownloadButton.replaceWith(notebookDownload);
  let notebookUrl = null;
  notebookDownload.addEventListener('click', event => {
    try {
      const config = getConfig();
      if (pipelineText === null) {
        event.preventDefault();
        show('Loading notebook preparation. Please click Download again when ready.');
        loadPipeline().then(() => show('Ready. Click Download prepared Colab notebook.', 'success'))
          .catch(error => show(error.message, 'danger'));
        return;
      }
      const notebook = makeNotebook(config, pipelineText);
      const nextUrl = URL.createObjectURL(new Blob([JSON.stringify(notebook, null, 2)], {type:'application/x-ipynb+json'}));
      if (notebookUrl) {
        const previousUrl = notebookUrl;
        setTimeout(() => URL.revokeObjectURL(previousUrl), 60000);
      }
      notebookUrl = nextUrl;
      notebookDownload.href = nextUrl;
      show('One notebook ready: '+config.windows.length+' satellite windows for '+config.n_insitu+' in-situ dates; run it once in Colab for one combined CSV.', 'success');
      // Do not preventDefault: the anchor downloads through its native click.
    } catch (error) {
      event.preventDefault();
      show(error.message, 'danger');
    }
  });
  el('lakeDataForm').addEventListener('submit', event => event.preventDefault());

  function validateBundle(bundle) {
    if (!bundle || bundle.format !== 'lake-thermal-memory-data-v1' || !['Daily', 'Monthly', 'Yearly'].includes(bundle.frequency) || !Array.isArray(bundle.lakes)) throw new Error('Choose the lake_data_results.json file produced by the prepared notebook.');
    const columns = 'date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c';
    bundle.lakes.forEach(lake => {
      if (typeof lake.name !== 'string' || !lake.name.trim() || typeof lake.csv !== 'string' || lake.csv.length > 10000000 || lake.csv.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0] !== columns) throw new Error('The result file contains an invalid lake CSV or a changed column format.');
    });
    if (bundle.errors !== undefined && (!Array.isArray(bundle.errors) || bundle.errors.some(e => !e || typeof e.name !== 'string' || typeof e.message !== 'string'))) throw new Error('The result file contains an invalid error summary.');
    return bundle;
  }
  function drawResults(bundle) {
    imported = bundle.lakes;
    results.replaceChildren();
    imported.forEach(lake => {
      const card = document.createElement('article'); card.className = 'subpanel lake-data-result';
      const title = document.createElement('h3'); title.textContent = lake.name;
      const info = document.createElement('p'); info.className = 'helper';
      const lines = lake.csv.trim().split(/\r?\n/).slice(1);
      const observed = lines.filter(line => line.split(',')[4]?.trim()).length;
      info.textContent = `${lines.length} ${bundle.frequency.toLowerCase()} rows · ${observed} observed LST dates`;
      const coordinates = document.createElement('p'); coordinates.className = 'helper'; coordinates.textContent = `Latitude: ${lake.lat} · Longitude: ${lake.lon}`;
      card.append(title,info,coordinates);
      if (observed < 10) { const note = document.createElement('p'); note.className='helper'; note.textContent='Fewer than 10 observed LST values. The existing calibration requirements still apply.'; card.append(note); }
      const actions = document.createElement('div'); actions.className = 'action-row';
      const filename = (typeof lake.filename === 'string' ? lake.filename : `${lake.name}_${bundle.frequency.toLowerCase()}_model_input.csv`).replace(/[^a-zA-Z0-9_.-]/g,'_');
      const download = document.createElement('button'); download.type='button'; download.className='button button--ghost'; download.textContent='Download CSV';
      download.addEventListener('click',()=>save(lake.csv,filename,'text/csv;charset=utf-8'));
      const calibration = document.createElement('button'); calibration.type='button'; calibration.className='button button--secondary'; calibration.textContent='Load for calibration';
      calibration.addEventListener('click',async()=>{
        const app = window.__thermalMemoryApp;
        const current = app.getState();
        if (current.fit && !window.confirm('Loading this lake replaces the current calibration and clears its fitted results. Continue?')) return;
        const daily=document.querySelector(`input[name="frequency"][value="${bundle.frequency}"]`);
        daily.checked=true; daily.dispatchEvent(new Event('change',{bubbles:true}));
        await app.loadTextDataset(lake.csv,filename);
        if (!app.getState().rows) { show('The model rejected this dataset. See the input validation message below.','danger'); return; }
        show(`${lake.name} loaded for ${bundle.frequency.toLowerCase()} calibration. Use the existing Calibrate & reconstruct button below.`,'success');
        el('dataSection').scrollIntoView({behavior:'smooth',block:'start'});
      });
      const application = document.createElement('button'); application.type='button'; application.className='button button--secondary'; application.textContent='Load for application';
      application.addEventListener('click',async()=>{
        const app=window.__thermalMemoryApp, current=app.getState();
        if (!current.finalFit) { show('First calibrate and build the final model for this same lake, then load its application data.','warning'); return; }
        if(current.frequency !== bundle.frequency) { show(`This CSV is ${bundle.frequency.toLowerCase()}. Build a ${bundle.frequency.toLowerCase()} final model before using it for application.`,'warning'); return; }
        if(current.sourceName !== filename && !window.confirm('Use only parameters fitted for this same lake. Is the current final model for this lake?')) return;
        await app.loadApplicationDataset(lake.csv,filename);
        if(!app.getState().applicationRows) {show('The model rejected this application dataset. See its validation message.','danger');return;}
        show(`${lake.name} loaded. Choose the application settings and run reconstruction / prediction below.`,'success');
        document.querySelector('.application-panel').scrollIntoView({behavior:'smooth',block:'start'});
      });
      actions.append(download,calibration,application); card.append(actions); results.append(card);
    });
    (bundle.errors||[]).forEach(error=>{
      const message=document.createElement('p'); message.className='status-box status-box--warning';
      message.textContent=`${error.name}: download failed — ${error.message}`; results.append(message);
    });
    show(imported.length ? `Imported ${imported.length} separate lake dataset(s). Select a lake to download or load.` : 'No lake completed. See the download errors below.', imported.length ? 'success':'warning');
  }
  el('lakeDataBundle').addEventListener('change',async event=>{
    const file=event.target.files[0]; if(!file) return;
    try {
      if(file.size>25000000) throw new Error('Result file exceeds 25 MB. Run fewer lakes per notebook.');
      drawResults(validateBundle(JSON.parse(await file.text())));
    }catch(error){show(`Import failed: ${error.message}`,'danger');}
    finally{event.target.value='';}
  });
})();
