(function() {
  // Wait for page to fully load before injecting
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => setTimeout(initCapriCM, 3000));
    return;
  } else {
    setTimeout(initCapriCM, 3000);
  }
  
  function initCapriCM() {
    if (document.getElementById('capricm-arcgis-container')) return;

    // Firebase & API - Using regrid_queue with source marker
    const FIREBASE_URL = 'https://capricm-chat-default-rtdb.firebaseio.com';
    const QUEUE_NAME = 'regrid_queue'; // Same queue, different source
    const API_URL = 'https://script.google.com/macros/s/AKfycbx7PCVb44s-WikxsAh3RyBBniTffzYMJSsmVXP057pswZaMaCU96bqKeV8GFxlfcueY/exec';

    // Get or prompt for user email
    let userEmail = localStorage.getItem('capricm_user_email') || '';
    
    function promptForEmail() {
      const email = prompt('Enter your @capricm.com email address:\n(This will be saved for future use)');
      if (email && email.includes('@')) {
        localStorage.setItem('capricm_user_email', email);
        userEmail = email;
        showNotification('✅ Email saved: ' + email, 'success');
        return true;
      }
      return false;
    }
    
    // Prompt for email if not set
    if (!userEmail) {
      setTimeout(() => {
        promptForEmail();
      }, 1000);
    }

    // State
    let sniperMode = false;
    let sniperCount = 0;
    let lastAddedAPN = null;
    let queueData = {};
    let queueExpanded = false;

    const container = document.createElement('div');
    container.id = 'capricm-arcgis-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-width: 220px;
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

    // ==================== HEADER ====================
    const header = document.createElement('div');
    header.style.cssText = `
      background: rgba(30, 30, 30, 0.95);
      border-radius: 12px;
      padding: 10px 14px;
      border: 1px solid #ff9800;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    `;
    
    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    headerLeft.innerHTML = `
      <span style="font-weight:600;font-size:14px;color:#ff9800;">🏢 CapriCM</span>
      <span style="font-size:10px;color:#ff9800;background:#3d2800;padding:2px 6px;border-radius:4px;">ArcGIS</span>
    `;
    
    const emailBtn = document.createElement('button');
    emailBtn.innerHTML = '👤';
    emailBtn.title = userEmail || 'Set email';
    emailBtn.style.cssText = `
      background: rgba(255,152,0,0.2);
      border: 1px solid #ff9800;
      color: #ff9800;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    `;
    emailBtn.addEventListener('click', () => {
      if (promptForEmail()) {
        emailBtn.title = userEmail;
      }
    });
    
    header.appendChild(headerLeft);
    header.appendChild(emailBtn);

    // ==================== SNIPER MODE BUTTON ====================
    const sniperBtn = document.createElement('button');
    sniperBtn.innerHTML = '🎯 Sniper Mode';
    sniperBtn.style.cssText = btnStyle + `background: linear-gradient(135deg, #ff1744, #d50000); position: relative;`;

    const sniperBadge = document.createElement('span');
    sniperBadge.id = 'sniper-badge-arcgis';
    sniperBadge.style.cssText = `
      position: absolute; top: -6px; right: -6px;
      background: #00e676; color: #000;
      font-size: 11px; font-weight: 700;
      min-width: 20px; height: 20px;
      border-radius: 10px; display: none;
      align-items: center; justify-content: center;
      padding: 0 5px;
    `;
    sniperBtn.appendChild(sniperBadge);

    // ==================== ADD BUTTON ====================
    const addBtnWrapper = document.createElement('div');
    addBtnWrapper.style.cssText = 'position: relative; width: 100%;';
    
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '➕ Add to Queue';
    addBtn.style.cssText = btnStyle + `background: linear-gradient(135deg, #ff9800, #f57c00);`;

    const queueBadge = document.createElement('span');
    queueBadge.id = 'queue-badge-arcgis';
    queueBadge.style.cssText = `
      position: absolute; top: -6px; right: -6px;
      background: #ff5252; color: white;
      font-size: 11px; font-weight: 700;
      min-width: 20px; height: 20px;
      border-radius: 10px; display: none;
      align-items: center; justify-content: center;
      padding: 0 5px;
    `;
    addBtnWrapper.appendChild(addBtn);
    addBtnWrapper.appendChild(queueBadge);

    // ==================== GOOGLE MAPS BUTTON ====================
    const mapsBtn = document.createElement('button');
    mapsBtn.innerHTML = '🗺️ Google Maps';
    mapsBtn.title = 'Open in Google Maps';
    mapsBtn.style.cssText = btnStyle + `background: linear-gradient(135deg, #34a853, #1e8e3e);`;

    // ==================== GOOGLE EARTH BUTTON ====================
    const earthBtn = document.createElement('button');
    earthBtn.innerHTML = '🌍 Google Earth';
    earthBtn.title = 'Open in Google Earth';
    earthBtn.style.cssText = btnStyle + `background: linear-gradient(135deg, #4285f4, #1a73e8);`;

    // ==================== QUEUE PANEL ====================
    const queuePanel = document.createElement('div');
    queuePanel.style.cssText = `
      background: rgba(30, 30, 30, 0.98);
      border: 1px solid #ff9800;
      border-radius: 12px;
      overflow: hidden;
    `;

    const queueHeader = document.createElement('div');
    queueHeader.style.cssText = `
      padding: 10px 14px;
      background: rgba(255, 152, 0, 0.1);
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    `;
    queueHeader.innerHTML = `
      <span style="font-size: 12px; font-weight: 600; color: #ff9800;">📦 Queue: <span id="arcgis-queue-count">0</span></span>
      <span id="arcgis-queue-arrow" style="color: #ff9800;">▼</span>
    `;

    const queueBody = document.createElement('div');
    queueBody.style.cssText = `max-height: 0; overflow: hidden; transition: max-height 0.3s ease;`;

    const queueList = document.createElement('div');
    queueList.id = 'arcgis-queue-list';
    queueList.style.cssText = `max-height: 120px; overflow-y: auto; padding: 8px;`;

    // Buttons row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `display: flex; gap: 6px; padding: 8px;`;

    const syncBtn = document.createElement('button');
    syncBtn.innerHTML = '🔄 Sync to Sheet';
    syncBtn.style.cssText = `
      flex: 1; padding: 10px;
      background: linear-gradient(135deg, #4285f4, #1a73e8);
      color: white; border: none; border-radius: 8px;
      font-size: 11px; font-weight: 600; cursor: pointer;
    `;

    const clearBtn = document.createElement('button');
    clearBtn.innerHTML = '🗑️ Clear';
    clearBtn.style.cssText = `
      flex: 1; padding: 10px;
      background: linear-gradient(135deg, #ff5252, #d32f2f);
      color: white; border: none; border-radius: 8px;
      font-size: 11px; font-weight: 600; cursor: pointer;
    `;

    btnRow.appendChild(syncBtn);
    btnRow.appendChild(clearBtn);
    queueBody.appendChild(queueList);
    queueBody.appendChild(btnRow);
    queuePanel.appendChild(queueHeader);
    queuePanel.appendChild(queueBody);

    // ==================== STATUS ====================
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'arcgis-status';
    statusIndicator.style.cssText = `
      padding: 8px 12px;
      background: rgba(30, 30, 30, 0.95);
      border-radius: 8px;
      font-size: 11px;
      color: #888;
      text-align: center;
      border: 1px solid #333;
    `;
    statusIndicator.innerHTML = '📍 Click a parcel to see data';

    // ==================== PARSER ====================
    
    function getArcGISParcelData() {
      const bodyText = document.body.innerText;
      
      // Debug: log a snippet
      // console.log('🎯 Body text snippet:', bodyText.substring(0, 500));
      
      // Must have APN to be valid - try multiple patterns
      let apn = null;
      
      // Pattern 1: "APN: 12345" or "APN: 123-456-789"
      const apnMatch1 = bodyText.match(/APN:\s*([\d\w\-]+)/i);
      if (apnMatch1) apn = apnMatch1[1].trim();
      
      // Pattern 2: "APN 12345" (without colon)
      if (!apn) {
        const apnMatch2 = bodyText.match(/APN\s+([\d\-]+)/i);
        if (apnMatch2) apn = apnMatch2[1].trim();
      }
      
      if (!apn) {
        // console.log('🎯 No APN found in text');
        return null;
      }
      
      console.log('🎯 Parser found APN:', apn);
      
      // Extract other fields
      const acreageMatch = bodyText.match(/Acreage:\s*([\d.]+)/i);
      const regridIdMatch = bodyText.match(/Regrid ID:\s*([\w\-]+)/i);
      
      // Extract address block
      let address = '';
      let cityStateZip = '';
      let county = '';
      
      const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // City, State ZIP pattern (e.g., "Huntsville, AL 35816-2204")
        if (line.match(/^[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/)) {
          cityStateZip = line;
          // Previous line with a number at start is likely street address
          for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            if (lines[j].match(/^\d+\s+\w/) && !lines[j].includes(':')) {
              address = lines[j];
              break;
            }
          }
        }
        
        // County pattern (e.g., "Madison County, AL" or "Harris County, TX")
        if (line.match(/County,?\s*[A-Z]{2}/i)) {
          county = line;
        }
      }
      
      // Build plain text for PLAIN TEXT INPUT column
      const plainText = [
        address,
        cityStateZip,
        county,
        acreageMatch ? `Acreage: ${acreageMatch[1]}` : '',
        `APN: ${apn}`,
        regridIdMatch ? `Regrid ID: ${regridIdMatch[1]}` : '',
        userEmail ? `User: ${userEmail}` : ''
      ].filter(l => l).join('\n');
      
      const result = {
        apn: apn,
        address: address || '',
        cityStateZip: cityStateZip || '',
        county: county || '',
        acreage: acreageMatch ? acreageMatch[1] : '',
        regridId: regridIdMatch ? regridIdMatch[1] : '',
        plainText: plainText
      };
      
      console.log('🎯 Parsed data:', result);
      
      return result;
    }

    // ==================== QUEUE FUNCTIONS ====================

    async function loadQueueCount() {
      try {
        const response = await fetch(`${FIREBASE_URL}/${QUEUE_NAME}.json`);
        const data = await response.json();
        queueData = data || {};
        
        const pending = Object.entries(queueData).filter(([k, v]) => !v.processed);
        const count = pending.length;
        
        const countEl = document.getElementById('arcgis-queue-count');
        if (countEl) countEl.textContent = count;
        
        if (count > 0) {
          queueBadge.textContent = count;
          queueBadge.style.display = 'flex';
        } else {
          queueBadge.style.display = 'none';
        }
        
        updateQueueList(pending);
        return count;
      } catch (err) {
        console.log('Queue check failed:', err);
        return 0;
      }
    }

    function updateQueueList(pending) {
      const list = document.getElementById('arcgis-queue-list');
      if (!list) return;
      
      if (!pending || pending.length === 0) {
        list.innerHTML = '<div style="color:#666;text-align:center;padding:10px;font-size:11px;">Queue empty</div>';
        return;
      }
      
      let html = '';
      pending.slice(0, 8).forEach(([key, item]) => {
        html += `
          <div style="
            padding: 6px 8px; margin-bottom: 4px;
            background: rgba(255, 152, 0, 0.1);
            border-radius: 6px; border-left: 3px solid #ff9800;
            font-size: 10px;
          ">
            <div style="color:#ff9800;font-weight:600;">${item.apn || 'No APN'}</div>
            <div style="color:#888;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${item.address || 'Unknown'}
            </div>
          </div>
        `;
      });
      
      if (pending.length > 8) {
        html += `<div style="color:#666;text-align:center;font-size:10px;">+${pending.length - 8} more</div>`;
      }
      
      list.innerHTML = html;
    }

    async function addToQueue(data) {
      if (!data || !data.apn) {
        showNotification('⚠️ No parcel data!', 'warning');
        return false;
      }
      
      try {
        const firebaseKey = data.apn.replace(/[.#$/\[\]]/g, '_');
        
        const payload = {
          plainText: data.plainText,
          apn: data.apn,
          address: data.address,
          cityStateZip: data.cityStateZip,
          county: data.county,
          acreage: data.acreage,
          regridId: data.regridId,
          timestamp: Date.now(),
          processed: false,
          source: 'arcgis' // Mark as ArcGIS source
        };
        
        const response = await fetch(`${FIREBASE_URL}/${QUEUE_NAME}/${firebaseKey}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          await loadQueueCount();
          return true;
        }
        return false;
      } catch (err) {
        console.log('Add error:', err);
        return false;
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
        const response = await fetch(`${API_URL}?action=processArcGISQueue`);
        const result = await response.json();
        
        if (result.success) {
          showNotification(`✅ Synced ${result.processed || pending.length} to sheet!`, 'success');
          
          // Reset sniper count after successful sync
          sniperCount = 0;
          updateSniperBadge();
          
          await loadQueueCount();
        } else {
          throw new Error(result.error || 'Sync failed');
        }
      } catch (err) {
        showNotification('❌ ' + err.message, 'error');
      }
      
      syncBtn.disabled = false;
      syncBtn.innerHTML = '🔄 Sync to Sheet';
    }

    async function clearQueue() {
      const pending = Object.entries(queueData).filter(([k, v]) => !v.processed);
      
      if (pending.length === 0) {
        showNotification('📦 Already empty!', 'info');
        return;
      }
      
      if (!confirm(`Clear ${pending.length} parcels from queue?`)) return;
      
      clearBtn.disabled = true;
      clearBtn.innerHTML = '⏳';
      
      try {
        const response = await fetch(`${FIREBASE_URL}/${QUEUE_NAME}.json`, { 
          method: 'DELETE' 
        });
        
        if (response.ok) {
          showNotification(`🗑️ Cleared ${pending.length} parcels`, 'success');
          queueData = {};
          
          // Reset sniper count after clear
          sniperCount = 0;
          updateSniperBadge();
          
          await loadQueueCount();
        }
      } catch (err) {
        showNotification('❌ Clear failed', 'error');
      }
      
      clearBtn.disabled = false;
      clearBtn.innerHTML = '🗑️ Clear';
    }

    // ==================== SNIPER MODE ====================
    
    let sniperObserver = null;
    let sniperThrottle = null;
    
    function toggleSniperMode() {
      sniperMode = !sniperMode;
      
      if (sniperMode) {
        sniperCount = 0;
        
        // IMPORTANT: Set lastAddedAPN to current parcel so we ignore it
        // We only want to capture NEW clicks, not the already-selected parcel
        const currentData = getArcGISParcelData();
        lastAddedAPN = currentData ? currentData.apn : null;
        
        updateSniperBadge();
        
        sniperBtn.innerHTML = '🎯 SNIPER ON';
        sniperBtn.appendChild(sniperBadge);
        sniperBtn.style.background = 'linear-gradient(135deg, #00e676, #00c853)';
        sniperBtn.style.animation = 'pulse-sniper 1s ease-in-out infinite';
        container.style.boxShadow = '0 0 30px rgba(0, 230, 118, 0.4)';
        
        startSniperObserver();
        showNotification('🎯 SNIPER ON - Click parcels!', 'success');
        playSound('activate');
        
      } else {
        sniperBtn.innerHTML = '🎯 Sniper Mode';
        sniperBtn.appendChild(sniperBadge);
        sniperBtn.style.background = 'linear-gradient(135deg, #ff1744, #d50000)';
        sniperBtn.style.animation = 'none';
        container.style.boxShadow = 'none';
        
        stopSniperObserver();
        showNotification(`🎯 OFF - Added ${sniperCount}`, 'info');
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
      console.log('🎯 Starting Sniper Observer...');
      
      // Use MutationObserver to detect popup changes
      sniperObserver = new MutationObserver((mutations) => {
        if (!sniperMode) return;
        
        // Check if any mutation involves text changes (popup update)
        const hasRelevantChange = mutations.some(m => {
          return m.addedNodes.length > 0 || 
                 m.type === 'characterData' ||
                 (m.type === 'childList' && m.target.innerText?.includes('APN'));
        });
        
        if (hasRelevantChange) {
          // Clear existing throttle and set new one
          if (sniperThrottle) {
            clearTimeout(sniperThrottle);
          }
          
          sniperThrottle = setTimeout(() => {
            sniperThrottle = null;
            checkAndAddParcel();
          }, 800);
        }
      });
      
      sniperObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: true
      });
      
      console.log('🎯 Sniper Observer active');
    }
    
    function stopSniperObserver() {
      if (sniperObserver) {
        sniperObserver.disconnect();
        sniperObserver = null;
      }
      if (sniperThrottle) {
        clearTimeout(sniperThrottle);
        sniperThrottle = null;
      }
      lastAddedAPN = null;
      console.log('🎯 Sniper Observer stopped');
    }
    
    async function checkAndAddParcel() {
      if (!sniperMode) {
        console.log('🎯 Sniper mode off, skipping');
        return;
      }
      
      const data = getArcGISParcelData();
      
      if (!data) {
        console.log('🎯 No parcel data found');
        return;
      }
      
      console.log('🎯 Found parcel:', data.apn, '| Last added:', lastAddedAPN);
      
      if (data.apn && data.apn !== lastAddedAPN) {
        console.log('🎯 NEW parcel, adding to queue...');
        
        const success = await addToQueue(data);
        
        if (success) {
          lastAddedAPN = data.apn;
          sniperCount++;
          updateSniperBadge();
          updateStatusIndicator(data);
          flashScreen();
          playSound('add');
          showSniperNotification(`+1 🎯 ${data.apn}`);
          console.log('🎯 SUCCESS - Added:', data.apn, '| Total:', sniperCount);
        } else {
          console.log('🎯 FAILED to add to queue');
        }
      } else {
        console.log('🎯 Same as last, skipping:', data.apn);
      }
    }

    // ==================== UI HELPERS ====================
    
    function updateStatusIndicator(data) {
      if (data) {
        statusIndicator.innerHTML = `
          <div style="color:#ff9800;font-weight:600;margin-bottom:2px;">📍 ${data.address || 'Unknown'}</div>
          <div style="color:#aaa;font-size:10px;">APN: ${data.apn} | ${data.acreage || '?'} ac</div>
        `;
      } else {
        statusIndicator.innerHTML = '📍 Click a parcel to see data';
      }
    }

    function showNotification(msg, type) {
      const existing = document.getElementById('capricm-notif-arcgis');
      if (existing) existing.remove();

      const colors = { success: '#00aa00', error: '#cc0000', warning: '#cc8800', info: '#ff9800' };

      const n = document.createElement('div');
      n.id = 'capricm-notif-arcgis';
      n.textContent = msg;
      n.style.cssText = `
        position: fixed; top: 20px; left: 20px; z-index: 99999;
        padding: 12px 20px; background: ${colors[type] || '#333'};
        color: white; border-radius: 8px; font-size: 14px; font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 2500);
    }
    
    function showSniperNotification(msg) {
      const existing = document.getElementById('sniper-notif-arcgis');
      if (existing) existing.remove();
      
      const n = document.createElement('div');
      n.id = 'sniper-notif-arcgis';
      n.textContent = msg;
      n.style.cssText = `
        position: fixed; top: 20px; left: 20px; z-index: 99999;
        padding: 10px 20px;
        background: linear-gradient(135deg, #00e676, #00c853);
        color: #000; border-radius: 8px; font-size: 14px; font-weight: bold;
      `;
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 1000);
    }

    function flashScreen() {
      const flash = document.createElement('div');
      flash.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(255, 152, 0, 0.2);
        pointer-events: none; z-index: 999998;
      `;
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 200);
    }

    function playSound(type) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0.05;
        osc.frequency.value = type === 'add' ? 1200 : type === 'activate' ? 880 : 440;
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } catch(e) {}
    }

    // ==================== STYLES ====================
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse-sniper {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
      }
    `;
    document.head.appendChild(style);

    // ==================== EVENT LISTENERS ====================

    sniperBtn.addEventListener('click', toggleSniperMode);
    
    addBtn.addEventListener('click', async () => {
      const data = getArcGISParcelData();
      if (!data || !data.apn) {
        showNotification('⚠️ Click a parcel first!', 'warning');
        return;
      }
      
      addBtn.innerHTML = '⏳';
      addBtn.disabled = true;
      
      const success = await addToQueue(data);
      
      if (success) {
        showNotification('✅ Added!', 'success');
        addBtn.innerHTML = '✓ Added!';
        addBtn.style.background = 'linear-gradient(135deg, #00aa00, #008800)';
        updateStatusIndicator(data);
      } else {
        showNotification('❌ Failed', 'error');
      }
      
      setTimeout(() => {
        addBtn.innerHTML = '➕ Add to Queue';
        addBtn.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
        addBtn.disabled = false;
      }, 1500);
    });

    queueHeader.addEventListener('click', () => {
      queueExpanded = !queueExpanded;
      const arrow = document.getElementById('arcgis-queue-arrow');
      queueBody.style.maxHeight = queueExpanded ? '250px' : '0';
      if (arrow) arrow.style.transform = queueExpanded ? 'rotate(180deg)' : 'rotate(0)';
    });

    syncBtn.addEventListener('click', syncToSheet);
    clearBtn.addEventListener('click', clearQueue);

    // Maps button - open address in Google Maps
    mapsBtn.addEventListener('click', () => {
      const data = getArcGISParcelData();
      if (!data || !data.address) {
        showNotification('⚠️ No address found!', 'warning');
        return;
      }
      const query = `${data.address}, ${data.cityStateZip}`.trim();
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank');
    });

    // Earth button - open coordinates in Google Earth
    earthBtn.addEventListener('click', () => {
      const data = getArcGISParcelData();
      if (!data || !data.address) {
        showNotification('⚠️ No parcel data!', 'warning');
        return;
      }
      // Use address for Earth search since we don't have lat/lng from ArcGIS popup
      const query = `${data.address}, ${data.cityStateZip}`.trim();
      window.open(`https://earth.google.com/web/search/${encodeURIComponent(query)}`, '_blank');
    });

    // ==================== BUILD UI ====================
    
    container.appendChild(header);
    container.appendChild(sniperBtn);
    container.appendChild(addBtnWrapper);
    container.appendChild(queuePanel);
    container.appendChild(mapsBtn);
    container.appendChild(earthBtn);
    container.appendChild(statusIndicator);
    
    document.body.appendChild(container);

    // Load initial queue
    loadQueueCount();
    setInterval(loadQueueCount, 30000);
    
    console.log('✅ CapriCM ArcGIS Extension loaded!');
  }
})();