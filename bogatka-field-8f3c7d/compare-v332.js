(function(){
  if(window.__bogatkaCompareV332) return;
  window.__bogatkaCompareV332 = true;

  const VERSION = '3.3.2';
  const metricOrder = [
    'totalLocationsCount','completedCount','bestScore','averageScore','candidateCount',
    'negotiationCount','keepCount','excludedCount','photoCount','storageUsage'
  ];
  const sortState = {key:'index',direction:'asc'};
  const baseUpdateSummary = window.updateSummary || (typeof updateSummary === 'function' ? updateSummary : null);

  function escapeHtml(value){
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function setVersion(){
    const label = document.getElementById('versionLabel');
    if(label && label.textContent !== VERSION) label.textContent = VERSION;
  }

  function arrangeSummaryMetrics(){
    const grid = document.querySelector('.summary-grid');
    if(!grid) return;
    grid.classList.add('summary-grid-v332');
    metricOrder.forEach(id => {
      const metric = document.getElementById(id)?.closest('.metric');
      if(!metric) return;
      metric.classList.remove('wide');
      grid.appendChild(metric);
    });
  }

  function ensureComparisonPanel(){
    const summaryCard = document.querySelector('.summary.card');
    const grid = summaryCard?.querySelector('.summary-grid');
    if(!summaryCard || !grid) return null;
    let panel = document.getElementById('locationComparisonPanel');
    if(panel) return panel;

    panel = document.createElement('details');
    panel.id = 'locationComparisonPanel';
    panel.className = 'comparison-panel-v332';
    panel.innerHTML = `
      <summary>
        <span class="comparison-summary-copy">
          <strong>Таблица сравнения локаций</strong>
          <small>Все ключевые показатели в одном месте</small>
        </span>
        <span class="comparison-count-v332" id="comparisonLocationCount">0 локаций</span>
        <span class="comparison-chevron-v332" aria-hidden="true"></span>
      </summary>
      <div class="comparison-body-v332">
        <div class="comparison-hint-v332">Нажмите на название столбца для сортировки. Нажмите на адрес, чтобы перейти к карточке локации.</div>
        <div class="comparison-scroll-v332">
          <table class="comparison-table-v332">
            <thead></thead>
            <tbody></tbody>
            <tfoot></tfoot>
          </table>
        </div>
      </div>`;
    grid.insertAdjacentElement('afterend',panel);
    panel.addEventListener('toggle',() => {
      if(panel.open) renderComparisonTable().catch(console.error);
    });
    return panel;
  }

  function parseNumber(value){
    if(typeof value === 'number') return Number.isFinite(value) ? value : null;
    if(typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g,'').replace(',','.');
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if(!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatNumber(value,digits=0){
    if(value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(Number(value));
  }

  function scoreValue(data,key){
    const value = Number(data?.score?.[key]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function statusClass(value){
    return ({
      'Кандидат':'candidate',
      'Осмотрена':'inspected',
      'Оставить':'keep',
      'Переговоры':'negotiation',
      'Исключить':'excluded'
    })[value] || 'empty';
  }

  function sortValue(row,key){
    const value = row[key];
    if(value === null || value === undefined || value === '') return sortState.direction === 'asc' ? '\uffff' : -Infinity;
    return value;
  }

  function compareRows(a,b){
    const aValue = sortValue(a,sortState.key);
    const bValue = sortValue(b,sortState.key);
    let result;
    if(typeof aValue === 'number' && typeof bValue === 'number') result = aValue - bValue;
    else result = String(aValue).localeCompare(String(bValue),'ru',{numeric:true,sensitivity:'base'});
    return sortState.direction === 'asc' ? result : -result;
  }

  function headerButton(key,label){
    const active = sortState.key === key;
    const direction = active ? (sortState.direction === 'asc' ? '▲' : '▼') : '';
    return `<button type="button" data-compare-sort="${key}" class="${active ? 'active' : ''}">${escapeHtml(label)}<span>${direction}</span></button>`;
  }

  async function collectRows(){
    const photos = await idbAll(PHOTO_STORE);
    const photoCount = new Map();
    photos.forEach(photo => photoCount.set(photo.locationId,(photoCount.get(photo.locationId) || 0) + 1));

    const rows = [];
    for(let index=0;index<locations.length;index++){
      const locationItem = locations[index];
      const data = await getLocationData(locationItem.id);
      const area = parseNumber(data?.tech?.totalArea);
      const rent = parseNumber(data?.tech?.rentPerMonth) ?? parseNumber(data?.rent);
      const statedRentPerSqm = parseNumber(data?.tech?.rentPerSqm);
      const rentPerSqm = statedRentPerSqm ?? (rent !== null && area ? rent / area : null);
      rows.push({
        index:index + 1,
        id:locationItem.id,
        title:locationItem.title || locationItem.address || `Локация ${index + 1}`,
        address:locationItem.address || '',
        status:data.status || '',
        objectType:data.objectType || '',
        score:totalFromData(data),
        area,
        rent,
        rentPerSqm,
        foot:scoreValue(data,'foot'),
        parking:scoreValue(data,'parking'),
        competition:scoreValue(data,'competition'),
        photos:photoCount.get(locationItem.id) || 0,
        decision:data.decision || '',
      });
    }
    return rows.sort(compareRows);
  }

  function scoreCell(value){
    if(value === null || value === undefined) return '<span class="compare-empty-v332">—</span>';
    return `<span class="compare-mini-score-v332">${escapeHtml(value)}</span>`;
  }

  function renderRow(row){
    const status = row.status || 'Не выбран';
    const decision = row.decision || '—';
    return `<tr>
      <td class="compare-index-v332">${row.index}</td>
      <td class="compare-location-v332">
        <button type="button" data-compare-location="${escapeHtml(row.id)}">
          <strong>${escapeHtml(row.title)}</strong>
          ${row.address && row.address !== row.title ? `<small>${escapeHtml(row.address)}</small>` : ''}
        </button>
      </td>
      <td><span class="compare-status-v332 ${statusClass(row.status)}">${escapeHtml(status)}</span></td>
      <td>${escapeHtml(row.objectType || '—')}</td>
      <td class="compare-score-total-v332"><strong>${row.score}</strong><small>/70</small></td>
      <td>${formatNumber(row.area,1)}</td>
      <td>${formatNumber(row.rent,2)}</td>
      <td>${formatNumber(row.rentPerSqm,2)}</td>
      <td>${scoreCell(row.foot)}</td>
      <td>${scoreCell(row.parking)}</td>
      <td>${scoreCell(row.competition)}</td>
      <td>${row.photos}</td>
      <td>${escapeHtml(decision)}</td>
    </tr>`;
  }

  async function renderComparisonTable(){
    const panel = ensureComparisonPanel();
    if(!panel) return;
    const table = panel.querySelector('.comparison-table-v332');
    if(!table) return;

    const rows = await collectRows();
    const count = panel.querySelector('#comparisonLocationCount');
    if(count) count.textContent = `${rows.length} ${rows.length === 1 ? 'локация' : rows.length >= 2 && rows.length <= 4 ? 'локации' : 'локаций'}`;

    table.querySelector('thead').innerHTML = `<tr>
      <th>${headerButton('index','#')}</th>
      <th class="compare-sticky-v332">${headerButton('title','Локация')}</th>
      <th>${headerButton('status','Статус')}</th>
      <th>${headerButton('objectType','Тип')}</th>
      <th>${headerButton('score','Балл')}</th>
      <th>${headerButton('area','Площадь, м²')}</th>
      <th>${headerButton('rent','Аренда, BYN')}</th>
      <th>${headerButton('rentPerSqm','BYN/м²')}</th>
      <th>${headerButton('foot','Пеш. поток')}</th>
      <th>${headerButton('parking','Парковка')}</th>
      <th>${headerButton('competition','Конкуренты')}</th>
      <th>${headerButton('photos','Фото')}</th>
      <th>${headerButton('decision','Решение')}</th>
    </tr>`;

    table.querySelector('tbody').innerHTML = rows.length
      ? rows.map(renderRow).join('')
      : '<tr><td colspan="13" class="comparison-empty-v332">Локаций пока нет.</td></tr>';

    const scoredRows = rows.filter(row => row.score > 0);
    const averageScore = scoredRows.length ? scoredRows.reduce((sum,row) => sum + row.score,0) / scoredRows.length : 0;
    const totalPhotos = rows.reduce((sum,row) => sum + row.photos,0);
    table.querySelector('tfoot').innerHTML = `<tr>
      <td colspan="4"><strong>Итого: ${rows.length} локаций</strong></td>
      <td><strong>${averageScore ? averageScore.toFixed(1) : '0'}</strong><small> ср.</small></td>
      <td colspan="6"></td>
      <td><strong>${totalPhotos}</strong></td>
      <td></td>
    </tr>`;

    table.querySelectorAll('[data-compare-sort]').forEach(button => {
      button.addEventListener('click',() => {
        const key = button.dataset.compareSort;
        if(sortState.key === key) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        else {
          sortState.key = key;
          sortState.direction = ['score','area','rent','rentPerSqm','foot','parking','competition','photos'].includes(key) ? 'desc' : 'asc';
        }
        renderComparisonTable().catch(console.error);
      });
    });

    table.querySelectorAll('[data-compare-location]').forEach(button => {
      button.addEventListener('click',() => {
        const card = document.querySelector(`[data-location-card="${CSS.escape(button.dataset.compareLocation)}"]`);
        if(!card) return;
        card.scrollIntoView({behavior:'smooth',block:'start'});
        card.classList.remove('compare-highlight-v332');
        requestAnimationFrame(() => card.classList.add('compare-highlight-v332'));
        setTimeout(() => card.classList.remove('compare-highlight-v332'),1800);
      });
    });
  }

  async function updateSummaryV332(){
    if(baseUpdateSummary) await baseUpdateSummary();
    setVersion();
    arrangeSummaryMetrics();
    ensureComparisonPanel();
    await renderComparisonTable();
  }

  window.updateSummary = updateSummaryV332;
  try{ updateSummary = updateSummaryV332; }catch(_){ }

  setVersion();
  arrangeSummaryMetrics();
  ensureComparisonPanel();
  updateSummaryV332().catch(console.error);
})();
