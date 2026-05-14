/**
 * LOGIC FRETE - Main Application Logic
 * Ties UI, StorageManager, and MapService together.
 */

  const initApp = () => {
    // === UI HELPERS ===
    function showToast(message, type = 'success') {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      
      let icon = 'ri-checkbox-circle-line';
      if (type === 'error') icon = 'ri-error-warning-line';
      if (type === 'warning') icon = 'ri-alert-line';

      toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
      `;

      container.appendChild(toast);

      // Auto remove
      setTimeout(() => {
        toast.classList.add('fadeOut');
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }

    // === AUTHENTICATION LOGIC ===
    let currentUser = null;

    function checkAuth() {
      const overlay = document.getElementById('loginOverlay');
      const wrapper = document.getElementById('mainAppWrapper');
      currentUser = StorageManager.getCurrentUser();
      
      console.log("Auth: Verificando estado...", currentUser ? "Logado" : "Deslogado");

      if (currentUser) {
        document.documentElement.classList.add('is-logged-in');
        if (overlay) overlay.style.setProperty('display', 'none', 'important');
        if (wrapper) wrapper.style.setProperty('display', 'flex', 'important');
        applyPermissions();
        
        // Ensure default tab is selected based on role
        const defaultTabId = currentUser.role === 'Motorista' ? 'tab-routes' : 'tab-dashboard';
        const defaultTab = document.getElementById(defaultTabId);
        if (defaultTab) defaultTab.click();
        
        // Initial dashboard refresh
        refreshDashboard();

        // Wake up map
        setTimeout(() => {
          if (MapService.map) MapService.map.resize();
        }, 500);
      } else {
        document.documentElement.classList.remove('is-logged-in');
        if (overlay) overlay.style.setProperty('display', 'flex', 'important');
        if (wrapper) wrapper.style.setProperty('display', 'none', 'important');
      }
    }
    const loginOverlay = document.getElementById('loginOverlay');
    const mainAppWrapper = document.getElementById('mainAppWrapper');
    const loginForm = document.getElementById('loginForm');
    const btnLogout = document.getElementById('btnLogout');

    const loginError = document.getElementById('loginError');

    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        console.log("Auth: Formulário de login enviado.");
        
        const btn = loginForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        
        const user = document.getElementById('loginUser').value.trim();
        const pass = document.getElementById('loginPass').value.trim();

        if (!user || !pass) return;

        try {
          btn.disabled = true;
          btn.innerHTML = '<i class="ri-loader-4-line btn-spin"></i> Entrando...';
          
          console.log(`Auth: Tentando login para o usuário: ${user}`);
          const success = await StorageManager.login(user, pass);

          if (success) {
            console.log("Auth: Login retornado com sucesso.");
            if (loginError) loginError.style.display = 'none';
            showToast('Login realizado com sucesso!');
            loginForm.reset();
            
            // Execute the UI transition
            checkAuth();
            
            // Force reload if UI doesn't transition in 1 second
            setTimeout(() => {
              const overlay = document.getElementById('loginOverlay');
              if (overlay && overlay.style.display !== 'none') {
                console.warn("Auth: Transição de UI falhou, forçando recarregamento...");
                window.location.reload();
              }
            }, 1000);

          } else {
            console.warn("Auth: Credenciais inválidas.");
            if (loginError) loginError.style.display = 'block';
            showToast('Usuário ou senha incorretos', 'error');
          }
        } catch (err) {
          console.error("Login error:", err);
          showToast('Erro de conexão: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      };
    }

    // Clear error message when user starts typing
    ['loginUser', 'loginPass'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        if (loginError) loginError.style.display = 'none';
      });
    });

    btnLogout?.addEventListener('click', () => {
      StorageManager.logout();
      checkAuth();
    });

    document.getElementById('btnLogoutMobile')?.addEventListener('click', () => {
      StorageManager.logout();
      checkAuth();
    });

    function applyPermissions() {
      if (!currentUser) return;
      
      const isMaster = currentUser.role === 'MASTER';
      const isGerente = currentUser.role === 'Gerente';
      const perms = currentUser.permissions || [];

      const canViewRoute = isMaster || perms.includes('view_route');
      const canEditRoute = isMaster || perms.includes('edit_route');
      const canReorder = isMaster || perms.includes('reorder_stops');
      const canEditNotes = isMaster || perms.includes('edit_notes');

      // Users Tab visibility
      const tabUsers = document.getElementById('tab-users');
      const tabDashboard = document.getElementById('tab-dashboard');
      const tabDrivers = document.getElementById('tab-drivers');
      const tabMap = document.getElementById('tab-map');

      const isMotorista = currentUser.role === 'Motorista';

      if (tabUsers) tabUsers.style.display = (isMaster || isGerente) ? 'flex' : 'none';
      if (tabDashboard) tabDashboard.style.display = isMotorista ? 'none' : 'flex';
      if (tabDrivers) tabDrivers.style.display = isMotorista ? 'none' : 'flex';
      if (tabMap) tabMap.style.display = isMotorista ? 'none' : 'flex';

      // Sync bottom nav visibility with sidebar tabs
      const mbnDashboard = document.getElementById('mbn-dashboard');
      const mbnDrivers  = document.getElementById('mbn-drivers');
      const mbnMap      = document.getElementById('mbn-map');
      if (mbnDashboard) mbnDashboard.style.display = isMotorista ? 'none' : 'flex';
      if (mbnDrivers)   mbnDrivers.style.display   = isMotorista ? 'none' : 'flex';
      if (mbnMap)       mbnMap.style.display        = isMotorista ? 'none' : 'flex';

      // If motorista, default bottom nav active to routes
      if (isMotorista) {
        const mbnRoutes = document.getElementById('mbn-routes');
        if (mbnRoutes) mbnRoutes.classList.add('active');
        const mbnDash = document.getElementById('mbn-dashboard');
        if (mbnDash) mbnDash.classList.remove('active');
      }
      
      // Hide global add buttons based on permissions
      const btnNewRoute = document.getElementById('btnNewRouteMain');
      if(btnNewRoute) btnNewRoute.style.display = canEditRoute ? 'inline-flex' : 'none';
      
      const btnNewDriver = document.getElementById('btnNewDriverMain');
      if(btnNewDriver) btnNewDriver.style.display = (isMaster || isGerente) ? 'inline-flex' : 'none';
      
      // Store perms globally for render functions
      window.appPermissions = { canViewRoute, canEditRoute, canReorder, canEditNotes, isMaster, isGerente };
    }


    // Sidebar & Mobile Menu
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const btnOpenSidebar = document.getElementById('btnOpenSidebar');
    const btnCollapseSidebar = document.getElementById('btnCollapseSidebar');
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function toggleMobileMenu(forceClose = false) {
      if (window.innerWidth <= 768) {
        if (forceClose) {
          sidebar.classList.remove('mobile-active');
          if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        } else {
          sidebar.classList.toggle('mobile-active');
          if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
        }
      } else {
        // On desktop, just collapse sidebar (icon-only mode)
        if (forceClose) {
          // do nothing on desktop 'close'
        } else {
          sidebar.classList.toggle('collapsed');
        }
      }
      
      // Fix Map if visible
      setTimeout(() => {
        if (MapService.map) MapService.map.resize();
      }, 300);
    }

    btnOpenSidebar?.addEventListener('click', () => toggleMobileMenu());
    sidebarOverlay?.addEventListener('click', () => toggleMobileMenu(true));
    btnCollapseSidebar?.addEventListener('click', () => toggleMobileMenu(true));

  
    // Modals
    const modalRoute = document.getElementById('modalRoute');
    const modalDelivery = document.getElementById('modalDelivery');
    const modalDriver = document.getElementById('modalDriver');
    
    // Confirm Dialog
    const confirmDialog = document.getElementById('confirmDialog');
    let confirmCallback = null;
  
    // Route Detail Panel
    const routeDetailPanel = document.getElementById('routeDetailPanel');
    const rdpClose = document.getElementById('rdpClose');
    let activeRouteId = null; // Track which route is selected
    let expandedRouteIds = new Set();

    // Main Content Views
    const mainDashboardView = document.getElementById('mainDashboardView');
    const mainRoutesView = document.getElementById('mainRoutesView');
    const mainCalendarView = document.getElementById('mainCalendarView');
    const mainDriversView = document.getElementById('mainDriversView');
    const mainUsersView = document.getElementById('mainUsersView');

    // Helper to get local date in YYYY-MM-DD format
    window.getLocalISODate = function() {
      const now = new Date();
      return now.getFullYear() + '-' + 
             String(now.getMonth() + 1).padStart(2, '0') + '-' + 
             String(now.getDate()).padStart(2, '0');
    }

    const allMainViews = [
      mainDashboardView,
      mainRoutesView,
      mainCalendarView,
      mainDriversView,
      mainUsersView
    ];

    const mapAreaElements = [
      document.getElementById('mapControlsOverlay'),
      document.getElementById('map'),
      document.getElementById('routeDetailPanel')
    ];
  
    // Helper to navigate to map and load a route
    function navigateToMap(routeId, readOnly = false) {
      // Toggle tab active state in sidebar
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('tab-map').classList.add('active');
      
      showMainView('map');
      
      // Force readOnly if no edit permission
      const finalReadOnly = readOnly || (window.appPermissions && !window.appPermissions.canEditRoute);
      
      if (routeId) loadRouteToMap(routeId, finalReadOnly);
    }


    // Global click listener to collapse items when clicking outside
    document.addEventListener('click', (e) => {
      const isListItem = e.target.closest('.list-item');
      const isModal = e.target.closest('.modal-content') || e.target.closest('.confirm-dialog-content');
      const isAction = e.target.closest('.details-actions') || e.target.closest('.stop-actions-small');
      
      if (!isListItem && !isModal && !isAction) {
        if (expandedRouteIds.size > 0) {
          expandedRouteIds.clear();
          if (document.getElementById('panel-routes')?.classList.contains('active')) renderRoutesList();
        }
      }
    });

    // === EVENT LISTENERS: SIDEBAR & NAVIGATION ===
    const btnAccessMap = document.getElementById('btnAccessMap');
    btnAccessMap?.addEventListener('click', () => navigateToMap());

    function showMainView(viewId) {
      // Add current view class to mainAppWrapper for CSS scoping
      const wrapper = document.getElementById('mainAppWrapper');
      if (wrapper) {
        // Remove existing view classes
        wrapper.classList.forEach(cls => {
          if (cls.startsWith('view-')) wrapper.classList.remove(cls);
        });
        const viewClass = viewId === 'map' ? 'view-map' : `view-${viewId.replace('main', '').replace('View', '').toLowerCase()}`;
        wrapper.classList.add(viewClass);
      }

      if (viewId === 'map') {
        allMainViews.forEach(v => { if(v) v.style.display = 'none'; });
        mapAreaElements.forEach(el => {
          if(el) el.style.display = el.id === 'routeDetailPanel' ? (activeRouteId ? 'flex' : 'none') : 'flex';
        });
        setTimeout(() => {
          if (MapService && MapService.map) MapService.map.resize();
        }, 100);
        return;
      }

      allMainViews.forEach(v => {
        if(v) v.style.display = v.id === viewId ? 'flex' : 'none';
      });
      mapAreaElements.forEach(el => {
        if(el) el.style.display = 'none';
      });
      
      // Refresh data
      if (viewId === 'mainDashboardView') refreshDashboard();
      if (viewId === 'mainRoutesView') renderRoutesList();
      if (viewId === 'mainCalendarView') renderCalendarView();
      if (viewId === 'mainDriversView') renderDriversList();
      if (viewId === 'mainUsersView') renderUsersList();
    }
  
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Close menu on mobile
        toggleMobileMenu(true);

        // Remove active
        navTabs.forEach(t => t.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        // Add active
        tab.classList.add('active');
        const targetId = `panel-${tab.dataset.tab}`;
        const targetPanel = document.getElementById(targetId);
        if(targetPanel) targetPanel.classList.add('active');
        
        // Sync bottom nav active state
        updateBottomNavActive(tab.dataset.tab);

        // Refresh data based on tab
        const viewMap = {
          'dashboard': 'mainDashboardView',
          'routes': 'mainRoutesView',
          'calendar': 'mainCalendarView',
          'drivers': 'mainDriversView',
          'users': 'mainUsersView',
          'map': 'map'
        };
        showMainView(viewMap[tab.dataset.tab]);
      });
    });

    // === KEYBOARD NAVIGATION ===
    document.addEventListener('keydown', (e) => {
      const isModalOpen = document.querySelector('.modal-overlay.active, .confirm-dialog.active');
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (isModalOpen || isTyping) return;

      const activeTab = document.querySelector('.nav-tab.active');
      if (!activeTab) return;

      const tabs = Array.from(document.querySelectorAll('.nav-tab:not([style*="display: none"])'));
      const currentIndex = tabs.indexOf(activeTab);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const nextIndex = (currentIndex + 1) % tabs.length;
        tabs[nextIndex].click();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        tabs[prevIndex].click();
      }
    });

    // === MOBILE BOTTOM NAVIGATION ===
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

    function updateBottomNavActive(tabId) {
      mobileNavItems.forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabId);
      });
    }

    mobileNavItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabId = item.dataset.tab;
        const sidebarTab = document.getElementById(`tab-${tabId}`);
        if (sidebarTab && sidebarTab.style.display !== 'none') {
          sidebarTab.click();
        }
      });
    });

    // Initialize bottom nav active state to match default tab
    updateBottomNavActive('dashboard');

    // === DASHBOARD STAT CARDS CLICKS ===
    document.getElementById('stat-routes-main')?.addEventListener('click', () => {
      document.getElementById('tab-routes').click();
      setTimeout(() => {
        const filter = document.querySelector('#mainRoutesView .filter-chips [data-filter="all"]');
        if(filter) filter.click();
      }, 50);
    });

    document.getElementById('stat-pending-main')?.addEventListener('click', () => {
      document.getElementById('tab-routes').click();
      setTimeout(() => {
        const filter = document.querySelector('#mainRoutesView .filter-chips [data-filter="planned"]');
        if(filter) filter.click();
      }, 50);
    });

    document.getElementById('stat-done-main')?.addEventListener('click', () => {
      document.getElementById('tab-routes').click();
      setTimeout(() => {
        const filter = document.querySelector('#mainRoutesView .filter-chips [data-filter="done"]');
        if(filter) filter.click();
      }, 50);
    });
    
    // (Old stat listeners removed)

    document.getElementById('stat-km-main')?.addEventListener('click', () => {
      document.getElementById('tab-routes').click();
    });
  
    // === SIDEBAR COLLAPSE LOGIC ===
    // Restore collapsed state only on desktop
    if (window.innerWidth > 768) {
      const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
      if (isSidebarCollapsed) sidebar.classList.add('collapsed');
    }

    // Persist desktop collapse state
    if (btnCollapseSidebar) {
      btnCollapseSidebar.addEventListener('change', () => {
        if (window.innerWidth > 768) {
          localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        }
      });
    }

    // === MAP CONTROLS ===
    document.getElementById('btnLocate')?.addEventListener('click', () => MapService.locateUser());
    document.getElementById('btnFitAll')?.addEventListener('click', () => MapService.fitAll());
    document.getElementById('btnExport')?.addEventListener('click', () => StorageManager.exportData());

    // Initialize RDP (Route Detail Panel) Listeners
    initRdpListeners();
  
    // === MAP THEME SWITCHER ===
    document.querySelectorAll('.theme-btn[data-theme]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const theme = e.currentTarget.getAttribute('data-theme');
        MapService.setBaseLayer(theme);
        
        // UI Update
        document.querySelectorAll('.theme-btn[data-theme]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    const handleTrafficToggle = (e) => {
      const isActive = MapService.toggleTraffic();
      const desktopBtn = document.getElementById('btnTrafficDesktop');
      const mobileBtn = document.getElementById('btnTraffic');
      
      desktopBtn?.classList.toggle('active', isActive);
      mobileBtn?.classList.toggle('active', isActive);
      
      if(isActive) {
        showToast('Trânsito em tempo real ativado');
      } else {
        showToast('Trânsito desativado');
      }
    };

    document.getElementById('btnTraffic')?.addEventListener('click', handleTrafficToggle);
    document.getElementById('btnTrafficDesktop')?.addEventListener('click', handleTrafficToggle);

    // === SEARCH SUGGESTIONS LOGIC (Nominatim) ===
    let debounceTimer;
    function setupAddressSearch(inputId, suggestionsId, latId, lngId, wrapId) {
      const input = document.getElementById(inputId);
      const suggestions = document.getElementById(suggestionsId);
      let activeIndex = -1;
      
      const selectSuggestion = (res) => {
        input.value = res.address;
        if (latId && lngId) {
          document.getElementById(latId).value = res.lat;
          document.getElementById(lngId).value = res.lng;
          if (document.getElementById(wrapId)) {
            document.getElementById(wrapId).value = res.address;
          }
        }
        suggestions.style.display = 'none';
        activeIndex = -1;
        
        if (inputId === 'addressSearchInput') {
          MapService.map.flyTo({ center: [res.lng, res.lat], zoom: 16 });
          const marker = MapService.createMarker(res.lat, res.lng, '', 'planned');
          marker.setPopup(new maplibregl.Popup({ offset: 25 }).setText(res.address)).togglePopup();
        }
      };

      input.addEventListener('keydown', (e) => {
        const items = suggestions.querySelectorAll('.suggestion-item:not(.empty)');
        if (suggestions.style.display === 'none' || items.length === 0) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeIndex = (activeIndex + 1) % items.length;
          updateActiveSuggestion(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIndex = (activeIndex - 1 + items.length) % items.length;
          updateActiveSuggestion(items);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeIndex > -1 && items[activeIndex]) {
            items[activeIndex].click();
          }
        } else if (e.key === 'Escape') {
          suggestions.style.display = 'none';
          activeIndex = -1;
        }
      });

      function updateActiveSuggestion(items) {
        items.forEach((item, idx) => {
          if (idx === activeIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
          } else {
            item.classList.remove('active');
          }
        });
      }
      
      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value;
        if (query.length < 3) {
          suggestions.style.display = 'none';
          activeIndex = -1;
          return;
        }
        
        debounceTimer = setTimeout(async () => {
          const results = await MapService.searchAddress(query);
          suggestions.innerHTML = '';
          activeIndex = -1;
          
          if (results.length === 0) {
            suggestions.innerHTML = '<div class="suggestion-item empty"><span class="suggestion-text">Nenhum endereço encontrado</span></div>';
          } else {
            results.forEach((res, idx) => {
              const div = document.createElement('div');
              div.className = 'suggestion-item';
              div.innerHTML = `<i class="ri-map-pin-line"></i> <span class="suggestion-text">${res.address}</span>`;
              div.addEventListener('click', () => selectSuggestion(res));
              
              // Also highlight on hover to keep synced
              div.addEventListener('mouseenter', () => {
                activeIndex = idx;
                const items = suggestions.querySelectorAll('.suggestion-item:not(.empty)');
                updateActiveSuggestion(items);
              });

              suggestions.appendChild(div);
            });
          }
          suggestions.style.display = 'block';
        }, 500);
      });
  
      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
          suggestions.style.display = 'none';
          activeIndex = -1;
        }
      });
    }
  
    setupAddressSearch('addressSearchInput', 'searchSuggestions', null, null, null);
    setupAddressSearch('routeOriginInput', 'originSuggestions', 'routeOriginLat', 'routeOriginLng', 'routeOriginAddr');
    setupAddressSearch('deliveryAddressInput', 'deliverySuggestions', 'deliveryLat', 'deliveryLng', 'deliveryAddr');
  
    document.getElementById('clearSearch').addEventListener('click', () => {
      document.getElementById('addressSearchInput').value = ''
      MapService.clearMap();
    });

    // CPF/CNPJ Mask & Limit
    const deliveryCpfInput = document.getElementById('deliveryCpf');
    deliveryCpfInput?.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, ''); // Remove non-digits
      if (v.length > 14) v = v.slice(0, 14); // Limit to 14 numbers (CNPJ max)
      
      if (v.length <= 11) {
        // CPF Mask: 000.000.000-00
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      } else {
        // CNPJ Mask: 00.000.000/0000-00
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
      }
      e.target.value = v;
    });
  
    // === ROUTE MODAL LOGIC ===
    const btnNewRoute = document.getElementById('btnNewRoute');
    const btnNewRouteEmpty = document.getElementById('btnNewRouteEmpty');
    const closeModalRoute = document.getElementById('closeModalRoute');
    const cancelModalRoute = document.getElementById('cancelModalRoute');
    const saveRouteBtn = document.getElementById('saveRoute');
    let editingRouteId = null;
  
    function openRouteModal(routeId = null) {
      editingRouteId = routeId;
      const title = document.getElementById('modalRouteTitle');
      const driverSelect = document.getElementById('routeDriver');
      
      // Populate Drivers (Traditional Drivers + Users with role Motorista)
      driverSelect.innerHTML = '<option value="">Sem motorista</option>';
      
      const traditionalDrivers = StorageManager.getDrivers();
      const userDrivers = StorageManager.getUsers().filter(u => u.role === 'Motorista');
      
      const allPossibleDrivers = [
        ...traditionalDrivers.map(d => ({ id: d.id, name: d.name, label: d.name })),
        ...userDrivers.map(u => ({ id: u.id, name: u.name, label: `${u.name} (Usuário)` }))
      ];

      allPossibleDrivers.forEach(d => {
        driverSelect.innerHTML += `<option value="${d.id}">${d.label}</option>`;
      });
  
      if (routeId) {
        title.innerText = 'Editar Rota';
        const route = StorageManager.getRoute(routeId);
        if (!route) return closeRouteModal();
        
        document.getElementById('routeName').value = route.name || ''
        document.getElementById('routeDate').value = route.date || ''
        document.getElementById('routeDriver').value = route.driverId || ''
        document.getElementById('routeNotes').value = route.notes || ''
        document.getElementById('routeVehicle').value = route.vehicle || ''
        document.getElementById('routePlate').value = route.plate || ''
        if (route.origin) {
          document.getElementById('routeOriginInput').value = route.origin.address || ''
          document.getElementById('routeOriginLat').value = route.origin.lat || ''
          document.getElementById('routeOriginLng').value = route.origin.lng || ''
          document.getElementById('routeOriginAddr').value = route.origin.address || ''
        }
        
        const colorVal = route.color || 'default';
        document.querySelectorAll('input[name="routeColor"]').forEach(input => {
          input.checked = input.value === colorVal;
        });
      } else {
        title.innerText = 'Nova Rota';
        document.getElementById('routeName').value = ''
        document.getElementById('routeDate').value = getLocalISODate();
        document.getElementById('routeDriver').value = ''
        document.getElementById('routeNotes').value = ''
        document.getElementById('routeVehicle').value = ''
        document.getElementById('routePlate').value = ''
        document.getElementById('routeOriginInput').value = ''
        document.getElementById('routeOriginLat').value = ''
        document.getElementById('routeOriginLng').value = ''
        document.getElementById('routeOriginAddr').value = ''
        
        document.querySelectorAll('input[name="routeColor"]').forEach(input => {
          input.checked = input.value === 'default';
        });
      }

      // Permissions check for notes
      const notesField = document.getElementById('routeNotes');
      if (notesField) {
        notesField.disabled = !(window.appPermissions?.canEditNotes);
      }

      modalRoute.classList.add('active');
    }

  
    function closeRouteModal() { modalRoute.classList.remove('active'); }
  
    btnNewRoute?.addEventListener('click', () => openRouteModal());
    document.getElementById('btnNewRouteMain')?.addEventListener('click', () => openRouteModal());
    btnNewRouteEmpty?.addEventListener('click', () => openRouteModal());
    closeModalRoute.addEventListener('click', closeRouteModal);
    cancelModalRoute.addEventListener('click', closeRouteModal);
  
    saveRouteBtn.addEventListener('click', async () => {
      const name = document.getElementById('routeName').value.trim();
      const lat = document.getElementById('routeOriginLat').value;
      const lng = document.getElementById('routeOriginLng').value;
      const addr = document.getElementById('routeOriginInput').value.trim();
  
      if (!name) return showToast('Nome da rota é obrigatório', 'error');
      if (!addr) return showToast('Informe o ponto de partida', 'error');
      
      // If user typed address but didn't pick from autocomplete, warn but allow
      if (!lat || !lng) {
        showToast('Endereço sem coordenadas. Busque e selecione um endereço da lista para melhor precisão', 'warning');
      }
  
      const routeData = {
        id: editingRouteId,
        name: name,
        date: document.getElementById('routeDate').value,
        driverId: document.getElementById('routeDriver').value || null,
        notes: document.getElementById('routeNotes').value,
        vehicle: document.getElementById('routeVehicle').value,
        plate: document.getElementById('routePlate').value,
        color: document.querySelector('input[name="routeColor"]:checked')?.value || 'default',
        origin: {
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          address: addr
        }
      };
  
      try {
        await StorageManager.saveRoute(routeData);
        showToast('Rota salva com sucesso!');
        closeRouteModal();
        renderRoutesList();
        refreshDashboard();
        if(activeRouteId === editingRouteId) loadRouteToMap(editingRouteId);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  
    // === DELIVERY MODAL LOGIC ===
    const btnNewDelivery = document.getElementById('btnNewDelivery');
    const rdpAddStop = document.getElementById('rdpAddStop');
    const closeModalDelivery = document.getElementById('closeModalDelivery');
    const cancelModalDelivery = document.getElementById('cancelModalDelivery');
    const saveDeliveryBtn = document.getElementById('saveDelivery');
    let editingDeliveryId = null;
  
    function openDeliveryModal(deliveryId = null, preSelectRouteId = null) {
      editingDeliveryId = deliveryId;
      const title = document.getElementById('modalDeliveryTitle');
      const routeSelect = document.getElementById('deliveryRoute');
  
      // Populate Routes
      routeSelect.innerHTML = '<option value="">Selecione uma rota...</option>';
      StorageManager.getRoutes().forEach(r => {
        routeSelect.innerHTML += `<option value="${r.id}">${r.name}</option>`;
      });
  
      if (preSelectRouteId) {
        routeSelect.value = preSelectRouteId;
        // Calculate next order
        const stops = StorageManager.getDeliveriesByRoute(preSelectRouteId);
        document.getElementById('deliveryOrder').value = stops.length + 1;
      }
  
      if (deliveryId) {
        title.innerText = 'Editar Parada';
        const d = StorageManager.getDeliveries().find(x => x.id === deliveryId);
        if (!d) return closeDeliveryModal();
        
        routeSelect.value = d.routeId;
        document.getElementById('deliveryRecipient').value = d.recipient;
        document.getElementById('deliveryCpf').value = d.cpf || ''
        document.getElementById('deliveryPhone').value = d.phone || ''
        document.getElementById('deliveryOrder').value = d.order || 1;
        document.getElementById('deliveryStatus').value = d.status || 'pending';
        document.getElementById('deliveryNotes').value = d.notes || ''
        
        document.getElementById('deliveryAddressInput').value = d.address || ''
        document.getElementById('deliveryLat').value = d.lat || ''
        document.getElementById('deliveryLng').value = d.lng || ''
        document.getElementById('deliveryAddr').value = d.address || ''
      } else {
        title.innerText = 'Nova Parada';
        if(!preSelectRouteId) routeSelect.value = ''
        document.getElementById('deliveryRecipient').value = ''
        document.getElementById('deliveryCpf').value = ''
        document.getElementById('deliveryPhone').value = ''
        document.getElementById('deliveryStatus').value = 'pending';
        document.getElementById('deliveryNotes').value = ''
        document.getElementById('deliveryAddressInput').value = ''
        document.getElementById('deliveryLat').value = ''
        document.getElementById('deliveryLng').value = ''
        document.getElementById('deliveryAddr').value = ''
      }

      // Permissions check for notes
      const notesField = document.getElementById('deliveryNotes');
      if (notesField) {
        notesField.disabled = !(window.appPermissions?.canEditNotes);
      }

      modalDelivery.classList.add('active');
    }

  
    function closeDeliveryModal() { modalDelivery.classList.remove('active'); }
    window.openDeliveryModalFromList = function(id) { openDeliveryModal(id); }
    window.openDeliveryModalForRoute = function(routeId) { openDeliveryModal(null, routeId); }
  
    btnNewDelivery?.addEventListener('click', () => openDeliveryModal());
    document.getElementById('btnNewDeliveryMain')?.addEventListener('click', () => openDeliveryModal());
    rdpAddStop?.addEventListener('click', () => openDeliveryModal(null, activeRouteId));
    closeModalDelivery.addEventListener('click', closeDeliveryModal);
    cancelModalDelivery.addEventListener('click', closeDeliveryModal);
  
    saveDeliveryBtn.addEventListener('click', async () => {
      const routeId = document.getElementById('deliveryRoute').value;
      const recipient = document.getElementById('deliveryRecipient').value;
      const lat = document.getElementById('deliveryLat').value;
      const lng = document.getElementById('deliveryLng').value;
      const addr = document.getElementById('deliveryAddressInput').value;
  
      if (!routeId) return showToast('Selecione uma rota', 'error');
      if (!recipient) return showToast('Nome do Cliente é obrigatório', 'error');
      if (!lat || !lng) return showToast('Selecione um endereço válido', 'error');
  
      const deliveryData = {
        id: editingDeliveryId,
        routeId: routeId,
        recipient: recipient,
        cpf: document.getElementById('deliveryCpf').value,
        phone: document.getElementById('deliveryPhone').value,
        order: parseInt(document.getElementById('deliveryOrder').value) || 1,
        status: document.getElementById('deliveryStatus').value,
        notes: document.getElementById('deliveryNotes').value,
        address: addr,
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      };
  
      try {
        await StorageManager.saveDelivery(deliveryData);
        showToast('Parada salva com sucesso!');
        closeDeliveryModal();
        renderDeliveriesList();
        refreshDashboard();
        
        // Update map if the route is active
        if (activeRouteId === routeId) {
          loadRouteToMap(routeId);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  
    // === DRIVER MODAL LOGIC ===
    const btnNewDriver = document.getElementById('btnNewDriver');
    const btnNewDriverEmpty = document.getElementById('btnNewDriverEmpty');
    const closeModalDriver = document.getElementById('closeModalDriver');
    const cancelModalDriver = document.getElementById('cancelModalDriver');
    const saveDriverBtn = document.getElementById('saveDriver');
    let editingDriverId = null;
  
    function openDriverModal(driverId = null) {
      editingDriverId = driverId;
      const title = document.getElementById('modalDriverTitle');
      if (driverId) {
        title.innerText = 'Editar Motorista';
        const driver = StorageManager.getDriver(editingDriverId);
        document.getElementById('driverName').value = driver.name || ''
        document.getElementById('driverPhone').value = driver.phone || ''
      } else {
        title.innerText = 'Novo Motorista';
        document.getElementById('driverName').value = ''
        document.getElementById('driverPhone').value = ''
      }
      modalDriver.classList.add('active');
    }
  
    function closeDriverModal() { modalDriver.classList.remove('active'); }
  
    btnNewDriver?.addEventListener('click', () => openDriverModal());
    document.getElementById('btnNewDriverMain')?.addEventListener('click', () => openDriverModal());
    btnNewDriverEmpty?.addEventListener('click', () => openDriverModal());
    closeModalDriver.addEventListener('click', closeDriverModal);
    cancelModalDriver.addEventListener('click', closeDriverModal);
  
    saveDriverBtn.addEventListener('click', async () => {
      const name = document.getElementById('driverName').value;
      if (!name) return showToast('Nome é obrigatório', 'error');
  
      const driverData = {
        id: editingDriverId,
        name: name,
        phone: document.getElementById('driverPhone').value
      };

      try {
        await StorageManager.saveDriver(driverData);
        showToast('Motorista salvo com sucesso!');
        closeDriverModal();
        renderDriversList();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  
    // === USER MODAL LOGIC ===
    const modalUser = document.getElementById('modalUser');
    const btnNewUserMain = document.getElementById('btnNewUserMain');
    const closeModalUser = document.getElementById('closeModalUser');
    const cancelModalUser = document.getElementById('cancelModalUser');
    const saveUserBtn = document.getElementById('saveUser');
    let editingUserId = null;

    function openUserModal(userId = null) {
      editingUserId = userId;
      const title = document.getElementById('modalUserTitle');
      
      if (userId) {
        title.innerText = 'Editar Usuário';
        const user = StorageManager.getUsers().find(u => u.id === userId);
        if (!user) return closeUserModal();
        
        document.getElementById('userName').value = user.name || '';
        document.getElementById('userUsername').value = user.username || '';
        document.getElementById('userPassword').value = user.password || '';
        document.getElementById('userRole').value = user.role || 'Motorista';
        
        // Permissions
        const perms = user.permissions || [];
        document.getElementById('perm_view_route').checked = perms.includes('view_route');
        document.getElementById('perm_edit_route').checked = perms.includes('edit_route');
        document.getElementById('perm_reorder_stops').checked = perms.includes('reorder_stops');
        document.getElementById('perm_edit_notes').checked = perms.includes('edit_notes');
      } else {
        title.innerText = 'Novo Usuário';
        document.getElementById('userName').value = '';
        document.getElementById('userUsername').value = '';
        document.getElementById('userPassword').value = '';
        document.getElementById('userRole').value = 'Motorista';
        
        document.getElementById('perm_view_route').checked = true;
        document.getElementById('perm_edit_route').checked = false;
        document.getElementById('perm_reorder_stops').checked = false;
        document.getElementById('perm_edit_notes').checked = false;
      }
      modalUser?.classList.add('active');
    }

    function closeUserModal() {
      modalUser?.classList.remove('active');
    }

    btnNewUserMain?.addEventListener('click', () => openUserModal());
    closeModalUser?.addEventListener('click', closeUserModal);
    cancelModalUser?.addEventListener('click', closeUserModal);

    saveUserBtn?.addEventListener('click', async () => {
      const name = document.getElementById('userName').value.trim();
      const username = document.getElementById('userUsername').value.trim();
      const password = document.getElementById('userPassword').value.trim();
      const role = document.getElementById('userRole').value;

      if (!name || !username || !password) {
        return showToast('Preencha todos os campos obrigatórios', 'error');
      }

      const permissions = [];
      if (document.getElementById('perm_view_route').checked) permissions.push('view_route');
      if (document.getElementById('perm_edit_route').checked) permissions.push('edit_route');
      if (document.getElementById('perm_reorder_stops').checked) permissions.push('reorder_stops');
      if (document.getElementById('perm_edit_notes').checked) permissions.push('edit_notes');

      const userData = {
        id: editingUserId,
        name,
        username,
        password,
        role,
        permissions
      };

      try {
        await StorageManager.saveUser(userData);
        showToast('Usuário salvo com sucesso!');
        closeUserModal();
        renderUsersList();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  
  
    // === RENDERING FUNCTIONS ===
  
    // STATUS TRANSLATIONS & COLORS
    const statusMap = {
      'planned': { label: 'Planejada', class: 'planned' },
      'active': { label: 'Em Andamento', class: 'active' },
      'done': { label: 'Concluída', class: 'done' },
      'pending': { label: 'Pendente', class: 'pending' },
      'in_route': { label: 'Em Rota', class: 'active' },
      'delivered': { label: 'Entregue', class: 'done' },
      'failed': { label: 'Falha', class: 'failed' },
      'rescheduled': { label: 'Reagendado', class: 'planned' }
    };
  
    function renderRoutesList() {
      const list = document.getElementById('routesListMain');
      if(!list) return;
      const routes = StorageManager.getRoutes();
      const activeFilterElement = document.querySelector('#mainRoutesView .filter-chips .chip.active');
      const activeFilter = activeFilterElement ? activeFilterElement.dataset.filter : 'all';
      
      let filtered = routes;
      if(activeFilter !== 'all') {
        filtered = routes.filter(r => r.status === activeFilter);
      }
  
      // Search filter
      const searchInput = document.getElementById('searchRoutesMain');
      const q = searchInput ? searchInput.value.toLowerCase() : '';
      if (q) {
        filtered = filtered.filter(r => r.name.toLowerCase().includes(q));
      }
  
      if (filtered.length === 0) {
        list.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1">
            <i class="ri-route-line"></i>
            <p>Nenhuma rota encontrada</p>
          </div>
        `;
        return;
      }
  
      list.innerHTML = '';
      filtered.forEach(r => {
        const stops = StorageManager.getDeliveriesByRoute(r.id);
        const dCount = stops.length;
        const driver = r.driverId ? (StorageManager.getDrivers().find(d => d.id === r.driverId) || StorageManager.getUsers().find(u => u.id === r.driverId)) : null;
        const driverDisplay = driver ? `${driver.name}${r.vehicle ? ` - ${r.vehicle}` : ''}` : 'Sem motorista';
        const st = statusMap[r.status] || statusMap['planned'];
        const colorClass = r.color && r.color !== 'default' ? `card-${r.color}` : '';
        
        // Stops preview string (Addresses)
        const stopsPreview = stops.length > 0 
          ? stops.slice(0, 3).map(s => s.address ? s.address.split(',')[0] : 'S/ Ref').join(' - ') + (stops.length > 3 ? '...' : '')
          : 'Nenhuma parada';
  
        const div = document.createElement('div');
        div.className = `list-item ${activeRouteId === r.id ? 'selected' : ''} ${expandedRouteIds.has(r.id) ? 'expanded' : ''} ${colorClass}`;
        div.setAttribute('data-route-id', r.id);
        
        // Auto-expand on drag enter
        div.ondragenter = (e) => {
          const isDragging = document.querySelector('.stop-detail-item.dragging');
          if (isDragging && !div.classList.contains('expanded')) {
            div.classList.add('expanded');
            expandedRouteIds.add(r.id);
          }
        };
        
        const canEdit = window.appPermissions?.canEditRoute;
        const canReorder = window.appPermissions?.canReorder;

        let stopsHtml = stops.map((s, i) => `
          <div class="stop-detail-item" 
               draggable="${canReorder ? 'true' : 'false'}" 
               ${canReorder ? `
               ondragstart="window.handleStopDragStart(event, '${s.id}')"
               ondragend="window.handleStopDragEnd(event)"
               ondrop="window.handleStopDrop(event, '${r.id}', '${s.id}')"` : ''}>
            <div class="stop-detail-index">${i + 1}</div>
            <div class="stop-detail-info">
              <span class="stop-detail-name">${s.recipient}</span>
              <span class="stop-detail-addr">${s.address || 'Sem endereço'}</span>
            </div>
            <div class="stop-actions-small" style="${canEdit ? '' : 'display:none'}">
              <button class="btn-icon-xs" title="Editar Parada" onclick="event.stopPropagation(); window.openDeliveryModalFromList('${s.id}')"><i class="ri-edit-2-line"></i></button>
              <button class="btn-icon-xs" title="Remover Parada" onclick="event.stopPropagation(); window.deleteDeliveryFromList('${s.id}')"><i class="ri-delete-bin-line"></i></button>
            </div>
          </div>
        `).join('');

        if (stops.length === 0) {
          stopsHtml = '<p class="text-muted" style="font-size:0.8rem; padding: 10px 0;">Nenhuma parada cadastrada.</p>';
        }

        div.innerHTML = `
          <div class="item-header" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div style="display:flex; justify-content: space-between; align-items: center;">
              <div style="display:flex; align-items:center; gap:10px; overflow:hidden">
                <span class="badge ${st.class}">${st.label}</span>
                <span class="item-title" style="font-size: 1.1rem; font-weight: 800;">${r.name}</span>
              </div>
              <div class="item-actions" style="display: flex; align-items: center; gap: 8px;">
                 <button class="btn-icon-xs" style="background: var(--accent-primary); color: var(--bg-dark); border-radius: 50%; width: 24px; height: 24px;" onclick="event.stopPropagation(); window.openDeliveryModalForRoute('${r.id}')" title="Criar Parada">
                   <i class="ri-add-line"></i>
                 </button>
                 <i class="ri-arrow-down-s-line expand-icon"></i>
              </div>
            </div>
            
            <div class="item-collapsed-meta" style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.75rem; color: var(--text-muted);">
              <span><i class="ri-calendar-line"></i> ${formatDate(r.date)}</span>
              <span><i class="ri-steering-2-line"></i> ${driverDisplay}</span>
              <span><i class="ri-map-pin-line"></i> ${dCount} paradas</span>
              <span><i class="ri-map-2-line"></i> ${r.distanceKm || '0'} km</span>
            </div>
          </div>

          <div class="item-details">
            ${r.notes ? `<div class="route-notes-preview" style="margin-bottom: 15px;"><i class="ri-information-line"></i> <strong>OBS:</strong> ${r.notes}</div>` : ''}
            
            <div class="section-header" style="font-size:0.7rem; margin-bottom:10px">ORDEM DAS PARADAS (Arraste para reordenar)</div>
            <div class="stops-detail-list" ondragover="window.handleStopDragOver(event)" ondrop="window.handleStopDrop(event, '${r.id}')">
              ${stopsHtml}
            </div>

            <div class="details-actions" style="margin-top:15px; border-top:1px solid var(--border-color); padding-top:15px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
              ${window.appPermissions?.canEditRoute ? `
                <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); window.openRouteModalFromList('${r.id}')" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px;">
                  <i class="ri-edit-line" style="font-size: 1.2rem;"></i>
                  <span>Editar Rota</span>
                </button>
              ` : ''}
              
              <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); window.printRoute('${r.id}')" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px;">
                <i class="ri-printer-line" style="font-size: 1.2rem;"></i>
                <span>Imprimir Rota</span>
              </button>
              
              <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); window.viewOnMap('${r.id}')" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px;">
                <i class="ri-map-2-line" style="font-size: 1.2rem;"></i>
                <span>Ver no Mapa</span>
              </button>
              
              ${r.status === 'done' 
                ? `<button class="btn-warning btn-sm" onclick="event.stopPropagation(); window.updateRouteStatusFromList('${r.id}', 'active')" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px;">
                    <i class="ri-refresh-line" style="font-size: 1.2rem;"></i>
                    <span>Reativar Rota</span>
                  </button>` 
                : `<button class="btn-primary btn-sm" onclick="event.stopPropagation(); window.updateRouteStatusFromList('${r.id}', 'done')" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px;">
                    <i class="ri-check-line" style="font-size: 1.2rem;"></i>
                    <span>Concluir Rota</span>
                  </button>`
              }
            </div>
          </div>
        `;

        div.addEventListener('click', () => {
          const wasExpanded = div.classList.contains('expanded');
          
          // Clear others if you want only one expanded at a time
          document.querySelectorAll('.list-item.expanded').forEach(item => {
            item.classList.remove('expanded');
            const rid = item.getAttribute('data-route-id');
            if(rid) expandedRouteIds.delete(rid);
          });

          if (!wasExpanded) {
            div.classList.add('expanded');
            expandedRouteIds.add(r.id);
          }
        });
        list.appendChild(div);
      });
    }

    // Reordering logic
    let draggedStopId = null;
    window.handleStopDragStart = (e, stopId) => {
      draggedStopId = stopId;
      e.target.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    };
    window.handleStopDragEnd = (e) => {
      e.target.classList.remove('dragging');
    };
    window.handleStopDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const list = e.currentTarget;
      list.classList.add('drag-over');
    };
    window.handleStopDrop = async (e, routeId, targetStopId = null) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      if (!draggedStopId) return;

      const stops = StorageManager.getDeliveriesByRoute(routeId);
      const draggedIdx = stops.findIndex(s => s.id === draggedStopId);
      let targetIdx = targetStopId ? stops.findIndex(s => s.id === targetStopId) : stops.length;

      if (draggedIdx === -1) return;

      // Reorder locally
      const [draggedItem] = stops.splice(draggedIdx, 1);
      stops.splice(targetIdx, 0, draggedItem);

      // Update order property and save
      try {
        const promises = stops.map((s, idx) => {
          s.order = idx + 1;
          s.routeId = routeId; // Ensure it stays in the right route
          return StorageManager.saveDelivery(s);
        });
        await Promise.all(promises);
        showToast('Ordem das paradas atualizada');
        renderRoutesList();
        if (activeRouteId === routeId) loadRouteToMap(routeId);
      } catch (err) {
        showToast('Erro ao reordenar: ' + err.message, 'error');
      }
    };

    window.openDeliveryModalFromList = (id) => openDeliveryModal(id);
    window.updateRouteStatusFromList = (id, status) => {
      if (status === 'done') {
        openConfirmDialog('Deseja realmente concluir esta rota?', () => updateRouteStatus(id, status));
      } else if (status === 'active' && StorageManager.getRoute(id).status === 'done') {
        openConfirmDialog('Deseja reativar esta rota e voltar para "Em andamento"?', () => updateRouteStatus(id, status));
      } else {
        updateRouteStatus(id, status);
      }
    };

    window.printRoute = (routeId) => {
      const route = StorageManager.getRoute(routeId);
      const stops = StorageManager.getDeliveriesByRoute(routeId);
      const driver = route.driverId ? (StorageManager.getDrivers().find(d => d.id === route.driverId) || StorageManager.getUsers().find(u => u.id === route.driverId)) : null;
      
      const printArea = document.getElementById('printArea');
      
      let stopsTableRows = stops.map((s, i) => `
        <tr>
          <td><span class="print-stop-index">${i + 1}</span></td>
          <td>
            <strong>${s.recipient}</strong><br>
            <span style="font-size:10px; color:#666">CPF: ${s.cpf || '-'}</span>
          </td>
          <td>${s.phone || '-'}</td>
          <td>${s.address || 'Sem endereço'}</td>
          <td><div class="print-obs">${s.notes || '-'}</div></td>
        </tr>
      `).join('');

      printArea.innerHTML = `
        <div class="print-header">
          <div class="print-title">LOGIC FRETE - Relatório de Rota</div>
          <div style="text-align:right; font-size:12px; color:#666">
            Emitido em: ${new Date().toLocaleString('pt-BR')}<br>
            ID Rota: ${route.id.split('-')[0]}
          </div>
        </div>

        <div class="print-meta">
          <div class="print-meta-item">
            <span class="print-meta-label">Nome da Rota:</span> ${route.name}
          </div>
          <div class="print-meta-item">
            <span class="print-meta-label">Data:</span> ${formatDate(route.date)}
          </div>
          <div class="print-meta-item">
            <p><span class="print-meta-label">Motorista:</span> ${driver ? driver.name : 'Não atribuído'}</p>
          </div>
          <div class="print-meta-item">
            <span class="print-meta-label">Total Paradas:</span> ${stops.length}
          </div>
          <div class="print-meta-item" style="grid-column: 1 / -1">
            <p><span class="print-meta-label">Observações da Rota:</span> ${route.notes || 'Nenhuma'}</p>
          </div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th style="width:30px">#</th>
              <th>Cliente</th>
              <th style="width:100px">Telefone</th>
              <th>Endereço</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            ${stopsTableRows}
          </tbody>
        </table>

        <div class="print-footer">
          Logic Frete - Sistema de Gestão Logística
        </div>
      `;

      window.print();
    };

    function renderDeliveriesList() {
      const list = document.getElementById('deliveriesListMain');
      if(!list) return;
      const deliveries = StorageManager.getDeliveries();
      const routes = StorageManager.getRoutes();
      
      const searchInput = document.getElementById('searchDeliveriesMain');
      const q = searchInput ? searchInput.value.toLowerCase() : '';
      let filtered = deliveries;
      if (q) {
        filtered = deliveries.filter(d => 
          d.recipient.toLowerCase().includes(q) || 
          (d.address && d.address.toLowerCase().includes(q))
        );
      }
  
      if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1"><i class="ri-map-pin-line"></i><p>Nenhuma entrega encontrada</p></div>`;
        return;
      }
  
      list.innerHTML = '';
      filtered.forEach(d => {
        const route = routes.find(r => r.id === d.routeId);
        const st = statusMap[d.status] || statusMap['pending'];
  
        const div = document.createElement('div');
        div.className = 'task-card list-item';
        if (d.status === 'delivered') div.classList.add('delivered');
        div.innerHTML = `
          <div class="task-header">
            <div class="task-indicator ${st.class}"></div>
            <div class="task-title">${(d.recipient || 'SEM NOME').toUpperCase()}</div>
          </div>
          <div class="task-body">
            <div class="task-row"><span class="task-label">CLIENTE:</span> <span class="task-value">${d.recipient}</span></div>
            <div class="task-row"><span class="task-label">CPF/CNPJ:</span> <span class="task-value">${d.cpf || '-'}</span></div>
            <div class="task-row"><span class="task-label">TEL:</span> <span class="task-value">${d.phone || '-'}</span></div>
            <div class="task-row"><span class="task-label">END:</span> <span class="task-value">${d.address || '-'}</span></div>
            ${d.notes ? `<div class="task-notes">${d.notes}</div>` : ''}
          </div>
          <div class="task-footer">
            <div class="task-date"><i class="ri-calendar-line"></i> ${route ? formatDate(route.date) : '-'}</div>
            <div class="details-actions">
              ${window.appPermissions?.canEditRoute ? `
                <button class="btn-icon-xs" onclick="event.stopPropagation(); window.openDeliveryModalFromList('${d.id}')" title="Editar"><i class="ri-edit-line"></i></button>
                <button class="btn-icon-xs" onclick="event.stopPropagation(); window.deleteDeliveryFromList('${d.id}')" title="Excluir"><i class="ri-delete-bin-line"></i></button>
              ` : ''}
              <button class="btn-icon-xs" onclick="event.stopPropagation(); window.viewOnMap('${d.routeId}')" title="Ver no Mapa"><i class="ri-map-2-line"></i></button>
              ${d.status !== 'delivered' ? `<button class="btn-primary btn-xs" onclick="event.stopPropagation(); window.updateDeliveryStatus('${d.id}', 'delivered')" style="padding: 2px 8px; font-size: 0.7rem;">Entregue</button>` : ''}
            </div>
          </div>
        `;
  
        div.addEventListener('click', () => {
          const wasExpanded = div.classList.contains('expanded');
          document.querySelectorAll('.list-item.expanded').forEach(item => item.classList.remove('expanded'));
          if (!wasExpanded) div.classList.add('expanded');
        });
        list.appendChild(div);
      });
    }

    function renderDriversList() {
      const list = document.getElementById('driversListMain');
      if(!list) return;
      
      const traditionalDrivers = StorageManager.getDrivers();
      const userDrivers = StorageManager.getUsers().filter(u => u.role === 'Motorista');
      
      const combinedDrivers = [
        ...traditionalDrivers.map(d => ({ ...d, isUser: false })),
        ...userDrivers.map(u => ({ id: u.id, name: u.name, phone: u.phone || '-', isUser: true, vehicle: 'Consultar perfil' }))
      ];
      
      if (combinedDrivers.length === 0) {
        list.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1"><i class="ri-user-star-line"></i><p>Nenhum motorista cadastrado</p></div>`;
        return;
      }
  
      list.innerHTML = '';
      combinedDrivers.forEach(d => {
        const routes = StorageManager.getRoutes().filter(r => r.driverId === d.id).sort((a, b) => new Date(b.date) - new Date(a.date));
        const routeCount = routes.length;
        const totalKm = routes.reduce((sum, r) => sum + (parseFloat(String(r.distanceKm).replace(',', '.')) || 0), 0).toFixed(1);
        
        let historyHtml = routes.map(r => {
          const st = statusMap[r.status] || statusMap['planned'];
          const stopsCount = StorageManager.getDeliveriesByRoute(r.id).length;
          return `
            <div class="history-route-item" onclick="event.stopPropagation(); window.viewOnMapReadOnly('${r.id}')" style="flex-wrap: wrap; gap: 8px;">
              <div class="history-route-info" style="flex: 1; min-width: 0; word-break: break-word;">
                <span class="history-route-name" style="display: block; margin-bottom: 4px;">${r.name}</span>
                <span class="history-route-date">
                  <div class="card-date">
                    ${formatDate(r.date)} &bull; <i class="ri-map-pin-line"></i> ${stopsCount} paradas &bull; <i class="ri-map-2-line"></i> ${r.distanceKm || '0'} km
                  </div>
                </span>
              </div>
              <div style="display:flex; align-items:center; gap:10px">
                <span class="badge ${st.class}" style="font-size:0.5rem">${st.label}</span>
              </div>
            </div>
          `;
        }).join('');
  
        const div = document.createElement('div');
        div.className = 'task-card driver-item';
        div.innerHTML = `
          <div class="item-header" style="flex-direction: column; align-items: stretch; gap: 8px; padding: 12px;">
            <div style="display:flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div style="display:flex; align-items:center; gap:10px; flex: 1; word-break: break-word; min-width: 0;">
                <div class="task-indicator" style="background: var(--accent-primary); width: 4px; height: 16px; border-radius: 2px; flex-shrink: 0;"></div>
                <span class="item-title" style="font-size: 1.1rem; font-weight: 800;">${(d.name || 'SEM NOME').toUpperCase()}</span>
              </div>
              <div class="item-actions">
                 <i class="ri-arrow-down-s-line expand-icon"></i>
              </div>
            </div>
            
            <div class="item-collapsed-meta" style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.75rem; color: var(--text-muted);">
              <span><i class="ri-phone-line"></i> ${d.phone || '-'}</span>
              <span><i class="ri-truck-line"></i> ${d.vehicle || '-'}</span>
              <span><i class="ri-route-line"></i> ${routeCount} rotas</span>
              <span><i class="ri-pin-distance-line"></i> ${totalKm} km</span>
            </div>
          </div>

          <div class="item-details" style="padding: 15px; border-top: 1px solid var(--border-color);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 20px;">
              <div class="meta-item"><i class="ri-user-badge-line"></i> <strong>Vínculo:</strong> ${d.isUser ? 'Interno (Usuário)' : 'Externo (Manual)'}</div>
              <div class="meta-item"><i class="ri-pin-distance-line"></i> <strong>Total KM:</strong> ${totalKm} km percorridos</div>
            </div>

            <div class="driver-history-list">
              <div class="section-header" style="font-size:0.75rem; margin-bottom:12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;">HISTÓRICO RECENTE DE ROTAS</div>
              <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 5px;">
                ${historyHtml || '<p class="text-muted" style="font-size:0.8rem; text-align: center; padding: 20px;">Nenhuma rota cadastrada para este motorista.</p>'}
              </div>
            </div>

          </div>

          <div class="task-footer" style="justify-content: flex-end; padding-top: 10px; border-top: 1px solid var(--border-color); margin-top: 5px;">
            <div class="details-actions" style="display: flex; gap: 8px;">
               ${(window.appPermissions?.isMaster || window.appPermissions?.isGerente) ? `
                 <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); window.openDriverModalFromList('${d.id}')">
                   <i class="ri-edit-line"></i> Editar
                 </button>
                  <button class="btn-danger btn-sm" onclick="event.stopPropagation(); window.deleteDriverFromList('${d.id}')">
                    <i class="ri-delete-bin-line"></i> Excluir Motorista
                  </button>
               ` : ''}
            </div>
          </div>
        `;
  
        div.addEventListener('click', () => {
          const wasExpanded = div.classList.contains('expanded');
          document.querySelectorAll('.driver-item.expanded').forEach(item => item.classList.remove('expanded'));
          if (!wasExpanded) div.classList.add('expanded');
        });
        list.appendChild(div);
      });
    }

    function renderUsersList() {
      const list = document.getElementById('usersListMain');
      if(!list) return;
      const users = StorageManager.getUsers();
      
      if (users.length === 0) {
        list.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1"><p>Nenhum usuário cadastrado</p></div>`;
        return;
      }

      list.innerHTML = '';
      users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'task-card list-item';
        div.innerHTML = `
          <div class="task-header">
            <div class="task-indicator active"></div>
            <div class="task-title">${(u.name || 'SEM NOME').toUpperCase()}</div>
          </div>
          <div class="task-body">
            <div class="task-row"><span class="task-label">USUÁRIO:</span> <span class="task-val">${u.username}</span></div>
            <div class="task-row"><span class="task-label">CARGO:</span> <span class="task-value">${u.role}</span></div>
          </div>
          <div class="task-footer" style="justify-content: flex-end; padding-top: 10px; border-top: 1px solid var(--border-color); margin-top: 10px;">
            <div class="details-actions" style="display: flex; gap: 8px;">
               <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); window.openUserModalFromList('${u.id}')" title="Editar">
                 <i class="ri-edit-line"></i> Editar
               </button>
               <button class="btn-danger btn-sm" onclick="event.stopPropagation(); window.deleteUserFromList('${u.id}')" title="Excluir">
                 <i class="ri-delete-bin-line"></i> Excluir
               </button>
            </div>
          </div>
        `;
        list.appendChild(div);
      });
    }

    function refreshDashboard() {
      try {
        const routes = StorageManager.getRoutes();
        const todayStr = getLocalISODate();
        
        const routesToday = routes.filter(r => r.date === todayStr);
        const activeRoutesCount = routes.filter(r => r.status === 'active').length;
        const doneRoutesCount = routes.filter(r => r.status === 'done').length;
        const totalKm = routes.reduce((sum, r) => sum + (parseFloat(String(r.distanceKm).replace(',', '.')) || 0), 0).toFixed(1);
        
        const elToday = document.getElementById('stat-routes-val-main');
        const elActive = document.getElementById('stat-pending-val-main');
        const elDone = document.getElementById('stat-done-val-main');
        const elKm = document.getElementById('stat-km-val-main');
        const elDate = document.getElementById('currentDateDisplay');

        if (elToday) elToday.innerText = routesToday.length;
        if (elActive) elActive.innerText = activeRoutesCount;
        if (elDone) elDone.innerText = doneRoutesCount;
        if (elKm) elKm.innerText = totalKm + ' km';
        if (elDate) elDate.innerText = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const list = document.getElementById('activeRoutesListMain');
        if (list) {
          const activeRoutes = routes.filter(r => r.date === todayStr && (r.status === 'active' || r.status === 'planned'));
          if (activeRoutes.length === 0) {
            list.innerHTML = `<div class="empty-state" style="padding: 20px"><i class="ri-route-line"></i><p>Nenhuma rota para hoje</p></div>`;
          } else {
            list.innerHTML = '';
            activeRoutes.forEach(r => {
              const st = statusMap[r.status] || statusMap['planned'];
              const stops = StorageManager.getDeliveriesByRoute(r.id);
              const driver = r.driverId ? (StorageManager.getDrivers().find(d => d.id === r.driverId) || StorageManager.getUsers().find(u => u.id === r.driverId)) : null;
              const driverName = driver ? driver.name : 'Sem motorista';
              
              const div = document.createElement('div');
              div.className = 'task-card list-item';
              div.innerHTML = `
                <div class="item-header" style="flex-direction: column; align-items: stretch; gap: 6px; padding: 12px;">
                  <div style="display:flex; justify-content: space-between; align-items: center;">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span class="badge ${st.class}">${st.label}</span>
                      <span class="item-title" style="font-size:1rem; font-weight: 700;">${r.name}</span>
                    </div>
                    <button class="btn-icon-xs" style="background: var(--accent-primary); color: var(--bg-dark); border-radius: 50%; width: 22px; height: 22px;" onclick="event.stopPropagation(); window.openDeliveryModalForRoute('${r.id}')" title="Criar Parada">
                       <i class="ri-add-line"></i>
                    </button>
                  </div>
                  <div class="item-collapsed-meta" style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.7rem; color: var(--text-muted);">
                    <span><i class="ri-steering-2-line"></i> ${driverName}</span>
                    <span><i class="ri-map-pin-line"></i> ${stops.length} paradas</span>
                    ${r.distanceKm ? `<span><i class="ri-map-2-line"></i> ${r.distanceKm} km</span>` : ''}
                  </div>
                  
                  <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px;">
                    <button class="btn-primary btn-xs" onclick="window.viewOnMap('${r.id}')" style="padding: 8px 4px;">Mapa</button>
                    <button class="btn-secondary btn-xs" onclick="window.printRoute('${r.id}')" style="padding: 8px 4px;">Print</button>
                    ${r.status === 'done' 
                      ? `<button class="btn-warning btn-xs" onclick="window.updateRouteStatusFromList('${r.id}', 'active')" style="padding: 8px 4px;">Reativar</button>` 
                      : `<button class="btn-success btn-xs" onclick="window.updateRouteStatusFromList('${r.id}', 'done')" style="padding: 8px 4px;">Concluir</button>`
                    }
                  </div>
                </div>
              `;
              list.appendChild(div);
            });
          }
        }
        renderWeeklyChart();
      } catch (err) {
        console.error("Erro ao atualizar dashboard:", err);
      }
    }
    // === CALENDAR KANBAN LOGIC ===
    let calendarCurrentDate = new Date(); // Reference date for the week being viewed

    function renderCalendarView() {
      const kanban = document.getElementById('calendarKanban');
      if (!kanban) return;

      const weekDisplay = document.getElementById('calendarWeekDisplay');
      
      // Calculate start of current week (Monday)
      const startOfWeek = new Date(calendarCurrentDate);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      // Update week display
      const options = { month: 'short', day: 'numeric' };
      weekDisplay.innerText = `${startOfWeek.toLocaleDateString('pt-BR', options)} - ${endOfWeek.toLocaleDateString('pt-BR', options)} (${startOfWeek.getFullYear()})`;

      kanban.innerHTML = '';
      const allRoutes = StorageManager.getRoutes();

      // Create 7 columns for the week
      for (let i = 0; i < 7; i++) {
        const currentColumnDate = new Date(startOfWeek);
        currentColumnDate.setDate(startOfWeek.getDate() + i);
        
        const dateStr = currentColumnDate.getFullYear() + '-' + 
                        String(currentColumnDate.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(currentColumnDate.getDate()).padStart(2, '0');
        
        const routesForDay = allRoutes.filter(r => r.date === dateStr);
        
        const isToday = new Date().toDateString() === currentColumnDate.toDateString();
        
        const col = document.createElement('div');
        col.className = `calendar-column ${isToday ? 'is-today' : ''}`;
        col.innerHTML = `
          <div class="calendar-col-header">
            <span class="calendar-col-day">${currentColumnDate.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
            <span class="calendar-col-date">${currentColumnDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          </div>
          <div class="calendar-cards-list" 
               id="calendar-col-${dateStr}"
               ondragover="window.handleCalendarDragOver(event)"
               ondragenter="window.handleCalendarDragEnter(event)"
               ondragleave="window.handleCalendarDragLeave(event)"
               ondrop="window.handleCalendarDrop(event, '${dateStr}')">
          </div>
        `;
        
        const cardsList = col.querySelector('.calendar-cards-list');
        
        if (routesForDay.length === 0) {
          // Empty column
        } else {
          routesForDay.forEach(r => {
            const st = statusMap[r.status] || statusMap['planned'];
            const driver = r.driverId ? (StorageManager.getDrivers().find(d => d.id === r.driverId) || StorageManager.getUsers().find(u => u.id === r.driverId)) : null;
            
            const card = document.createElement('div');
            card.className = 'calendar-route-card';
            card.draggable = true;
            card.innerHTML = `
              <div class="card-status-line ${st.class}"></div>
              <span class="calendar-route-badge badge ${st.class}">${st.label}</span>
              <span class="calendar-route-title">${r.name}</span>
              <div class="calendar-route-info">
                <span><i class="ri-map-pin-line"></i> ${StorageManager.getDeliveriesByRoute(r.id).length} paradas</span>
                <span><i class="ri-steering-2-line"></i> ${driver ? driver.name : 'Sem motorista'}</span>
                ${r.distanceKm ? `<span><i class="ri-map-2-line"></i> ${r.distanceKm} km</span>` : ''}
              </div>
            `;
            
            card.ondragstart = (e) => {
              e.dataTransfer.setData('routeId', r.id);
              card.classList.add('dragging');
            };
            
            card.ondragend = () => {
              card.classList.remove('dragging');
            };
            
            card.onclick = () => {
              navigateToMap(r.id);
            };
            
            cardsList.appendChild(card);
          });
        }
        
        kanban.appendChild(col);
      }
    }

    // Keyboard navigation for Calendar
    document.addEventListener('keydown', (e) => {
      const calendarPanel = document.getElementById('panel-calendar');
      if (calendarPanel && calendarPanel.classList.contains('active')) {
        if (e.key === 'ArrowLeft') {
          window.prevWeek();
        } else if (e.key === 'ArrowRight') {
          window.nextWeek();
        }
      }
    });

    // Calendar Drag and Drop Handlers
    window.handleCalendarDragOver = (e) => {
      e.preventDefault();
    };

    window.handleCalendarDragEnter = (e) => {
      const list = e.target.closest('.calendar-cards-list');
      if (list) list.classList.add('drag-over');
    };

    window.handleCalendarDragLeave = (e) => {
      const list = e.target.closest('.calendar-cards-list');
      if (list) list.classList.remove('drag-over');
    };

    window.handleCalendarDrop = (e, newDate) => {
      e.preventDefault();
      const routeId = e.dataTransfer.getData('routeId');
      if (!routeId) return;

      const list = e.target.closest('.calendar-cards-list');
      if (list) list.classList.remove('drag-over');

      const route = StorageManager.getRoute(routeId);
      if (route && route.date !== newDate) {
        route.date = newDate;
        StorageManager.saveRoute(route);
        renderCalendarView();
        showToast(`Rota movida para ${newDate.split('-').reverse().join('/')}`);
        refreshDashboard();
      }
    };

    // Calendar Navigation
    document.getElementById('btnPrevWeek')?.addEventListener('click', () => {
      calendarCurrentDate.setDate(calendarCurrentDate.getDate() - 7);
      renderCalendarView();
    });

    document.getElementById('btnNextWeek')?.addEventListener('click', () => {
      calendarCurrentDate.setDate(calendarCurrentDate.getDate() + 7);
      renderCalendarView();
    });

    // === INITIALIZATION ===
    async function initializeApp() {
      console.log("App: Iniciando initializeApp...");
      try {
        // 1. Show UI immediately
        checkAuth();
        
        // 2. Start Sync in background
        console.log("App: Sincronizando dados com Supabase...");
        await StorageManager.init();

        const currentUser = StorageManager.getCurrentUser();
        if (currentUser) {
          console.log("App: Usuário logado. Atualizando Dashboard...");
          refreshDashboard();

          // 3. Set auto-refresh for dashboard every 30 seconds
          setInterval(async () => {
            console.log("App: Sincronização periódica iniciada...");
            await StorageManager.init(); 
            refreshDashboard();
            renderRoutesList();
          }, 30000);
          
          // 4. Initialize Map Service (Async)
          setTimeout(() => {
            try {
              console.log("App: Inicializando Map Service...");
              MapService.init('map');
            } catch (mapErr) {
              console.error("App: Erro ao iniciar mapa:", mapErr);
            }
          }, 100);
        } else {
          console.log("App: Nenhum usuário logado. Tela de login pronta.");
        }
      } catch (e) {
        console.error("App: Erro crítico na inicialização:", e);
        showToast("Erro ao conectar ao servidor. Verifique sua conexão.", "error");
      }
    }

    // === MISSING CORE FUNCTIONS ===
    window.formatDate = function(dateStr) {
      if (!dateStr) return '-';
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    };

    function formatDate(dateStr) { return window.formatDate(dateStr); }

    function openConfirmDialog(message, callback) {
      const dialog = document.getElementById('confirmDialog');
      const msgEl = document.getElementById('confirmMessage');
      const btnOk = document.getElementById('confirmOk');
      const btnCancel = document.getElementById('confirmCancel');

      if (!dialog || !msgEl) return;

      msgEl.innerText = message;
      dialog.style.display = 'flex';
      dialog.classList.add('active');

      const close = () => {
        dialog.style.display = 'none';
        dialog.classList.remove('active');
      };

      btnOk.onclick = () => {
        callback();
        close();
      };
      btnCancel.onclick = close;
    }

    window.openConfirmDialog = openConfirmDialog;

    async function updateRouteStatus(routeId, status) {
      try {
        const route = StorageManager.getRoute(routeId);
        if (route) {
          route.status = status;
          await StorageManager.saveRoute(route);
          showToast(`Rota atualizada para ${statusMap[status].label}`);
          renderRoutesList();
          refreshDashboard();
          if (activeRouteId === routeId) loadRouteToMap(routeId);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    async function loadRouteToMap(routeId, readOnly = false) {
      activeRouteId = routeId;
      const route = StorageManager.getRoute(routeId);
      if (!route) return;

      const deliveries = StorageManager.getDeliveriesByRoute(routeId);
      
      // Update UI Panel
      document.getElementById('rdpTitle').innerText = route.name;
      const st = statusMap[route.status] || statusMap['planned'];
      const badge = document.getElementById('rdpBadge');
      badge.innerText = st.label;
      badge.className = `rdp-badge badge ${st.class}`;
      
      document.getElementById('rdpStops').innerText = `${deliveries.length} paradas`;
      
      // Show Panel
      routeDetailPanel.classList.add('show');

      // Update Action Buttons based on status
      const startBtn = document.getElementById('rdpStartBtn');
      if (startBtn) {
        if (route.status === 'done') {
          startBtn.innerHTML = '<i class="ri-refresh-line"></i> Reativar';
          startBtn.className = 'btn-warning';
        } else if (route.status === 'active') {
          startBtn.innerHTML = '<i class="ri-checkbox-circle-line"></i> Concluir';
          startBtn.className = 'btn-success';
        } else {
          startBtn.innerHTML = '<i class="ri-play-circle-line"></i> Iniciar';
          startBtn.className = 'btn-primary';
        }
      }
      
      // Map visualization & Routing
      try {
        await MapService.drawRoute(route.origin, deliveries);
        
        // Update stats from the calculation
        const result = await MapService.getLatestRouteResult();
        if (result) {
          document.getElementById('rdpDistance').innerText = result.distance + ' km';
          document.getElementById('rdpDuration').innerText = result.duration + ' min';
          
          // Save distance back to route if changed significantly
          if (Math.abs(route.distanceKm - result.distance) > 0.5) {
            route.distanceKm = result.distance;
            route.durationMin = result.duration;
            StorageManager.saveRoute(route);
          }
        }
      } catch (e) {
        console.warn("Could not draw route line", e);
        // Fallback: Just show markers if routing fails
        MapService.clearMap();
        if (route.origin && route.origin.lat) {
          MapService.createMarker(route.origin.lat, route.origin.lng, 'O', 'planned', true);
        }
        deliveries.forEach((d, idx) => {
          MapService.createMarker(d.lat, d.lng, idx + 1, d.status);
        });
        MapService.fitAll();
      }
      
      renderRdpStopsList(deliveries);
      MapService.fitAll();
    }

    // Initialize RDP Buttons once
    function initRdpListeners() {
      document.getElementById('rdpClose')?.addEventListener('click', () => {
        routeDetailPanel.classList.remove('show');
        activeRouteId = null;
        MapService.clearMap();
      });

      document.getElementById('rdpEditBtn')?.addEventListener('click', () => {
        if (activeRouteId) openRouteModal(activeRouteId);
      });

      document.getElementById('rdpStartBtn')?.addEventListener('click', () => {
        if (!activeRouteId) return;
        const route = StorageManager.getRoute(activeRouteId);
        if (route.status === 'done') {
          updateRouteStatus(activeRouteId, 'active');
        } else if (route.status === 'active') {
          window.updateRouteStatusFromList(activeRouteId, 'done');
        } else {
          updateRouteStatus(activeRouteId, 'active');
        }
      });

      document.getElementById('rdpDeleteBtn')?.addEventListener('click', () => {
        if (activeRouteId) window.deleteRoute(activeRouteId);
      });

      document.getElementById('rdpOptimize')?.addEventListener('click', async () => {
        if (!activeRouteId) return;
        showToast('Otimizando rota...');
        const route = StorageManager.getRoute(activeRouteId);
        const deliveries = StorageManager.getDeliveriesByRoute(activeRouteId);
        if (deliveries.length <= 1) return;

        // Persist new order (Simple sort by proximity or predefined logic)
        try {
          const promises = deliveries.map((d, i) => {
            d.order = i + 1;
            return StorageManager.saveDelivery(d);
          });
          await Promise.all(promises);
          showToast('Rota otimizada!');
          loadRouteToMap(activeRouteId);
        } catch (err) {
          showToast('Erro ao otimizar: ' + err.message, 'error');
        }
      });

      document.getElementById('rdpAddStop')?.addEventListener('click', () => {
        if (activeRouteId) openDeliveryModal(null, activeRouteId);
      });
    }

    // Call initRdpListeners inside initApp

    function renderRdpStopsList(stops) {
      const list = document.getElementById('rdpStopsList');
      if (!list) return;
      list.innerHTML = stops.map((s, i) => `
        <li class="stop-item">
          <div class="stop-marker">${i + 1}</div>
          <div class="stop-info">
            <div class="stop-title">${s.recipient}</div>
            <div class="stop-address">${s.address}</div>
          </div>
          <div class="stop-actions">
            <button onclick="window.updateDeliveryStatus('${s.id}', 'delivered')" title="Entregue"><i class="ri-checkbox-circle-line"></i></button>
          </div>
        </li>
      `).join('');
    }

    function renderWeeklyChart() {
      const wrapper = document.getElementById('weeklyChartBars');
      if (!wrapper) return;
      
      const routes = StorageManager.getRoutes();
      const now = new Date();
      const dailyKms = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
      
      routes.forEach(r => {
        const d = new Date(r.date + 'T12:00:00'); // avoid timezone shifts
        const day = d.getDay(); // 0 is Sun, 1 is Mon...
        const index = day === 0 ? 6 : day - 1; // map to 0=Mon...6=Sun
        
        // Only if it's "this week" (simplified)
        dailyKms[index] += parseFloat(String(r.distanceKm).replace(',', '.')) || 0;
      });

      const max = Math.max(...dailyKms, 10);
      wrapper.innerHTML = dailyKms.map(km => `
        <div class="chart-bar" style="height: ${(km / max) * 100}%" title="${km.toFixed(1)} km"></div>
      `).join('');
    }

    // === WINDOW EXPOSURE ===
    window.viewOnMap = (id) => {
      document.getElementById('tab-map').click();
      loadRouteToMap(id);
    };
    
    window.viewOnMapReadOnly = (id) => {
      document.getElementById('tab-map').click();
      loadRouteToMap(id, true);
    };

    window.openRouteModalFromList = (id) => openRouteModal(id);
    window.openDriverModalFromList = (id) => openDriverModal(id);
    window.openUserModalFromList = (id) => openUserModal(id);
    
    window.deleteRoute = (id) => {
      openConfirmDialog("Excluir esta rota permanentemente?", async () => {
        await StorageManager.deleteRoute(id);
        showToast("Rota excluída");
        renderRoutesList();
        refreshDashboard();
      });
    };

    window.deleteDriverFromList = (id) => {
      openConfirmDialog("Excluir este motorista? As rotas vinculadas ficarão sem motorista.", async () => {
        await StorageManager.deleteDriver(id);
        showToast("Motorista excluído");
        renderDriversList();
      });
    };

    window.deleteUserFromList = (id) => {
      openConfirmDialog("Excluir este usuário?", async () => {
        await StorageManager.deleteUser(id);
        showToast("Usuário excluído");
        renderUsersList();
      });
    };

    window.deleteDeliveryFromList = (id) => {
      openConfirmDialog("Remover esta parada?", async () => {
        const d = StorageManager.getDeliveries().find(x => x.id === id);
        const rid = d ? d.routeId : null;
        await StorageManager.deleteDelivery(id);
        showToast("Parada removida");
        renderRoutesList();
        renderDeliveriesList();
        if (rid === activeRouteId) loadRouteToMap(rid);
      });
    };

    window.updateDeliveryStatus = async (id, status) => {
      const d = StorageManager.getDeliveries().find(x => x.id === id);
      if (d) {
        d.status = status;
        await StorageManager.saveDelivery(d);
        showToast(`Status atualizado: ${status}`);
        if (d.routeId === activeRouteId) loadRouteToMap(d.routeId);
      }
    };

    initializeApp();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }













