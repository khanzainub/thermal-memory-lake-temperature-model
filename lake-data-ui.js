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
    if (rows.children.length >= 20) { show('Use up to 20 lakes per notebook.', 'warning'); return; }
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

  function getConfig() {
    const lakes = [...rows.children].map((row,index) => {
      const name = row.querySelector('[name="name"]').value.trim();
      const lat = Number(row.querySelector('[name="lat"]').value), lon = Number(row.querySelector('[name="lon"]').value);
      if (!name || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('Enter a name and valid coordinates for every lake.');
      return {name, lat, lon, file_stem: name.replace(/[^a-zA-Z0-9_-]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'') || `lake_${index+1}`};
    });
    if (new Set(lakes.map(l => l.name.toLowerCase())).size !== lakes.length) throw new Error('Use a different name for each lake.');
    const used = new Set();
    lakes.forEach(lake => { const base = lake.file_stem; let i=2; while(used.has(lake.file_stem.toLowerCase())) lake.file_stem = `${base}_${i++}`; used.add(lake.file_stem.toLowerCase()); });
    const start = el('lakeDataStart').value, finish = el('lakeDataEnd').value;
    if (!start || !finish || start > finish || finish > localDate(end)) throw new Error('Choose a valid date range ending at least 10 days before today.');
    return {start_date: start, end_date: finish, lakes};
  }
  const codeCell = source => ({cell_type:'code', execution_count:null, metadata:{}, outputs:[], source});
  function makeNotebook(config, pipeline) {
    // JSON is treated as data by json.loads, never as interpolated Python code.
    const setup = `import json\nfrom pathlib import Path\nCONFIG = json.loads(${JSON.stringify(JSON.stringify(config))})\nOUTPUT_DIR = Path("lake_csv_outputs")\nOUTPUT_DIR.mkdir(exist_ok=True)\n`;
    const run = `
from datetime import datetime, timezone
from google.colab import files
catalog = pystac_client.Client.open(
    'https://planetarycomputer.microsoft.com/api/stac/v1',
    modifier=planetary_computer.sign_inplace
)
bundle = {'format': 'lake-thermal-memory-data-v1', 'frequency': 'Daily',
          'start_date': CONFIG['start_date'], 'end_date': CONFIG['end_date'],
          'created_at': datetime.now(timezone.utc).isoformat(), 'lakes': [], 'errors': []}
summary = []
for cfg in CONFIG['lakes']:
    try:
        df, path = build_lake_file(cfg['name'], cfg, catalog, CONFIG['start_date'], CONFIG['end_date'], OUTPUT_DIR)
        bundle['lakes'].append({'name': cfg['name'], 'lat': cfg['lat'], 'lon': cfg['lon'],
            'filename': path.name, 'csv': path.read_text(), 'daily_rows': len(df),
            'observed_lst_values': int(df['observed_lst_c'].notna().sum())})
        summary.append({'lake': cfg['name'], 'daily_rows': len(df),
            'observed_lst_values': int(df['observed_lst_c'].notna().sum()),
            'start_date': df['date'].min(), 'end_date': df['date'].max()})
    except Exception as error:
        print(f"FAILED: {cfg['name']}: {error}")
        bundle['errors'].append({'name': cfg['name'], 'message': str(error)})
print('\\nFINAL SUMMARY')
print(pd.DataFrame(summary).to_string(index=False) if summary else 'No lake completed successfully.')
result_path = OUTPUT_DIR / 'lake_data_results.json'
result_path.write_text(json.dumps(bundle, ensure_ascii=False), encoding='utf-8')
print('\\nReturn to the model and import lake_data_results.json.')
files.download(str(result_path))
# The separate CSV files also remain in lake_csv_outputs in the Colab Files panel.
`;
    return {nbformat:4, nbformat_minor:5, metadata:{colab:{name:'Lake_data_download.ipynb',provenance:[]},kernelspec:{display_name:'Python 3',name:'python3'},language_info:{name:'python'}}, cells:[
      {cell_type:'markdown',metadata:{},source:'# Lake data for the thermal-memory model\n\nYour lakes and dates are already configured. Sign in to Google Colab and choose **Runtime → Run all**. At completion, allow the result download, return to the model and import **lake_data_results.json**. Each lake retains its separate CSV.\n\nThis uses the supplied ERA5 + Landsat pipeline: daily means in Asia/Kolkata, Landsat 8/9 scene cloud <2%, exact pixel sampling, the original temperature conversion, same-date mean and three-decimal rounding. There is no additional QA, water-mask, temperature-range or interpolation filter. A low scene cloud percentage alone does not establish pixel quality.\n'},
      codeCell('%pip -q install pystac-client planetary-computer rasterio shapely pyproj requests pandas numpy tqdm\n'),
      codeCell(setup), codeCell(pipeline), codeCell(run)
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
  el('lakeDataForm').addEventListener('submit', async event => {
    event.preventDefault(); const button = el('prepareLakeNotebook'); button.disabled = true;
    try {
      const config = getConfig(); show('Preparing your notebook…');
      const pipeline = pipelineText === null ? await loadPipeline() : pipelineText;
      const notebook = makeNotebook(config, pipeline);
      save(JSON.stringify(notebook,null,2),'Lake_data_download.ipynb','application/x-ipynb+json');
      show(`Notebook ready for ${config.lakes.length} lake(s). Open Colab, upload this notebook and choose Runtime → Run all.`, 'success');
    } catch (error) { show(error.message,'danger'); }
    finally { button.disabled = false; }
  });

  function validateBundle(bundle) {
    if (!bundle || bundle.format !== 'lake-thermal-memory-data-v1' || bundle.frequency !== 'Daily' || !Array.isArray(bundle.lakes) || bundle.lakes.length > 20) throw new Error('Choose the lake_data_results.json file produced by the prepared notebook.');
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
      info.textContent = `${lines.length} daily rows · ${observed} observed LST dates`;
      const coordinates = document.createElement('p'); coordinates.className = 'helper'; coordinates.textContent = `Latitude: ${lake.lat} · Longitude: ${lake.lon}`;
      card.append(title,info,coordinates);
      if (observed < 10) { const note = document.createElement('p'); note.className='helper'; note.textContent='Fewer than 10 observed LST values. The existing calibration requirements still apply.'; card.append(note); }
      const actions = document.createElement('div'); actions.className = 'action-row';
      const filename = (typeof lake.filename === 'string' ? lake.filename : `${lake.name}_daily_model_input.csv`).replace(/[^a-zA-Z0-9_.-]/g,'_');
      const download = document.createElement('button'); download.type='button'; download.className='button button--ghost'; download.textContent='Download CSV';
      download.addEventListener('click',()=>save(lake.csv,filename,'text/csv;charset=utf-8'));
      const calibration = document.createElement('button'); calibration.type='button'; calibration.className='button button--secondary'; calibration.textContent='Load for calibration';
      calibration.addEventListener('click',async()=>{
        const app = window.__thermalMemoryApp;
        const current = app.getState();
        if (current.fit && !window.confirm('Loading this lake replaces the current calibration and clears its fitted results. Continue?')) return;
        const daily=document.querySelector('input[name="frequency"][value="Daily"]');
        daily.checked=true; daily.dispatchEvent(new Event('change',{bubbles:true}));
        await app.loadTextDataset(lake.csv,filename);
        if (!app.getState().rows) { show('The model rejected this dataset. See the input validation message below.','danger'); return; }
        show(`${lake.name} loaded for daily calibration. Use the existing Calibrate & reconstruct button below.`,'success');
        el('dataSection').scrollIntoView({behavior:'smooth',block:'start'});
      });
      const application = document.createElement('button'); application.type='button'; application.className='button button--secondary'; application.textContent='Load for application';
      application.addEventListener('click',async()=>{
        const app=window.__thermalMemoryApp, current=app.getState();
        if (!current.finalFit) { show('First calibrate and build the final model for this same lake, then load its application data.','warning'); return; }
        if(current.frequency !== 'Daily') { show('This CSV is daily. Build a daily final model before using it for application.','warning'); return; }
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
