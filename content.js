(function() {
  if (document.getElementById('capricm-container')) return;

  const API_URL = 'https://script.google.com/macros/s/AKfycbx7PCVb44s-WikxsAh3RyBBniTffzYMJSsmVXP057pswZaMaCU96bqKeV8GFxlfcueY/exec';
  
  // Firebase - INSTANT writes!
  const FIREBASE_URL = 'https://capricm-chat-default-rtdb.firebaseio.com';

  // State
  let isSubmitting = false;
  let queueExpanded = false;
  let queueData = {};
  
  // SNIPER MODE STATE
  let sniperMode = false;
  let sniperCount = 0;
  let lastAddedAPN = null;
  let sniperObserver = null;

  // WARM UP backend
  fetch(API_URL + '?ping=1').catch(() => {});

  const container = document.createElement('div');
  container.id = 'capricm-container';
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const btnStyle = `
    padding: 10px 16px;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
  `;

  // ==================== SNIPER MODE BUTTON ====================
  const sniperBtn = document.createElement('button');
  sniperBtn.innerHTML = '🎯 Sniper Mode';
  sniperBtn.style.cssText = btnStyle + `
    background: linear-gradient(135deg, #ff1744, #d50000);
    position: relative;
  `;

  const sniperBadge = document.createElement('span');
  sniperBadge.id = 'sniper-badge';
  sniperBadge.style.cssText = `
    position: absolute;
    top: -6px;
    right: -6px;
    background: #00e676;
    color: #000;
    font-size: 11px;
    font-weight: 700;
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    box-shadow: 0 2px 8px rgba(0,230,118,0.5);
  `;
  sniperBtn.appendChild(sniperBadge);

  sniperBtn.addEventListener('mouseenter', () => {
    if (!sniperMode) {
      sniperBtn.style.transform = 'translateY(-2px)';
      sniperBtn.style.boxShadow = '0 6px 20px rgba(255, 23, 68, 0.4)';
    }
  });
  sniperBtn.addEventListener('mouseleave', () => {
    if (!sniperMode) {
      sniperBtn.style.transform = 'translateY(0)';
      sniperBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    }
  });

  // Status dropdown
  const statusSelect = document.createElement('select');
  statusSelect.style.cssText = `
    padding: 10px 12px;
    border: 2px solid transparent;
    border-radius: 12px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    width: 204px;
    background: rgba(255,255,255,0.95);
    color: #333;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    outline: none;
    cursor: pointer;
  `;
  
  const statusOptions = [
    { value: '', label: '📋 Select status (optional)' },
    { value: 'RE Investment Group Owned', label: '🏢 RE Investment Group Owned' },
    { value: 'Large Company Owned (NOT A SELLER)', label: '🏭 Large Company Owned (NOT A SELLER)' },
    { value: 'LOW QUALITY - not a fit', label: '👎 LOW QUALITY - not a fit' },
    { value: 'TOO SMALL - not a fit', label: '📏 TOO SMALL - not a fit' },
    { value: 'Building Not a Fit', label: '🏚️ Building Not a Fit' },
    { value: 'Not a Fit', label: '❌ Not a Fit' }
  ];
  
  statusOptions.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    statusSelect.appendChild(option);
  });

  statusSelect.addEventListener('focus', () => statusSelect.style.border = '2px solid #00d4aa');
  statusSelect.addEventListener('blur', () => statusSelect.style.border = '2px solid transparent');

  // Notes input
  const notesInput = document.createElement('textarea');
  notesInput.placeholder = '📝 Add note...';
  notesInput.style.cssText = `
    padding: 10px 12px;
    border: 2px solid transparent;
    border-radius: 12px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    resize: none;
    height: 50px;
    width: 180px;
    background: rgba(255,255,255,0.95);
    color: #333;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    outline: none;
  `;
  notesInput.addEventListener('focus', () => notesInput.style.border = '2px solid #00d4aa');
  notesInput.addEventListener('blur', () => notesInput.style.border = '2px solid transparent');

  // ADD TO CAPRICM BUTTON with badge container
  const addBtnWrapper = document.createElement('div');
  addBtnWrapper.style.cssText = 'position: relative; width: 100%;';
  
  const addBtn = document.createElement('button');
  addBtn.innerHTML = '🏢 Add to CapriCM';
  addBtn.style.cssText = btnStyle + `background: linear-gradient(135deg, #00d4aa, #00a885);`;

  const queueBadge = document.createElement('span');
  queueBadge.id = 'queue-badge';
  queueBadge.style.cssText = `
    position: absolute;
    top: -6px;
    right: -6px;
    background: #ff5252;
    color: white;
    font-size: 11px;
    font-weight: 700;
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    box-shadow: 0 2px 8px rgba(255,82,82,0.5);
  `;
  
  addBtnWrapper.appendChild(addBtn);
  addBtnWrapper.appendChild(queueBadge);

  addBtn.addEventListener('mouseenter', () => {
    addBtn.style.transform = 'translateY(-2px)';
    addBtn.style.boxShadow = '0 6px 20px rgba(0, 212, 170, 0.4)';
  });
  addBtn.addEventListener('mouseleave', () => {
    addBtn.style.transform = 'translateY(0)';
    addBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
  });

  // QUEUE PANEL (expandable)
  const queuePanel = document.createElement('div');
  queuePanel.id = 'queue-panel';
  queuePanel.style.cssText = `
    background: rgba(30, 30, 30, 0.98);
    border: 1px solid #333;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  `;

  const queueHeader = document.createElement('div');
  queueHeader.style.cssText = `
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    background: rgba(40, 40, 40, 0.95);
    border-bottom: 1px solid #333;
  `;
  queueHeader.innerHTML = `
    <span style="font-size: 13px; font-weight: 600; color: #fff;">📦 Queue (<span id="queue-count">0</span>)</span>
    <span id="queue-arrow" style="font-size: 12px; color: #888; transition: transform 0.2s;">▼</span>
  `;

  const queueBody = document.createElement('div');
  queueBody.id = 'queue-body';
  queueBody.style.cssText = `
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
    background: rgba(25, 25, 25, 0.95);
  `;

  const queueList = document.createElement('div');
  queueList.id = 'queue-list';
  queueList.style.cssText = `
    max-height: 180px;
    overflow-y: auto;
    padding: 8px;
  `;

  // Buttons container
  const queueBtnsContainer = document.createElement('div');
  queueBtnsContainer.style.cssText = `
    display: flex;
    gap: 6px;
    padding: 8px;
  `;

  const syncBtn = document.createElement('button');
  syncBtn.innerHTML = '🔄 Sync';
  syncBtn.style.cssText = `
    flex: 1;
    padding: 10px;
    background: linear-gradient(135deg, #4285f4, #1a73e8);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  `;
  syncBtn.addEventListener('mouseenter', () => {
    syncBtn.style.transform = 'translateY(-1px)';
    syncBtn.style.boxShadow = '0 4px 15px rgba(66, 133, 244, 0.4)';
  });
  syncBtn.addEventListener('mouseleave', () => {
    syncBtn.style.transform = 'translateY(0)';
    syncBtn.style.boxShadow = 'none';
  });

  const clearAllBtn = document.createElement('button');
  clearAllBtn.innerHTML = '🗑️ Clear All';
  clearAllBtn.style.cssText = `
    flex: 1;
    padding: 10px;
    background: linear-gradient(135deg, #ff5252, #d32f2f);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  `;
  clearAllBtn.addEventListener('mouseenter', () => {
    clearAllBtn.style.transform = 'translateY(-1px)';
    clearAllBtn.style.boxShadow = '0 4px 15px rgba(255, 82, 82, 0.4)';
  });
  clearAllBtn.addEventListener('mouseleave', () => {
    clearAllBtn.style.transform = 'translateY(0)';
    clearAllBtn.style.boxShadow = 'none';
  });

  queueBtnsContainer.appendChild(syncBtn);
  queueBtnsContainer.appendChild(clearAllBtn);

  queueBody.appendChild(queueList);
  queueBody.appendChild(queueBtnsContainer);
  queuePanel.appendChild(queueHeader);
  queuePanel.appendChild(queueBody);

  // Toggle queue expand
  queueHeader.addEventListener('click', () => {
    queueExpanded = !queueExpanded;
    const arrow = document.getElementById('queue-arrow');
    if (queueExpanded) {
      queueBody.style.maxHeight = '250px';
      arrow.style.transform = 'rotate(180deg)';
      loadQueuePreview();
    } else {
      queueBody.style.maxHeight = '0';
      arrow.style.transform = 'rotate(0deg)';
    }
  });

  // GOOGLE MAPS BUTTON (zeleno)
  const mapsBtn = document.createElement('button');
  mapsBtn.innerHTML = '🗺️ Google Maps';
  mapsBtn.style.cssText = btnStyle + `
    background: linear-gradient(135deg, #00e676, #00c853);
    color: #0a0a0a;
  `;

  mapsBtn.addEventListener('mouseenter', () => {
    mapsBtn.style.transform = 'translateY(-2px)';
    mapsBtn.style.boxShadow = '0 6px 20px rgba(0, 230, 118, 0.4)';
  });
  mapsBtn.addEventListener('mouseleave', () => {
    mapsBtn.style.transform = 'translateY(0)';
    mapsBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
  });

  // GOOGLE EARTH BUTTON (svetlo plavo)
  const earthBtn = document.createElement('button');
  earthBtn.innerHTML = '🌍 Google Earth';
  earthBtn.style.cssText = btnStyle + `
    background: linear-gradient(135deg, #4fc3f7, #29b6f6);
    color: #0a0a0a;
  `;

  earthBtn.addEventListener('mouseenter', () => {
    earthBtn.style.transform = 'translateY(-2px)';
    earthBtn.style.boxShadow = '0 6px 20px rgba(79, 195, 247, 0.4)';
  });
  earthBtn.addEventListener('mouseleave', () => {
    earthBtn.style.transform = 'translateY(0)';
    earthBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
  });

  // CHECK APN BUTTON (narandžasto)
  const apnBtn = document.createElement('button');
  apnBtn.innerHTML = '🔎 Check APN';
  apnBtn.style.cssText = btnStyle + `background: linear-gradient(135deg, #ff9800, #f57c00);`;

  apnBtn.addEventListener('mouseenter', () => {
    apnBtn.style.transform = 'translateY(-2px)';
    apnBtn.style.boxShadow = '0 6px 20px rgba(255, 152, 0, 0.4)';
  });
  apnBtn.addEventListener('mouseleave', () => {
    apnBtn.style.transform = 'translateY(0)';
    apnBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
  });

  // OWNER LOOKUP BUTTON (ljubičasto) - now with LinkedIn
  const ownerBtn = document.createElement('button');
  ownerBtn.innerHTML = '🔍 Owner Lookup';
  ownerBtn.title = 'Google + LinkedIn (for companies)';
  ownerBtn.style.cssText = btnStyle + `background: linear-gradient(135deg, #9c27b0, #7b1fa2);`;

  ownerBtn.addEventListener('mouseenter', () => {
    ownerBtn.style.transform = 'translateY(-2px)';
    ownerBtn.style.boxShadow = '0 6px 20px rgba(156, 39, 176, 0.4)';
  });
  ownerBtn.addEventListener('mouseleave', () => {
    ownerBtn.style.transform = 'translateY(0)';
    ownerBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
  });

  // ==================== HELPER FUNCTIONS ====================
  
  function getAPN() {
    const text = document.body.innerText;
    const match = text.match(/Parcel ID\s+([\w-]+)/);
    return match ? match[1].trim() : null;
  }

  function buildPlainText() {
    const text = document.body.innerText;
    
    const get = (pattern) => {
      const m = text.match(pattern);
      return m ? m[1].trim() : '';
    };

    const fullAddr = get(/Full Address\s+([\s\S]*?)(?=\nMeasurements|\nOwner)/);
    const mailing = get(/Mailing Address\s+([\s\S]*?)(?=Property Sales)/)?.replace(/\n/g, ' ').trim() || '';
    
    return [
      'Parcel ID ' + get(/Parcel ID\s+([\w-]+)/),
      'Parcel Address ' + get(/Parcel Address\s+([^\n]+)/),
      'Parcel Address City ' + get(/Parcel Address City\s+([^\n]+)/),
      'Parcel Address Zip Code ' + get(/Parcel Address Zip Code\s+(\d+)/),
      'Full Address ' + fullAddr,
      'Owner Name (Assessor) ' + get(/Owner Name \(Assessor\)\s+([^\n]+)/),
      'Mailing Address ' + mailing + ' Property Sales & Value',
      'Measurements ' + get(/Measurements\s+([\d.]+)/),
      'Zoning Code ' + get(/Zoning Code\s+([^\n]+)/),
      'Latitude ' + get(/Latitude\s+([\d.-]+)/),
      'Longitude ' + get(/Longitude\s+([\d.-]+)/),
      'Last Sale Date ' + get(/Last Sale Date\s+([\d-]+)/),
      'Last Sale Price ' + get(/Last Sale Price\s+([^\n]+)/)
    ].join('\n');
  }

  function getCoordinates() {
    const text = document.body.innerText;
    const lat = text.match(/Latitude\s+([\d.-]+)/);
    const lng = text.match(/Longitude\s+([\d.-]+)/);
    return (lat && lng) ? { lat: lat[1], lng: lng[1] } : null;
  }

  // ==================== SNIPER MODE FUNCTIONS ====================
  
  function toggleSniperMode() {
    sniperMode = !sniperMode;
    
    if (sniperMode) {
      // ACTIVATE SNIPER MODE
      sniperCount = 0;
      
      // IMPORTANT: Set lastAddedAPN to current parcel so we ignore it
      // We only want to capture NEW clicks, not the already-selected parcel
      lastAddedAPN = getAPN();
      
      updateSniperBadge();
      
      sniperBtn.innerHTML = '🎯 SNIPER ON';
      sniperBtn.style.background = 'linear-gradient(135deg, #00e676, #00c853)';
      sniperBtn.style.animation = 'pulse-sniper 1s ease-in-out infinite';
      sniperBtn.style.boxShadow = '0 0 20px rgba(0, 230, 118, 0.6)';
      sniperBtn.appendChild(sniperBadge);
      
      // Add pulsing border to container
      container.style.boxShadow = '0 0 30px rgba(0, 230, 118, 0.4)';
      
      // Start watching for parcel panel changes
      startSniperObserver();
      
      showNotification('🎯 SNIPER MODE ON - Click parcels to auto-add!', 'success');
      playSound('activate');
      
    } else {
      // DEACTIVATE SNIPER MODE
      sniperBtn.innerHTML = '🎯 Sniper Mode';
      sniperBtn.style.background = 'linear-gradient(135deg, #ff1744, #d50000)';
      sniperBtn.style.animation = 'none';
      sniperBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
      sniperBadge.style.display = 'none';
      
      container.style.boxShadow = 'none';
      
      // Stop watching
      stopSniperObserver();
      
      showNotification(`🎯 SNIPER OFF - Added ${sniperCount} parcels!`, 'info');
      playSound('deactivate');
    }
  }
  
  function updateSniperBadge() {
    if (sniperCount > 0) {
      sniperBadge.textContent = sniperCount;
      sniperBadge.style.display = 'flex';
    } else {
      sniperBadge.style.display = 'none';
    }
  }
  
  function startSniperObserver() {
    // Watch for Property Details panel content changes
    sniperObserver = new MutationObserver((mutations) => {
      if (!sniperMode) return;
      
      // Check if a parcel is loaded (look for "Property Details" or "Parcel ID")
      const apn = getAPN();
      
      if (apn && apn !== lastAddedAPN) {
        // New parcel detected - auto add!
        sniperAutoAdd(apn);
      }
    });
    
    // Observe the entire body for changes (Regrid loads content dynamically)
    sniperObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  function stopSniperObserver() {
    if (sniperObserver) {
      sniperObserver.disconnect();
      sniperObserver = null;
    }
    lastAddedAPN = null;
  }
  
  async function sniperAutoAdd(apn) {
    // Debounce - prevent multiple adds of same parcel
    if (lastAddedAPN === apn) return;
    lastAddedAPN = apn;
    
    try {
      const plainText = buildPlainText();
      
      // Use APN as key (sanitized for Firebase) - PREVENTS DUPLICATES!
      const firebaseKey = apn.replace(/[.#$/\[\]]/g, '_');
      
      const data = {
        plainText: plainText,
        notes: 'Sniper Mode',
        status: statusSelect.value || '',
        apn: apn,
        timestamp: Date.now(),
        processed: false
      };
      
      const response = await fetch(`${FIREBASE_URL}/regrid_queue/${firebaseKey}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        sniperCount++;
        updateSniperBadge();
        await loadQueueCount();
        
        // Visual feedback
        flashScreen();
        playSound('add');
        
        // Quick notification
        showSniperNotification(`+1 🎯 ${apn.substring(0, 15)}...`);
      }
    } catch (err) {
      console.log('Sniper add error:', err);
    }
  }
  
  function flashScreen() {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 230, 118, 0.15);
      pointer-events: none;
      z-index: 999998;
      animation: flash-fade 0.3s ease-out forwards;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
  }
  
  function showSniperNotification(msg) {
    const existing = document.getElementById('sniper-notification');
    if (existing) existing.remove();
    
    const n = document.createElement('div');
    n.id = 'sniper-notification';
    n.textContent = msg;
    n.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      padding: 10px 20px;
      background: linear-gradient(135deg, #00e676, #00c853);
      color: #000;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(0, 230, 118, 0.5);
      animation: slide-in 0.2s ease-out;
    `;
    document.body.appendChild(n);
    setTimeout(() => {
      n.style.animation = 'slide-out 0.2s ease-in forwards';
      setTimeout(() => n.remove(), 200);
    }, 1000);
  }
  
  function playSound(type) {
    // Create audio context for sounds
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'activate') {
        oscillator.frequency.value = 880;
        gain.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
      } else if (type === 'deactivate') {
        oscillator.frequency.value = 440;
        gain.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.15);
      } else if (type === 'add') {
        oscillator.frequency.value = 1200;
        gain.gain.value = 0.05;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      // Audio not supported, ignore
    }
  }

  // ==================== QUEUE FUNCTIONS ====================

  async function loadQueueCount() {
    try {
      const response = await fetch(`${FIREBASE_URL}/regrid_queue.json`);
      const data = await response.json();
      queueData = data || {};
      
      const count = Object.keys(queueData).filter(k => !queueData[k].processed).length;
      
      // Update badge
      if (count > 0) {
        queueBadge.textContent = count;
        queueBadge.style.display = 'flex';
      } else {
        queueBadge.style.display = 'none';
      }
      
      // Update panel count
      const countEl = document.getElementById('queue-count');
      if (countEl) countEl.textContent = count;
      
      return count;
    } catch (err) {
      console.log('Queue check failed:', err);
      return 0;
    }
  }

  async function loadQueuePreview() {
    await loadQueueCount();
    const list = document.getElementById('queue-list');
    
    const pending = Object.entries(queueData).filter(([k, v]) => !v.processed);
    
    if (pending.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:#666;font-size:12px;padding:20px;">Queue is empty</div>';
      return;
    }
    
    let html = '';
    pending.forEach(([key, item]) => {
      // Extract APN from plainText
      let apn = item.apn || '';
      let address = '';
      
      if (item.plainText) {
        const apnMatch = item.plainText.match(/Parcel ID\s+([\w-]+)/);
        if (apnMatch) apn = apnMatch[1];
        
        const addrMatch = item.plainText.match(/Parcel Address\s+([^\n]+)/);
        if (addrMatch) address = addrMatch[1].trim();
      }
      
      // Format status (shorter version)
      let statusShort = '';
      if (item.status) {
        if (item.status.includes('Investment')) statusShort = 'RE Invest';
        else if (item.status.includes('Large Company')) statusShort = 'Large Co';
        else if (item.status.includes('LOW QUALITY')) statusShort = 'Low Qual';
        else if (item.status.includes('TOO SMALL')) statusShort = 'Too Small';
        else if (item.status.includes('Building')) statusShort = 'Bldg N/F';
        else if (item.status.includes('Not a Fit')) statusShort = 'Not Fit';
        else statusShort = item.status.substring(0, 10);
      }
      
      // Check if added by sniper
      const isSniper = item.notes === 'Sniper Mode';
      
      // Format time
      const time = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
      
      html += `
        <div style="
          padding: 8px 10px;
          margin-bottom: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          font-size: 11px;
          border-left: 3px solid ${isSniper ? '#00e676' : (item.status ? '#00d4aa' : '#666')};
          position: relative;
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="color:${isSniper ? '#00e676' : '#00d4aa'};font-weight:700;font-size:10px;">
              ${isSniper ? '🎯 ' : ''}${apn || 'No APN'}
            </span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="color:#666;font-size:9px;">${time}</span>
              <span 
                class="queue-delete-btn"
                data-key="${key}"
                style="
                  color:#ff5252;
                  font-size:14px;
                  cursor:pointer;
                  padding:2px 6px;
                  border-radius:4px;
                  transition:background 0.2s;
                "
                title="Remove from queue"
              >✕</span>
            </div>
          </div>
          <div style="color:#fff;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:20px;">
            ${address || 'No address'}
          </div>
          <div style="color:#888;font-size:10px;margin-top:2px;">
            ${statusShort || '—'}
          </div>
        </div>
      `;
    });
    
    list.innerHTML = html;
    
    // Attach delete handlers
    list.querySelectorAll('.queue-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const key = btn.getAttribute('data-key');
        await deleteQueueItem(key);
      });
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,82,82,0.2)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    });
  }

  // Delete single item from queue
  async function deleteQueueItem(key) {
    try {
      const response = await fetch(`${FIREBASE_URL}/regrid_queue/${key}.json`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        showNotification('🗑️ Removed from queue', 'info');
        await loadQueueCount();
        await loadQueuePreview();
      } else {
        throw new Error('Delete failed');
      }
    } catch (err) {
      showNotification('❌ ' + err.message, 'error');
    }
  }

  async function syncToSheet() {
    const pending = Object.entries(queueData).filter(([k, v]) => !v.processed);
    
    if (pending.length === 0) {
      showNotification('📦 Queue is empty!', 'info');
      return;
    }
    
    syncBtn.disabled = true;
    syncBtn.innerHTML = '⏳ Syncing...';
    
    try {
      const response = await fetch(`${API_URL}?action=processRegridQueue`);
      const result = await response.json();
      
      if (result.success) {
        showNotification(`✅ Synced ${result.processed} parcels!`, 'success');
        
        // Reset sniper count after successful sync
        sniperCount = 0;
        updateSniperBadge();
        
        await loadQueueCount();
        await loadQueuePreview();
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (err) {
      showNotification('❌ ' + err.message, 'error');
    }
    
    syncBtn.disabled = false;
    syncBtn.innerHTML = '🔄 Sync to Sheet';
  }

  syncBtn.addEventListener('click', syncToSheet);
  clearAllBtn.addEventListener('click', clearAllQueue);

  // Clear entire queue
  async function clearAllQueue() {
    const pending = Object.entries(queueData).filter(([k, v]) => !v.processed);
    
    if (pending.length === 0) {
      showNotification('📦 Queue is already empty!', 'info');
      return;
    }
    
    if (!confirm(`Clear ALL ${pending.length} parcels from queue?`)) {
      return;
    }
    
    clearAllBtn.disabled = true;
    clearAllBtn.innerHTML = '⏳ Clearing...';
    
    try {
      // Delete entire regrid_queue node
      const response = await fetch(`${FIREBASE_URL}/regrid_queue.json`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        showNotification(`🗑️ Cleared ${pending.length} parcels!`, 'success');
        queueData = {};
        
        // Reset sniper count after clear
        sniperCount = 0;
        updateSniperBadge();
        
        await loadQueueCount();
        await loadQueuePreview();
      } else {
        throw new Error('Clear failed');
      }
    } catch (err) {
      showNotification('❌ ' + err.message, 'error');
    }
    
    clearAllBtn.disabled = false;
    clearAllBtn.innerHTML = '🗑️ Clear All';
  }

  // ==================== OWNER LOOKUP ====================

  function lookupOwner() {
    const text = document.body.innerText;
    
    // Get Owner Name
    let ownerName = '';
    const ownerMatch = text.match(/Owner Name \(Assessor\)\s+([^\n]+)/);
    if (ownerMatch) {
      ownerName = ownerMatch[1].trim();
    }
    
    // Get Mailing Address
    let mailingAddress = '';
    const mailingMatch = text.match(/Mailing Address\s+([\s\S]*?)(?=Property Sales)/);
    if (mailingMatch) {
      mailingAddress = mailingMatch[1].replace(/\n/g, ', ').trim();
    }
    
    if (!mailingAddress && !ownerName) {
      mailingAddress = prompt('Could not find Mailing Address automatically.\n\nPlease paste the Mailing Address:');
      if (!mailingAddress) return;
    }
    
    mailingAddress = mailingAddress.replace(/\s+/g, ' ').trim();
    
    // Check if owner is a company (not individual)
    const companyIndicators = [
      'LLC', 'L.L.C.', 'INC', 'INCORPORATED', 'CORP', 'CORPORATION', 
      'LP', 'L.P.', 'LLP', 'L.L.P.', 'TRUST', 'TRUSTEE', 
      'CO', 'COMPANY', 'HOLDINGS', 'PARTNERS', 'PARTNERSHIP',
      'ENTERPRISES', 'PROPERTIES', 'INVESTMENTS', 'CAPITAL',
      'GROUP', 'ASSOCIATES', 'MANAGEMENT', 'DEVELOPMENT',
      'REAL ESTATE', 'REALTY', 'ASSET', 'EQUITY', 'FUND',
      'VENTURES', 'SOLUTIONS', 'SERVICES', 'LIMITED'
    ];
    
    const ownerUpper = ownerName.toUpperCase();
    const isCompany = companyIndicators.some(indicator => ownerUpper.includes(indicator));
    
    // Open Google search with mailing address
    if (mailingAddress) {
      const googleQuery = encodeURIComponent(mailingAddress);
      window.open(`https://www.google.com/search?q=${googleQuery}`, '_blank');
    }
    
    // If company, also open LinkedIn search
    if (isCompany && ownerName) {
      // Clean company name for LinkedIn search
      let cleanName = ownerName;
      // Remove common suffixes for cleaner search
      companyIndicators.forEach(ind => {
        cleanName = cleanName.replace(new RegExp('\\b' + ind + '\\b', 'gi'), '');
      });
      cleanName = cleanName.replace(/[,.\-]/g, ' ').replace(/\s+/g, ' ').trim();
      
      const linkedInQuery = encodeURIComponent(cleanName);
      window.open(`https://www.linkedin.com/search/results/companies/?keywords=${linkedInQuery}`, '_blank');
      
      showNotification(`🔍 Google + LinkedIn: ${ownerName.substring(0, 25)}...`, 'success');
    } else {
      showNotification('🔍 ' + (mailingAddress || ownerName).substring(0, 35) + '...', 'info');
    }
  }

  // ==================== EVENT HANDLERS ====================

  // Sniper Mode toggle
  sniperBtn.addEventListener('click', toggleSniperMode);

  // Google Maps click
  mapsBtn.addEventListener('click', () => {
    const c = getCoordinates();
    if (c) window.open(`https://www.google.com/maps/@${c.lat},${c.lng},18z/data=!3m1!1e3`, '_blank');
    else showNotification('⚠️ No coordinates!', 'warning');
  });

  // Google Earth click
  earthBtn.addEventListener('click', () => {
    const c = getCoordinates();
    if (c) window.open(`https://earth.google.com/web/@${c.lat},${c.lng},100a,500d,35y,0h,0t,0r`, '_blank');
    else showNotification('⚠️ No coordinates!', 'warning');
  });

  // Check APN click
  apnBtn.addEventListener('click', async () => {
    const apn = getAPN();
    
    if (!apn) {
      showNotification('⚠️ No APN found!', 'warning');
      return;
    }
    
    apnBtn.innerHTML = '⏳';
    apnBtn.disabled = true;
    
    try {
      const response = await fetch(`${API_URL}?action=checkDuplicateAPN&apn=${encodeURIComponent(apn)}`);
      const result = await response.json();
      
      if (result.success) {
        if (result.isDuplicate) {
          showNotification(`⚠️ EXISTS Row ${result.row}!`, 'warning');
          apnBtn.innerHTML = '⚠️ EXISTS';
          apnBtn.style.background = 'linear-gradient(135deg, #cc8800, #aa6600)';
        } else {
          showNotification('✅ NEW - OK to add!', 'success');
          apnBtn.innerHTML = '✅ NEW';
          apnBtn.style.background = 'linear-gradient(135deg, #00aa00, #008800)';
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      showNotification('❌ ' + err.message, 'error');
    }
    
    setTimeout(() => {
      apnBtn.innerHTML = '🔎 Check APN';
      apnBtn.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
      apnBtn.disabled = false;
    }, 3000);
  });

  // Owner Lookup click
  ownerBtn.addEventListener('click', () => lookupOwner());

  // ADD TO CAPRICM - FIREBASE VERSION WITH DUPLICATE PREVENTION
  addBtn.addEventListener('click', async () => {
    if (isSubmitting) {
      showNotification('⏳ Already submitting...', 'warning');
      return;
    }
    
    const apn = getAPN();
    if (!apn) {
      showNotification('⚠️ No APN found on page!', 'warning');
      return;
    }
    
    isSubmitting = true;
    addBtn.innerHTML = '⏳';
    addBtn.disabled = true;

    try {
      const plainText = buildPlainText();
      const notes = notesInput.value.trim();
      const status = statusSelect.value;
      
      // Use APN as key (sanitized for Firebase) - PREVENTS DUPLICATES!
      const firebaseKey = apn.replace(/[.#$/\[\]]/g, '_');
      
      const data = {
        plainText: plainText,
        notes: notes,
        status: status,
        apn: apn,
        timestamp: Date.now(),
        processed: false
      };
      
      const response = await fetch(`${FIREBASE_URL}/regrid_queue/${firebaseKey}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        showNotification('✅ Added to queue!', 'success');
        addBtn.innerHTML = '✓ Added!';
        addBtn.style.background = 'linear-gradient(135deg, #00aa00, #008800)';
        notesInput.value = '';
        statusSelect.value = '';
        
        // Update queue count
        await loadQueueCount();
        
        setTimeout(() => {
          resetButton();
          isSubmitting = false;
        }, 1500);
      } else {
        throw new Error('Firebase error: ' + response.status);
      }
    } catch (err) {
      showNotification('❌ ' + err.message, 'error');
      resetButton();
      isSubmitting = false;
    }
  });

  function resetButton() {
    addBtn.innerHTML = '🏢 Add to CapriCM';
    addBtn.style.background = 'linear-gradient(135deg, #00d4aa, #00a885)';
    addBtn.disabled = false;
  }

  function showNotification(msg, type) {
    const existing = document.getElementById('capricm-notification');
    if (existing) existing.remove();

    const colors = {
      success: '#00aa00',
      error: '#cc0000',
      warning: '#cc8800',
      info: '#4285f4'
    };

    const n = document.createElement('div');
    n.id = 'capricm-notification';
    n.textContent = msg;
    n.style.cssText = `
      position: fixed;
      bottom: 420px;
      right: 20px;
      z-index: 99999;
      padding: 12px 20px;
      background: ${colors[type] || '#333'};
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      max-width: 250px;
      word-wrap: break-word;
    `;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
  }

  // ==================== INJECT STYLES ====================
  
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse-sniper {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    
    @keyframes flash-fade {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
    
    @keyframes slide-in {
      0% { transform: translateX(100px); opacity: 0; }
      100% { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slide-out {
      0% { transform: translateX(0); opacity: 1; }
      100% { transform: translateX(100px); opacity: 0; }
    }
  `;
  document.head.appendChild(styleSheet);

  // ==================== BUILD UI ====================
  
  container.appendChild(sniperBtn);
  container.appendChild(statusSelect);
  container.appendChild(notesInput);
  container.appendChild(addBtnWrapper);
  container.appendChild(queuePanel);
  container.appendChild(mapsBtn);
  container.appendChild(earthBtn);
  container.appendChild(ownerBtn);
  container.appendChild(apnBtn);
  
  document.body.appendChild(container);

  // Load initial queue count
  loadQueueCount();
  
  // Refresh queue count every 30 seconds
  setInterval(loadQueueCount, 30000);
})();