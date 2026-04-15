// ─── Main Card ─────────────────────────────────────────────────────────────

class YWDAreaLightsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = null;
    this._entities = [];
    this._lastHash = '';
  }

  static getConfigElement() {
    return document.createElement('ywd-area-lights-card-editor');
  }

  static getStubConfig() {
    return { area: '', columns: 1, entity_overrides: {}, entity_order: [], domains: ['light', 'switch'] };
  }

  setConfig(config) {
    this._config = {
      columns: 1,
      entity_overrides: {},
      entity_order: [],
      domains: ['light', 'switch'],
      tile_color: 'var(--card-background-color, #1c1c1c)',
      icon_color_on: 'var(--primary-color)',
      icon_color_off: 'rgba(255,255,255,0.4)',
      show_state: true,
      border_radius: '28px',
      ...config,
    };
    this._updateEntities();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateEntities();
  }

  _updateEntities() {
    if (!this._hass || !this._config?.area) {
      this._entities = [];
      this._render();
      return;
    }
    const areaId = this._config.area;
    const entityRegistry = this._hass.entities || {};
    const deviceRegistry = this._hass.devices || {};
    const domains = this._config.domains || ['light', 'switch'];
    const found = [];
    for (const [entityId, entity] of Object.entries(entityRegistry)) {
      const domain = entityId.split('.')[0];
      if (!domains.includes(domain)) continue;
      const deviceAreaId = entity.device_id ? deviceRegistry[entity.device_id]?.area_id : null;
      if ((entity.area_id === areaId || deviceAreaId === areaId) && this._hass.states[entityId]) {
        found.push(entityId);
      }
    }
    const order = this._config.entity_order || [];
    this._entities = [
      ...order.filter(id => found.includes(id)),
      ...found.filter(id => !order.includes(id)),
    ];
    this._render();
  }

  _getName(entityId) {
    return this._config.entity_overrides?.[entityId]?.name
      || this._hass?.states[entityId]?.attributes?.friendly_name
      || entityId.split('.')[1].replace(/_/g, ' ');
  }

  _getIcon(entityId) {
    const override = this._config.entity_overrides?.[entityId]?.icon;
    if (override) return override;
    const state = this._hass?.states[entityId];
    if (state?.attributes?.icon) return state.attributes.icon;
    const domain = entityId.split('.')[0];
    const isOn = state?.state === 'on';
    if (domain === 'light') return isOn ? 'mdi:lightbulb' : 'mdi:lightbulb-outline';
    if (domain === 'switch') return isOn ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline';
    return 'mdi:power';
  }

  _isOn(entityId) {
    return this._hass?.states[entityId]?.state === 'on';
  }

  _isUnavailable(entityId) {
    return this._hass?.states[entityId]?.state === 'unavailable';
  }

  _getActiveColor(entityId, stateObj, cfg, fallback) {
    if (!stateObj || stateObj.state !== 'on') return fallback;
    if (entityId.startsWith('light.') && cfg.entity_overrides?.[entityId]?.use_light_color) {
      const rgb = stateObj.attributes?.rgb_color;
      if (rgb && Array.isArray(rgb) && rgb.length === 3) {
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      }
    }
    return fallback;
  }

  _toggle(entityId) {
    if (this._isUnavailable(entityId)) return;
    const domain = entityId.split('.')[0];
    const isOn = this._isOn(entityId);
    this._hass.callService(domain, isOn ? 'turn_off' : 'turn_on', { entity_id: entityId });
  }

  _handleSlider(entityId, value) {
    if (this._isUnavailable(entityId)) return;
    this._hass.callService('light', 'turn_on', {
      entity_id: entityId,
      brightness_pct: value
    });
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      detail: { entityId },
      bubbles: true,
      composed: true,
    }));
  }

  _render() {
    if (!this.shadowRoot) return;

    const cfg = this._config || {};
    const visible = this._entities.filter(id => !cfg.entity_overrides?.[id]?.hidden);

    const columns = cfg.columns || 1;
    const tileColor = cfg.tile_color || 'var(--card-background-color, #1c1c1c)';
    const borderRadius = cfg.border_radius || '28px';
    const configHash = visible.join('|') + columns + tileColor + borderRadius;

    if (this._lastHash !== configHash || !this.shadowRoot.querySelector('.grid')) {
      this._buildDOM(visible, cfg, columns, tileColor, borderRadius);
      this._lastHash = configHash;
    }

    this._updateState(visible, cfg);
  }

  _buildDOM(visible, cfg, columns, tileColor, borderRadius) {
    this.shadowRoot.innerHTML = '';
    const isMultiCol = columns > 1;

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      :host { display: block; width: 100%; }

      .grid {
        display: grid;
        grid-template-columns: repeat(${columns}, minmax(0, 1fr));
        gap: 12px;
        padding: 4px 0;
        width: 100%;
      }

      .card {
        background: ${tileColor};
        border-radius: ${borderRadius};
        padding: ${isMultiCol ? '16px 12px' : '20px'};
        box-shadow: var(--ha-card-box-shadow, none);
        border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, transparent);
        display: flex;
        flex-direction: column;
        gap: ${isMultiCol ? '16px' : '20px'};
        font-family: var(--primary-font-family, sans-serif);
        overflow: hidden;
        --card-active-color: var(--primary-color);
        --card-inactive-color: ${cfg.icon_color_off || 'rgba(255,255,255,0.4)'};
        transition: opacity 0.2s ease;
      }

      .card.unavailable {
        opacity: 0.72;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .info-group {
        display: flex;
        align-items: center;
        gap: ${isMultiCol ? '10px' : '16px'};
        min-width: 0;
        cursor: pointer;
        flex: 1;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      .info-group:active {
        opacity: 0.7;
      }

      .card.unavailable .info-group {
        cursor: default;
      }

      .icon-box {
        width: ${isMultiCol ? '40px' : '48px'};
        height: ${isMultiCol ? '40px' : '48px'};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: rgba(255,255,255,0.05);
        transition: background 0.3s ease;
        position: relative;
      }

      .icon-box.on {
        background: color-mix(in srgb, var(--card-active-color) 20%, transparent);
      }

      ha-icon {
        color: var(--card-inactive-color);
        transition: color 0.3s ease, opacity 0.2s ease;
      }

      ha-icon.on {
        color: var(--card-active-color);
      }

      .card.unavailable ha-icon.main-icon {
        opacity: 0.65;
      }

      .unavailable-badge {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        display: none;
        align-items: center;
        justify-content: center;
        background: var(--error-color, #FF9800);
        color: white;
        border: 2px solid ${tileColor};
        box-shadow: 0 1px 3px rgba(0,0,0,0.35);
      }

      .unavailable-badge ha-icon {
        color: white !important;
        --mdc-icon-size: 10px;
      }

      .unavailable-badge.show {
        display: flex;
      }

      .details {
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;
      }

      .name {
        font-size: ${isMultiCol ? '1rem' : '1.2rem'};
        font-weight: 500;
        color: var(--primary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      ha-switch {
        --switch-checked-button-color: #ffffff;
        --switch-checked-track-color: var(--card-active-color);
        --mdc-theme-primary: var(--card-active-color);
        flex-shrink: 0;
      }

      .slider-row {
        display: flex;
        flex-direction: column;
        gap: ${isMultiCol ? '8px' : '12px'};
      }

      .slider-label {
        display: flex;
        justify-content: space-between;
        text-transform: uppercase;
        font-size: ${isMultiCol ? '0.65rem' : '0.75rem'};
        letter-spacing: 1px;
        color: var(--secondary-text-color);
        font-weight: 600;
      }

      input[type="range"] {
        -webkit-appearance: none;
        width: 100%;
        height: 6px;
        background: rgba(255,255,255,0.1);
        border-radius: 5px;
        outline: none;
      }

      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--card-active-color);
        cursor: pointer;
        box-shadow: 0 0 10px rgba(0,0,0,0.2);
        transition: background 0.3s ease;
      }

      .no-config {
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:8px;
        padding:16px;
        opacity:0.4;
        font-size:13px;
        font-family:var(--primary-font-family,sans-serif);
        color:var(--primary-text-color);
      }
    `;
    this.shadowRoot.appendChild(style);

    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'no-config';
      empty.innerHTML = `<ha-icon icon="${!cfg.area ? 'mdi:lightbulb-outline' : 'mdi:magnify'}"></ha-icon>
                         <span>${!cfg.area ? 'No area configured' : 'No lights found in area'}</span>`;
      this.shadowRoot.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid';

    visible.forEach(entityId => {
      const isLight = entityId.startsWith('light.');
      const card = document.createElement('div');
      card.className = 'card';
      card.id = `card-${entityId.replace(/\./g, '-')}`;

      const header = document.createElement('div');
      header.className = 'header';

      const infoGroup = document.createElement('div');
      infoGroup.className = 'info-group';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'icon-box';

      const icon = document.createElement('ha-icon');
      icon.className = 'main-icon';
      iconWrap.appendChild(icon);

      const unavailableBadge = document.createElement('div');
      unavailableBadge.className = 'unavailable-badge';
      unavailableBadge.innerHTML = `<ha-icon icon="mdi:exclamation-thick"></ha-icon>`;
      iconWrap.appendChild(unavailableBadge);

      const details = document.createElement('div');
      details.className = 'details';

      const name = document.createElement('span');
      name.className = 'name';

      details.appendChild(name);

      infoGroup.appendChild(iconWrap);
      infoGroup.appendChild(details);

      const toggle = document.createElement('ha-switch');
      toggle.addEventListener('change', () => this._toggle(entityId));

      header.appendChild(infoGroup);
      header.appendChild(toggle);
      card.appendChild(header);

      if (isLight) {
        const sliderRow = document.createElement('div');
        sliderRow.className = 'slider-row';

        const sliderLabel = document.createElement('div');
        sliderLabel.className = 'slider-label';

        const labelText = document.createElement('span');
        labelText.textContent = 'BRIGHTNESS';

        const pctText = document.createElement('span');
        pctText.className = 'pct-text';

        sliderLabel.appendChild(labelText);
        sliderLabel.appendChild(pctText);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '100';
        slider.dataset.dragging = 'false';

        const setDragging = (val) => slider.dataset.dragging = val;
        slider.addEventListener('mousedown', () => setDragging('true'));
        slider.addEventListener('touchstart', () => setDragging('true'), { passive: true });
        slider.addEventListener('mouseup', () => setDragging('false'));
        slider.addEventListener('touchend', () => setDragging('false'));
        slider.addEventListener('blur', () => setDragging('false'));

        slider.addEventListener('change', (e) => {
          setDragging('false');
          this._handleSlider(entityId, e.target.value);
        });

        slider.addEventListener('input', (e) => {
          pctText.textContent = e.target.value + '%';
        });

        sliderRow.appendChild(sliderLabel);
        sliderRow.appendChild(slider);
        card.appendChild(sliderRow);
      }

      let timer = null;
      let fired = false;

      const startPress = () => {
        fired = false;
        timer = setTimeout(() => {
          fired = true;
          this._moreInfo(entityId);
        }, 500);
      };
      const cancelPress = () => clearTimeout(timer);

      infoGroup.addEventListener('mousedown', startPress);
      infoGroup.addEventListener('mouseup', cancelPress);
      infoGroup.addEventListener('mouseleave', cancelPress);
      infoGroup.addEventListener('touchstart', startPress, { passive: true });
      infoGroup.addEventListener('touchend', cancelPress);
      infoGroup.addEventListener('touchcancel', cancelPress);
      infoGroup.addEventListener('click', () => {
        if (!fired && !this._isUnavailable(entityId)) this._toggle(entityId);
      });

      grid.appendChild(card);
    });

    this.shadowRoot.appendChild(grid);
  }

  _updateState(visible, cfg) {
    const iconColorOn = cfg.icon_color_on || 'var(--primary-color)';

    visible.forEach(entityId => {
      const card = this.shadowRoot.getElementById(`card-${entityId.replace(/\./g, '-')}`);
      if (!card) return;

      const isOn = this._isOn(entityId);
      const isUnavailable = this._isUnavailable(entityId);
      const stateObj = this._hass.states[entityId];

      const activeColor = this._getActiveColor(entityId, stateObj, cfg, iconColorOn);

      card.style.setProperty('--card-active-color', activeColor);

      if (isUnavailable) card.classList.add('unavailable');
      else card.classList.remove('unavailable');

      const iconWrap = card.querySelector('.icon-box');
      if (iconWrap) {
        if (isOn && !isUnavailable) iconWrap.classList.add('on');
        else iconWrap.classList.remove('on');
      }

      const icon = card.querySelector('.main-icon');
      if (icon) {
        icon.setAttribute('icon', this._getIcon(entityId));
        if (isOn && !isUnavailable) icon.classList.add('on');
        else icon.classList.remove('on');
      }

      const unavailableBadge = card.querySelector('.unavailable-badge');
      if (unavailableBadge) {
        if (isUnavailable) unavailableBadge.classList.add('show');
        else unavailableBadge.classList.remove('show');
      }

      const name = card.querySelector('.name');
      if (name) name.textContent = this._getName(entityId);

      const toggle = card.querySelector('ha-switch');
      if (toggle) {
        if (toggle.checked !== isOn) {
          toggle.checked = isOn;
        }
        toggle.disabled = isUnavailable;
      }

      if (entityId.startsWith('light.') && stateObj) {
        const sliderRow = card.querySelector('.slider-row');
        const slider = card.querySelector('input[type="range"]');
        const pctText = card.querySelector('.pct-text');

        if (sliderRow) {
          sliderRow.style.display = (!isUnavailable && isOn) ? 'flex' : 'none';
        }

        const brightness = stateObj.attributes?.brightness
          ? Math.round((stateObj.attributes.brightness / 255) * 100)
          : (isOn ? 100 : 0);

        if (slider) {
          slider.disabled = isUnavailable;
          if (slider.dataset.dragging !== 'true' && document.activeElement !== slider) {
            if (slider.value !== String(brightness)) {
              slider.value = brightness;
            }
            if (pctText) {
              pctText.textContent = `${brightness}%`;
            }
          }
        }
      }
    });
  }

  connectedCallback() {
    this._refreshInterval = setInterval(() => this._updateEntities(), 30000);
  }

  disconnectedCallback() {
    if (this._refreshInterval) clearInterval(this._refreshInterval);
  }

  getCardSize() {
    return Math.ceil((this._entities.length || 1) / (this._config.columns || 1));
  }
}

// ─── Editor ────────────────────────────────────────────────────────────────

class YWDAreaLightsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._expandedEntity = null;
    this._initialized = false;
    this._dragSrc = null;
    this._dragOrder = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._fullRender();
    } else {
      this._updateAreaOptions();
    }
  }

  setConfig(config) {
    this._config = {
      columns: 1,
      entity_overrides: {},
      entity_order: [],
      domains: ['light', 'switch'],
      show_state: true,
      border_radius: '28px',
      ...config,
    };
    this._fullRender();
  }

  _getAreas() {
    return Object.values(this._hass?.areas || {}).sort((a, b) => a.name.localeCompare(b.name));
  }

  _getEntitiesForArea(areaId) {
    if (!this._hass || !areaId) return [];
    const domains = this._config.domains || ['light', 'switch'];
    const found = [];
    for (const [entityId, entity] of Object.entries(this._hass.entities || {})) {
      const domain = entityId.split('.')[0];
      if (!domains.includes(domain)) continue;
      const deviceAreaId = entity.device_id ? this._hass.devices?.[entity.device_id]?.area_id : null;
      if (entity.area_id === areaId || deviceAreaId === areaId) found.push(entityId);
    }
    const order = this._config.entity_order || [];
    return [
      ...order.filter(id => found.includes(id)),
      ...found.filter(id => !order.includes(id)),
    ];
  }

  _fire(config) {
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config },
      bubbles: true,
      composed: true,
    }));
  }

  _updateOverride(entityId, field, value) {
    const overrides = JSON.parse(JSON.stringify(this._config.entity_overrides || {}));
    if (!overrides[entityId]) overrides[entityId] = {};
    if (value !== '' && value !== null && value !== undefined && value !== false) {
      overrides[entityId][field] = value;
    } else {
      delete overrides[entityId][field];
      if (Object.keys(overrides[entityId]).length === 0) delete overrides[entityId];
    }
    this._fire({ ...this._config, entity_overrides: overrides });
  }

  _toggleHidden(entityId) {
    const current = this._config.entity_overrides?.[entityId]?.hidden || false;
    this._updateOverride(entityId, 'hidden', !current);
    setTimeout(() => this._renderEntitiesSection(), 50);
  }

  _toggleExpand(entityId) {
    this._expandedEntity = this._expandedEntity === entityId ? null : entityId;
    this._renderEntitiesSection();
  }

  _getDisplayName(entityId) {
    return this._config.entity_overrides?.[entityId]?.name
      || this._hass?.states[entityId]?.attributes?.friendly_name
      || entityId.split('.')[1].replace(/_/g, ' ');
  }

  _getDisplayIcon(entityId) {
    return this._config.entity_overrides?.[entityId]?.icon
      || this._hass?.states[entityId]?.attributes?.icon
      || (entityId.startsWith('light.') ? 'mdi:lightbulb' : 'mdi:toggle-switch');
  }

  _cssToHex(color) {
    if (!color || color.startsWith('var(')) return '#03a9f4';
    const map = { orange: '#ffa500', white: '#ffffff', grey: '#808080', gray: '#808080', blue: '#0000ff', red: '#ff0000' };
    return map[color] || (color && color.startsWith('#') ? color : '#ffa500');
  }

  _updateAreaOptions() {
    const select = this.shadowRoot && this.shadowRoot.getElementById('area-select');
    if (!select) return;
    const areas = this._getAreas();
    const selectedArea = this._config.area || '';
    const currentOptions = Array.from(select.options).map(o => o.value).filter(v => v);
    const newOptions = areas.map(a => a.area_id);
    if (JSON.stringify(currentOptions) === JSON.stringify(newOptions)) return;
    while (select.options.length > 1) select.remove(1);
    areas.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.area_id;
      opt.textContent = a.name;
      opt.selected = a.area_id === selectedArea;
      select.appendChild(opt);
    });
  }

  _renderEntitiesSection() {
    const container = this.shadowRoot && this.shadowRoot.getElementById('entities-section');
    if (!container) return;
    container.innerHTML = '';
    const entities = this._getEntitiesForArea(this._config.area);
    if (!entities.length) return;

    const label = document.createElement('div');
    label.className = 'section-label';
    label.textContent = 'Lights & Switches';
    container.appendChild(label);

    entities.forEach(entityId => this._buildEntityRow(container, entityId, entities));
    this._attachDragHandlers(container, entities);
  }

  _buildEntityRow(container, entityId, allEntities) {
    const overrides = this._config.entity_overrides || {};
    const isHidden = overrides[entityId]?.hidden || false;
    const isExpanded = this._expandedEntity === entityId;
    const displayName = this._getDisplayName(entityId);
    const displayIcon = this._getDisplayIcon(entityId);
    const domain = entityId.split('.')[0];
    const defaultName = this._hass?.states[entityId]?.attributes?.friendly_name || entityId;

    const row = document.createElement('div');
    row.className = 'entity-row' + (isHidden ? ' is-hidden' : '');
    row.dataset.entity = entityId;

    const header = document.createElement('div');
    header.className = 'entity-row-header';

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.title = 'Drag to reorder';
    handle.innerHTML = '<span class="drag-dots">⠿</span>';
    header.appendChild(handle);

    const left = document.createElement('div');
    left.className = 'entity-row-left';

    const previewIcon = document.createElement('ha-icon');
    previewIcon.setAttribute('icon', displayIcon);
    previewIcon.className = 'entity-preview-icon' + (isHidden ? ' faded' : '');
    left.appendChild(previewIcon);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'entity-row-name' + (isHidden ? ' faded' : '');
    nameSpan.textContent = displayName;
    left.appendChild(nameSpan);

    const domainBadge = document.createElement('span');
    domainBadge.className = 'domain-badge';
    domainBadge.textContent = domain;
    left.appendChild(domainBadge);

    if (isHidden) {
      const hiddenBadge = document.createElement('span');
      hiddenBadge.className = 'hidden-badge';
      hiddenBadge.textContent = 'hidden';
      left.appendChild(hiddenBadge);
    }

    header.appendChild(left);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const hideBtn = document.createElement('button');
    hideBtn.className = 'hide-btn';
    hideBtn.title = isHidden ? 'Show' : 'Hide';
    const hideIcon = document.createElement('ha-icon');
    hideIcon.setAttribute('icon', isHidden ? 'mdi:eye-off' : 'mdi:eye');
    hideBtn.appendChild(hideIcon);
    hideBtn.addEventListener('click', e => { e.stopPropagation(); this._toggleHidden(entityId); });
    actions.appendChild(hideBtn);

    const expandBtn = document.createElement('button');
    expandBtn.className = 'expand-btn';
    expandBtn.textContent = isExpanded ? '▲' : '▼';
    expandBtn.addEventListener('click', e => { e.stopPropagation(); this._toggleExpand(entityId); });
    actions.appendChild(expandBtn);

    header.appendChild(actions);
    row.appendChild(header);

    if (isExpanded) {
      const panel = document.createElement('div');
      panel.className = 'entity-edit-panel';

      const nameField = document.createElement('div');
      nameField.className = 'edit-field';
      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'Name';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'name-input';
      nameInput.placeholder = defaultName;
      nameInput.value = overrides[entityId]?.name || '';
      nameInput.autocomplete = 'off';
      nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { this._updateOverride(entityId, 'name', e.target.value.trim()); e.target.blur(); }
      });
      nameInput.addEventListener('blur', e => {
        this._updateOverride(entityId, 'name', e.target.value.trim());
      });
      nameField.appendChild(nameLabel);
      nameField.appendChild(nameInput);
      panel.appendChild(nameField);

      const iconField = document.createElement('div');
      iconField.className = 'edit-field';
      const iconLabel = document.createElement('label');
      iconLabel.textContent = 'Icon';
      const iconPicker = document.createElement('ha-icon-picker');
      iconPicker.className = 'icon-picker';
      iconPicker.value = overrides[entityId]?.icon || '';
      iconPicker.placeholder = 'mdi:lightbulb';
      iconPicker.addEventListener('value-changed', e => {
        e.stopPropagation();
        this._updateOverride(entityId, 'icon', e.detail.value || '');
        setTimeout(() => this._renderEntitiesSection(), 50);
      });
      iconField.appendChild(iconLabel);
      iconField.appendChild(iconPicker);
      panel.appendChild(iconField);

      if (domain === 'light') {
        const colorToggleField = document.createElement('div');
        colorToggleField.className = 'edit-field';

        const toggleLabelRow = document.createElement('label');
        toggleLabelRow.className = 'toggle-row';

        const colorCheckbox = document.createElement('input');
        colorCheckbox.type = 'checkbox';
        colorCheckbox.checked = overrides[entityId]?.use_light_color || false;
        colorCheckbox.addEventListener('change', e => {
          this._updateOverride(entityId, 'use_light_color', e.target.checked);
        });

        const toggleText = document.createElement('span');
        toggleText.textContent = 'Use actual light color';

        toggleLabelRow.appendChild(colorCheckbox);
        toggleLabelRow.appendChild(toggleText);
        colorToggleField.appendChild(toggleLabelRow);

        panel.appendChild(colorToggleField);
      }

      row.appendChild(panel);
    }

    container.appendChild(row);
  }

  _attachDragHandlers(container, entities) {
    const rows = container.querySelectorAll('.entity-row');
    rows.forEach(row => {
      const handle = row.querySelector('.drag-handle');
      handle.addEventListener('mousedown', () => row.setAttribute('draggable', 'true'));

      row.addEventListener('dragstart', e => {
        this._dragSrc = row.dataset.entity;
        this._dragOrder = entities.slice();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.entity);
        setTimeout(() => row.classList.add('dragging'), 0);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        container.querySelectorAll('.entity-row').forEach(r => r.classList.remove('drag-over'));
        this._dragSrc = null;
      });

      row.addEventListener('dragover', e => {
        e.preventDefault();
        if (row.dataset.entity === this._dragSrc) return;
        container.querySelectorAll('.entity-row').forEach(r => r.classList.remove('drag-over'));
        row.classList.add('drag-over');
      });

      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));

      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (!this._dragSrc || row.dataset.entity === this._dragSrc) return;
        const order = this._dragOrder ? this._dragOrder.slice() : entities.slice();
        const fromIdx = order.indexOf(this._dragSrc);
        const toIdx = order.indexOf(row.dataset.entity);
        if (fromIdx === -1 || toIdx === -1) return;
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, this._dragSrc);
        this._fire({ ...this._config, entity_order: order });
        setTimeout(() => this._renderEntitiesSection(), 50);
      });
    });
  }

  _makeColorRow(pickerId, textId, label, currentValue, configKey) {
    const section = document.createElement('div');

    const lbl = document.createElement('div');
    lbl.className = 'section-label';
    lbl.style.marginBottom = '4px';
    lbl.textContent = label;
    section.appendChild(lbl);

    const row = document.createElement('div');
    row.className = 'color-row';

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.id = pickerId;
    picker.value = this._cssToHex(currentValue);

    const text = document.createElement('input');
    text.type = 'text';
    text.id = textId;
    text.value = currentValue;

    picker.addEventListener('input', e => {
      text.value = e.target.value;
      this._fire({ ...this._config, [configKey]: e.target.value });
    });
    text.addEventListener('blur', e => {
      this._fire({ ...this._config, [configKey]: e.target.value });
    });

    row.appendChild(picker);
    row.appendChild(text);
    section.appendChild(row);
    return section;
  }

  _fullRender() {
    if (!this.shadowRoot) return;
    this._initialized = true;

    this.shadowRoot.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      :host { display: block; }
      .editor { padding:8px 0; font-family:var(--primary-font-family,sans-serif); color:var(--primary-text-color); }
      .section { margin-bottom:20px; }
      .section-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; color:var(--secondary-text-color); margin-bottom:8px; }
      select, input[type="text"], input[type="number"] { width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--divider-color); background:var(--card-background-color); color:var(--primary-text-color); font-size:14px; font-family:inherit; }
      select { cursor:pointer; }
      select:focus, input:focus { outline:2px solid var(--primary-color); outline-offset:-1px; }
      .color-row { display:flex; gap:8px; align-items:center; }
      .color-row input[type="color"] { width:44px; height:36px; padding:2px; border-radius:8px; border:1px solid var(--divider-color); background:var(--card-background-color); cursor:pointer; flex-shrink:0; }
      .color-row input[type="text"] { flex:1; }
      .two-col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .entity-row { border:1px solid var(--divider-color); border-radius:10px; margin-bottom:8px; overflow:hidden; background:var(--card-background-color); }
      .entity-row.is-hidden { opacity:0.45; }
      .entity-row.dragging { opacity:0.35; border-style:dashed; }
      .entity-row.drag-over { border-color:var(--primary-color); box-shadow:0 0 0 2px var(--primary-color); }
      .entity-row-header { display:flex; align-items:center; padding:10px 12px; gap:8px; }
      .entity-row-left { display:flex; align-items:center; gap:8px; flex:1; min-width:0; }
      .entity-row-name { font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .entity-row-name.faded { color:var(--secondary-text-color); }
      .entity-preview-icon { --mdc-icon-size:18px; color:var(--secondary-text-color); flex-shrink:0; }
      .entity-preview-icon.faded { opacity:0.4; }
      .domain-badge { font-size:10px; background:rgba(255,255,255,0.08); border-radius:4px; padding:1px 5px; color:var(--secondary-text-color); flex-shrink:0; }
      .hidden-badge { font-size:10px; background:rgba(255,255,255,0.1); border-radius:4px; padding:1px 5px; color:var(--secondary-text-color); flex-shrink:0; }
      .drag-handle { cursor:grab; flex-shrink:0; padding:4px 6px 4px 2px; color:var(--secondary-text-color); display:flex; align-items:center; user-select:none; }
      .drag-handle:active { cursor:grabbing; }
      .drag-dots { font-size:16px; line-height:1; letter-spacing:-1px; }
      .row-actions { display:flex; align-items:center; gap:4px; flex-shrink:0; }
      .hide-btn, .expand-btn { background:none; border:1px solid var(--divider-color); border-radius:6px; color:var(--secondary-text-color); cursor:pointer; padding:3px 7px; font-family:inherit; display:flex; align-items:center; }
      .hide-btn { --mdc-icon-size:16px; }
      .hide-btn:hover, .expand-btn:hover { background:var(--divider-color); color:var(--primary-text-color); }
      .expand-btn { font-size:11px; }
      .entity-edit-panel { padding:12px; background:rgba(0,0,0,0.12); border-top:1px solid var(--divider-color); display:flex; flex-direction:column; gap:12px; }
      .edit-field label { display:block; font-size:11px; color:var(--secondary-text-color); margin-bottom:5px; }
      .icon-picker { display:block; width:100%; }
      .toggle-row { display:flex; align-items:center; gap:10px; cursor:pointer; font-size:14px; color:var(--primary-text-color); }
      .toggle-row input[type="checkbox"] { width:18px; height:18px; cursor:pointer; accent-color:var(--primary-color); }
    `;
    this.shadowRoot.appendChild(style);

    const editor = document.createElement('div');
    editor.className = 'editor';
    this.shadowRoot.appendChild(editor);

    const areaSection = document.createElement('div');
    areaSection.className = 'section';
    const areaLabel = document.createElement('div');
    areaLabel.className = 'section-label';
    areaLabel.textContent = 'Area';
    const areaSelect = document.createElement('select');
    areaSelect.id = 'area-select';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— select an area —';
    areaSelect.appendChild(placeholder);
    this._getAreas().forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.area_id;
      opt.textContent = a.name;
      opt.selected = a.area_id === (this._config.area || '');
      areaSelect.appendChild(opt);
    });
    areaSelect.addEventListener('change', e => {
      this._expandedEntity = null;
      this._fire({ ...this._config, area: e.target.value, entity_order: [] });
      setTimeout(() => this._renderEntitiesSection(), 50);
    });
    areaSection.appendChild(areaLabel);
    areaSection.appendChild(areaSelect);
    editor.appendChild(areaSection);

    const colSection = document.createElement('div');
    colSection.className = 'section';
    const colLabel = document.createElement('div');
    colLabel.className = 'section-label';
    colLabel.textContent = 'Columns';
    const colInput = document.createElement('input');
    colInput.type = 'number';
    colInput.value = this._config.columns || 1;
    colInput.min = 1;
    colInput.max = 4;
    colInput.addEventListener('change', e => {
      this._fire({ ...this._config, columns: parseInt(e.target.value) });
    });
    colSection.appendChild(colLabel);
    colSection.appendChild(colInput);
    editor.appendChild(colSection);

    const tileColSection = document.createElement('div');
    tileColSection.className = 'section';
    const tileColLabel = document.createElement('div');
    tileColLabel.className = 'section-label';
    tileColLabel.textContent = 'Tile colours';
    const twoCol = document.createElement('div');
    twoCol.className = 'two-col';
    twoCol.appendChild(this._makeColorRow('tile-color-picker', 'tile-color-text', 'Card background', this._config.tile_color || 'var(--card-background-color)', 'tile_color'));
    tileColSection.appendChild(tileColLabel);
    tileColSection.appendChild(twoCol);
    editor.appendChild(tileColSection);

    const iconColSection = document.createElement('div');
    iconColSection.className = 'section';
    const iconColLabel = document.createElement('div');
    iconColLabel.className = 'section-label';
    iconColLabel.textContent = 'Icon colour when on';
    iconColSection.appendChild(iconColLabel);
    iconColSection.appendChild(this._makeColorRow('icon-color-on-picker', 'icon-color-on-text', '', this._config.icon_color_on || 'var(--primary-color)', 'icon_color_on').querySelector('.color-row'));
    editor.appendChild(iconColSection);

    const brSection = document.createElement('div');
    brSection.className = 'section';
    const brLabel = document.createElement('div');
    brLabel.className = 'section-label';
    brLabel.textContent = 'Border radius';
    const brInput = document.createElement('input');
    brInput.type = 'text';
    brInput.value = this._config.border_radius || '28px';
    brInput.placeholder = 'e.g. 28px or 8px';
    brInput.addEventListener('blur', e => this._fire({ ...this._config, border_radius: e.target.value }));
    brSection.appendChild(brLabel);
    brSection.appendChild(brInput);
    editor.appendChild(brSection);

    const entSection = document.createElement('div');
    entSection.className = 'section';
    entSection.id = 'entities-section';
    editor.appendChild(entSection);

    this._renderEntitiesSection();
  }
}

customElements.define('ywd-area-lights-card', YWDAreaLightsCard);
customElements.define('ywd-area-lights-card-editor', YWDAreaLightsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ywd-area-lights-card',
  name: 'YWD Area Lights Card',
  description: 'Pro-grade area lighting card with pure CSS Variable styling logic to prevent variable parsing errors.',
});
