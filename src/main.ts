import './style.css'

const STEAM_GENRES: Record<string, string> = {
  "0": "Unknown Genre",
  "1": "Action",
  "2": "Strategy",
  "3": "RPG",
  "4": "Casual",
  "5": "Strategy",
  "9": "Racing",
  "10": "MMO",
  "11": "FPS",
  "12": "Puzzle",
  "18": "Sports",
  "23": "Indie",
  "25": "Adventure",
  "28": "Simulation",
  "29": "Massively Multiplayer",
  "33": "Indie",
  "34": "Indie",
  "37": "Free To Play",
  "50": "Indie",
  "51": "Animation & Modeling",
  "52": "Music",
  "53": "Software & Tools",
  "54": "Education",
  "55": "Software & Tools",
  "57": "Software & Tools",
  "58": "Software & Tools",
  "59": "Software & Tools",
  "60": "Software & Tools",
  "70": "Early Access",
  "71": "Sexual Content",
  "72": "Sexual Content",
  "73": "Adventure",
  "74": "Gore"
};

interface ApiGame {
  added_on: string;
  appid: string;
  downloads: number;
  name: string;
  new: boolean;
  requires_membership: boolean;
  st_file: string;
  online_supported: string;
  bypass_supported: string;
  primary_genre: string | null;
  content_descriptors: string[];
  size_gb: string | null;
}

const PAGE_SIZE = 50;
let currentPage = 1;
let allGames: ApiGame[] = [];
let filteredGames: ApiGame[] = [];

// Filter state
let activeGenreIds: Set<string> | null = null;
let filterOnline = false;
let filterBypass = false;
let searchQuery = '';
let sortByDownloads = false;
let filterDenuvo = false;

// Search settings
let searchByName = true;
let searchByAppId = true;

function applyFilters() {
  filteredGames = allGames.filter(game => {
    if (searchQuery) {
      const matchName = searchByName && game.name.toLowerCase().includes(searchQuery);
      const matchAppId = searchByAppId && game.appid.includes(searchQuery);
      if (!matchName && !matchAppId) return false;
    }
    if (filterOnline && game.online_supported !== 'Yes') return false;
    if (filterBypass && game.bypass_supported !== 'Yes') return false;
    if (filterDenuvo && !game.requires_membership) return false;
    if (activeGenreIds) {
      const gId = game.primary_genre || "0";
      if (!activeGenreIds.has(gId)) return false;
    }
    return true;
  });
  if (sortByDownloads) {
    filteredGames = [...filteredGames].sort((a, b) => b.downloads - a.downloads);
  }
  goToPage(1);
}

async function fetchGames(): Promise<ApiGame[]> {
  try {
    const response = await fetch('https://gameboxbybear.pythonanywhere.com/api/onennabe');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: ApiGame[] = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch games:", error);
    return [];
  }
}

function getImageUrl(appid: string): string {
  return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900_2x.jpg`;
}

function renderGamesList(games: ApiGame[]) {
  const gameGrid = document.getElementById('game-grid')!;

  // Clear previous
  gameGrid.innerHTML = '';

  if (games.length === 0) {
    gameGrid.innerHTML = '<div style="color: white; padding: 20px;">No games found.</div>';
    return;
  }

  // Render Main Grid
  games.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'card-image-wrapper';

    const img = document.createElement('img');
    img.className = 'card-image';
    const originalSrc = getImageUrl(game.appid);
    img.src = originalSrc;
    img.alt = game.name;
    img.loading = 'lazy';

    // Handle broken images: Steam CDN → GitHub backup → placeholder
    let fallbackAttempted = false;
    img.onerror = function () {
      if (!fallbackAttempted) {
        fallbackAttempted = true;
        img.src = `https://barryhamsy.github.io/gamelist/${game.appid}.jpg`;
      } else {
        img.onerror = null; // stop further errors
        img.src = `https://barryhamsy.github.io/gamelist/placeholder.jpg`;
      }
    };

    // Hover overlay
    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';

    if (game.requires_membership) {
      const denuvo = document.createElement('span');
      denuvo.className = 'card-denuvo';
      denuvo.textContent = 'DENUVO';
      overlay.appendChild(denuvo);
    }

    if (game.downloads > 0) {
      const downloads = document.createElement('span');
      downloads.className = 'card-downloads';
      downloads.textContent = `Downloaded: ${game.downloads}`;
      overlay.appendChild(downloads);
    }

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = game.name;
    overlay.appendChild(title);

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(overlay);

    // Genre Tag (Top Right)
    const appIdTag = document.createElement('div');
    appIdTag.className = 'badge-appid';
    const genreLabel = game.primary_genre ? (STEAM_GENRES[game.primary_genre] ?? `#${game.primary_genre}`) : null;
    if (genreLabel) {
      appIdTag.textContent = genreLabel;
      imgWrapper.appendChild(appIdTag);
    }

    // Support Badges (Top Left, stacked)
    const supportBadgesWrap = document.createElement('div');
    supportBadgesWrap.className = 'badge-support-stack';

    if (game.online_supported === 'Yes') {
      const b = document.createElement('div');
      b.className = 'badge-support badge-online';
      b.textContent = 'Online Supported';
      supportBadgesWrap.appendChild(b);
    }
    if (game.bypass_supported === 'Yes') {
      const b = document.createElement('div');
      b.className = 'badge-support badge-bypass';
      b.textContent = 'Bypass Supported';
      supportBadgesWrap.appendChild(b);
    }
    if (supportBadgesWrap.childElementCount > 0) {
      imgWrapper.appendChild(supportBadgesWrap);
    }

    // Badges
    if (game.new) {
      const demoBadge = document.createElement('div');
      demoBadge.className = 'badge-demo';
      demoBadge.textContent = '\u00A0\u00A0\u00A0\u00A0\u00A0NEW';
      imgWrapper.appendChild(demoBadge);
    }

    const diskBadge = document.createElement('div');
    diskBadge.className = 'badge-disk';
    diskBadge.innerHTML = `<span>${game.appid}</span>`;
    imgWrapper.appendChild(diskBadge);

    card.appendChild(imgWrapper);

    // Copy AppID to clipboard on click
    card.addEventListener('click', () => {
      navigator.clipboard.writeText(game.appid).then(() => {
        // Optional visual feedback
        diskBadge.innerHTML = `<span>Copied!</span>`;
        diskBadge.classList.add('copied');
        setTimeout(() => {
          diskBadge.innerHTML = `<span>${game.appid}</span>`;
          diskBadge.classList.remove('copied');
        }, 1000);
      });
    });

    gameGrid.appendChild(card);
  });
}

function renderPaginationControls() {
  const container = document.getElementById('pagination-container')!;
  container.innerHTML = '';

  if (filteredGames.length === 0) return;

  const totalPages = Math.ceil(filteredGames.length / PAGE_SIZE);

  // First / Prev
  const firstBtn = document.createElement('button');
  firstBtn.className = 'pagination-btn pagination-btn-desktop';
  firstBtn.textContent = 'First';
  firstBtn.disabled = currentPage === 1;
  firstBtn.onclick = () => goToPage(1);

  const prevBtn = document.createElement('button');
  prevBtn.className = 'pagination-btn';
  prevBtn.textContent = 'Prev';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => goToPage(currentPage - 1);

  container.appendChild(firstBtn);
  container.appendChild(prevBtn);

  // Pages context (show current, -1, +1, -2, +2 within bounds)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  // Adjust logic to always show ~5 buttons if possible
  if (startPage === 1) {
    endPage = Math.min(totalPages, 5);
  } else if (endPage === totalPages) {
    startPage = Math.max(1, totalPages - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `pagination-btn pagination-btn-desktop ${i === currentPage ? 'active' : ''}`;
    pageBtn.textContent = i.toString();
    pageBtn.onclick = () => goToPage(i);
    container.appendChild(pageBtn);
  }

  // Next / Last
  const nextBtn = document.createElement('button');
  nextBtn.className = 'pagination-btn';
  nextBtn.textContent = 'Next';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => goToPage(currentPage + 1);

  const lastBtn = document.createElement('button');
  lastBtn.className = 'pagination-btn pagination-btn-desktop';
  lastBtn.textContent = 'Last';
  lastBtn.disabled = currentPage === totalPages;
  lastBtn.onclick = () => goToPage(totalPages);

  container.appendChild(nextBtn);
  container.appendChild(lastBtn);

  // Jump to input
  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'pagination-btn-desktop';
  inputWrapper.style.marginLeft = '16px';
  inputWrapper.style.display = 'flex';
  inputWrapper.style.alignItems = 'center';
  inputWrapper.style.gap = '8px';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'pagination-input';
  input.placeholder = currentPage.toString();
  input.min = '1';
  input.max = totalPages.toString();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const parsed = parseInt(input.value);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
        goToPage(parsed);
      }
    }
  });

  const inputLabel = document.createElement('span');
  inputLabel.style.color = 'var(--text-muted)';
  inputLabel.style.fontSize = '12px';
  inputLabel.textContent = `of ${totalPages} [Enter]`;

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(inputLabel);
  container.appendChild(inputWrapper);
}

function goToPage(page: number) {
  const totalPages = Math.ceil(filteredGames.length / PAGE_SIZE);
  if (page < 1 || page > totalPages) return;

  currentPage = page;

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const paginatedGames = filteredGames.slice(startIdx, endIdx);

  renderGamesList(paginatedGames);
  renderPaginationControls();

  // Scroll container back up
  const gameGridContainer = document.querySelector('.game-grid-container')!;
  gameGridContainer.scrollTo({ top: 0, behavior: 'instant' });
}

function handleSearch(event: Event) {
  const inputElement = event.target as HTMLInputElement;
  searchQuery = inputElement.value.toLowerCase().trim();
  applyFilters();
}

function setupFilters() {
  // Support buttons (genre-style)
  const supportList = document.getElementById('filter-support-list');
  if (supportList) {
    const supportOptions = [
      { label: 'All', online: false, bypass: false },
      { label: 'Online Supported', online: true, bypass: false },
      { label: 'Bypass Supported', online: false, bypass: true },
    ];
    supportOptions.forEach(({ label, online, bypass }, i) => {
      const btn = document.createElement('button');
      btn.className = 'filter-genre-btn' + (i === 0 ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        filterOnline = online;
        filterBypass = bypass;
        supportList.querySelectorAll('.filter-genre-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilters();
      });
      supportList.appendChild(btn);
    });
  }

  // Build genre buttons immediately from the full STEAM_GENRES map
  const genreContainer = document.getElementById('filter-genre-list');
  if (!genreContainer) return;

  // Group IDs by their label (deduplicate)
  const labelToIds = new Map<string, Set<string>>();
  Object.entries(STEAM_GENRES).forEach(([id, label]) => {
    if (!labelToIds.has(label)) labelToIds.set(label, new Set());
    labelToIds.get(label)!.add(id);
  });

  const sorted = [...labelToIds.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // "All" button first
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-genre-btn active';
  allBtn.id = 'genre-btn-all';
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => {
    activeGenreIds = null;
    filterDenuvo = false;
    genreContainer.querySelectorAll('.filter-genre-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    applyFilters();
  });
  genreContainer.appendChild(allBtn);

  // "Most Downloaded" button
  const mostBtn = document.createElement('button');
  mostBtn.className = 'filter-genre-btn';
  mostBtn.textContent = '⬇ Most Downloaded ⬇';
  mostBtn.id = 'genre-btn-most';
  mostBtn.style.display = 'none'; // Hide initially for skeleton loop
  mostBtn.addEventListener('click', () => {
    sortByDownloads = true;
    activeGenreIds = null;
    filterDenuvo = false;
    genreContainer.querySelectorAll('.filter-genre-btn').forEach(b => b.classList.remove('active'));
    mostBtn.classList.add('active');
    applyFilters();
  });
  genreContainer.appendChild(mostBtn);
  allBtn.addEventListener('click', () => { sortByDownloads = false; }, true);

  // "Denuvo" button
  const denuvoBtn = document.createElement('button');
  denuvoBtn.className = 'filter-genre-btn';
  denuvoBtn.textContent = 'Denuvo';
  denuvoBtn.id = 'genre-btn-denuvo';
  denuvoBtn.style.display = 'none'; // Hide initially for skeleton loop
  denuvoBtn.addEventListener('click', () => {
    sortByDownloads = false;
    activeGenreIds = null;
    filterDenuvo = true;
    genreContainer.querySelectorAll('.filter-genre-btn').forEach(b => b.classList.remove('active'));
    denuvoBtn.classList.add('active');
    applyFilters();
  });
  // Removed immediate append: genreContainer.appendChild(denuvoBtn);

  // Skeleton placeholders while data loads
  for (let i = 0; i < 16; i++) {
    const sk = document.createElement('div');
    sk.className = 'filter-genre-skeleton skeleton';
    genreContainer.appendChild(sk);
  }

  sorted.forEach(([label, ids]) => {
    const btn = document.createElement('button');
    btn.className = 'filter-genre-btn';
    btn.textContent = label;
    btn.dataset.genreLabel = label;
    // Hide by default — revealed after data loads via pruneGenreButtons
    btn.style.display = 'none';
    btn.addEventListener('click', () => {
      sortByDownloads = false;
      activeGenreIds = ids;
      filterDenuvo = false;
      genreContainer.querySelectorAll('.filter-genre-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
    genreContainer.appendChild(btn);

    // Position Denuvo under Casual
    if (label === 'Casual') {
      genreContainer.appendChild(denuvoBtn);
    }
  });
}

// Called after data loads — shows only genre buttons that exist in the catalogue
function pruneGenreButtons() {
  const genreContainer = document.getElementById('filter-genre-list');
  if (!genreContainer) return;

  // Remove skeleton placeholders
  genreContainer.querySelectorAll('.filter-genre-skeleton').forEach(el => el.remove());

  // Reveal Most Downloaded and Denuvo buttons
  const mostBtn = document.getElementById('genre-btn-most');
  if (mostBtn) mostBtn.style.display = '';

  const denuvoBtn = document.getElementById('genre-btn-denuvo');
  if (denuvoBtn) denuvoBtn.style.display = '';

  const presentLabels = new Set<string>();
  allGames.forEach(g => {
    const gId = g.primary_genre || "0";
    if (STEAM_GENRES[gId]) {
      presentLabels.add(STEAM_GENRES[gId]);
    }
  });

  // Show genre buttons that are present in the data
  genreContainer.querySelectorAll<HTMLButtonElement>('.filter-genre-btn').forEach(btn => {
    if (btn.textContent === 'All' || btn.textContent === '⬇ Most Downloaded ⬇' || btn.textContent === 'Denuvo') {
      return; // Keep All, Most Downloaded, and Denuvo visible
    }
    const label = btn.textContent!;
    if (presentLabels.has(label)) {
      btn.style.display = ''; // Show button
    } else {
      btn.remove(); // Remove button if genre is not present
    }
  });
}

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  const viewSections = document.querySelectorAll('.view-section');
  const paginationContainer = document.getElementById('pagination-container');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      // 1. Remove active class from all links
      navLinks.forEach(l => l.classList.remove('active'));

      // 2. Add active class to clicked link
      link.classList.add('active');

      // 3. Hide all views
      viewSections.forEach(view => {
        view.classList.remove('active');
        (view as HTMLElement).style.display = 'none';
      });

      // 4. Show the target view
      const targetId = link.getAttribute('data-target');
      if (targetId) {
        const targetView = document.getElementById(targetId);
        if (targetView) {
          targetView.classList.add('active');
          targetView.style.display = 'flex';
        }
      }

      // 5. Toggle Pagination visibility (only show on Home)
      if (paginationContainer) {
        if (targetId === 'home-view') {
          paginationContainer.style.display = 'flex';
        } else {
          paginationContainer.style.display = 'none';
        }
      }
    });
  });
}

function getReceiptFromURL(): string {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get('receipt') || p.get('tx') || p.get('paymentId') || p.get('payment_id') || p.get('token') || '';
  } catch (e) {
    return '';
  }
}

function updateWhatsAppLink(receipt: string, plan: string) {
  const base = "https://wa.me/60138254541";
  const parts: string[] = [];
  if (plan) parts.push(`Plan: ${plan}`);
  if (receipt) parts.push(`Receipt: ${receipt}`);

  const info = parts.length ? ` (${parts.join(' | ')})` : '';
  const msg = `Hi Barry, I am interested in Steam Unlock Onennabe${info}.`;

  const url = base + "?text=" + encodeURIComponent(msg);
  const a = document.getElementById('whatsappBtn') as HTMLAnchorElement;
  if (a) a.href = url;
}

function showReceiptToast() {
  const el = document.getElementById('receiptToast');
  if (el) el.style.display = 'block';
}

function hideReceiptToast() {
  const el = document.getElementById('receiptToast');
  if (el) el.style.display = 'none';
}

function setupPaymentTracking() {
  // Track plan selection
  document.querySelectorAll('.buy-now-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.pay-card');
      const planName = card?.querySelector('h3')?.textContent || 'Purchase';
      localStorage.setItem('lastPlan', planName);

      // Smooth scroll to payment section
      const paymentSection = document.querySelector('.paypal-box');
      if (paymentSection) {
        paymentSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Auto-detect receipt from URL
  const receipt = getReceiptFromURL();
  if (receipt) {
    localStorage.setItem('lastReceipt', receipt);
  }

  // Update WhatsApp link based on cache
  const knownReceipt = localStorage.getItem('lastReceipt') || '';
  const knownPlan = localStorage.getItem('lastPlan') || '';
  updateWhatsAppLink(knownReceipt, knownPlan);

  // Show receipt toast prompt if they picked a plan but haven't provided a receipt
  if (knownPlan && !knownReceipt && !localStorage.getItem('receiptPromptShown')) {
    showReceiptToast();
    localStorage.setItem('receiptPromptShown', '1');
  }

  // Handle manual receipt saving
  const receiptSaveBtn = document.getElementById('receiptSaveBtn');
  if (receiptSaveBtn) {
    receiptSaveBtn.addEventListener('click', () => {
      const input = document.getElementById('receiptInput') as HTMLInputElement;
      const r = (input?.value || '').trim();
      if (r) {
        localStorage.setItem('lastReceipt', r);
        updateWhatsAppLink(r, localStorage.getItem('lastPlan') || '');
        hideReceiptToast();
      }
    });
  }
}

function setupSearchSettings() {
  const btn = document.getElementById('searchSettingsBtn');
  const dropdown = document.getElementById('searchSettingsDropdown');
  const nameToggle = document.getElementById('searchNameToggle') as HTMLInputElement;
  const appIdToggle = document.getElementById('searchAppIdToggle') as HTMLInputElement;

  if (!btn || !dropdown || !nameToggle || !appIdToggle) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('active');
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('active');
  });

  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  nameToggle.addEventListener('change', () => {
    if (!nameToggle.checked && !appIdToggle.checked) {
      nameToggle.checked = true;
    }
    searchByName = nameToggle.checked;
    searchByAppId = appIdToggle.checked;
    applyFilters();
  });

  appIdToggle.addEventListener('change', () => {
    if (!appIdToggle.checked && !nameToggle.checked) {
      nameToggle.checked = true;
    }
    searchByName = nameToggle.checked;
    searchByAppId = appIdToggle.checked;
    applyFilters();
  });
}

async function initApp() {
  const gameGrid = document.getElementById('game-grid')!;
  const scrollToTopBtn = document.getElementById('scroll-to-top')!;
  const gameGridContainer = document.querySelector('.game-grid-container')!;
  const searchInput = document.querySelector('.search-input') as HTMLInputElement;

  // Setup routing
  setupNavigation();

  // Setup search settings UI
  setupSearchSettings();

  // Setup plan tracking & WhatsApp CTA logic
  setupPaymentTracking();

  // Listen to search input typing
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }

  // Wire up filter controls immediately (genre buttons visible during skeleton)
  setupFilters();

  // Show loading state (Skeleton)
  gameGrid.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const card = document.createElement('div');
    card.className = 'skeleton-card skeleton';
    gameGrid.appendChild(card);
  }

  allGames = await fetchGames();
  filteredGames = allGames;

  // Reveal only genre buttons present in catalogue
  pruneGenreButtons();

  // Render initial page
  goToPage(1);

  // Scroll logic for "Scroll to Top" button
  gameGridContainer.addEventListener('scroll', () => {
    if (gameGridContainer.scrollTop > 100) {
      scrollToTopBtn.classList.add('visible');
    } else {
      scrollToTopBtn.classList.remove('visible');
    }
  });

  scrollToTopBtn.addEventListener('click', () => {
    gameGridContainer.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

document.addEventListener('DOMContentLoaded', initApp);
