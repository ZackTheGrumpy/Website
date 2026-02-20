import './style.css'

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
  const gameList = document.getElementById('game-list')!;

  // Clear previous
  gameGrid.innerHTML = '';
  gameList.innerHTML = '';

  if (games.length === 0) {
    gameGrid.innerHTML = '<div style="color: white; padding: 20px;">No games found.</div>';
    return;
  }

  // Render Sidebar List
  games.forEach((game, index) => {
    const el = document.createElement('div');
    el.className = `list-item ${index === 0 && currentPage === 1 ? 'active' : ''}`;

    // Tiny icon placeholder
    const icon = document.createElement('img');
    const color = Math.floor(Math.random() * 16777215).toString(16);
    icon.src = `https://placehold.co/32x32/${color}/fff?text=${game.name.charAt(0)}`;

    const text = document.createElement('span');
    text.textContent = game.name;

    // Bolden if it's new
    if (game.new) {
      text.style.fontWeight = '700';
      text.style.color = '#fff';
    }

    el.appendChild(icon);
    el.appendChild(text);
    gameList.appendChild(el);
  });

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
    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = game.name;
    overlay.appendChild(title);

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(overlay);

    // AppID Tag (Top Left)
    const appIdTag = document.createElement('div');
    appIdTag.className = 'badge-appid';
    appIdTag.textContent = game.appid;
    imgWrapper.appendChild(appIdTag);

    // Badges
    if (game.new) {
      const demoBadge = document.createElement('div');
      demoBadge.className = 'badge-demo';
      demoBadge.textContent = 'NEW';
      imgWrapper.appendChild(demoBadge);
    }

    if (game.size_gb) {
      const diskBadge = document.createElement('div');
      diskBadge.className = 'badge-disk';
      diskBadge.innerHTML = `<span>${game.size_gb}</span>`;
      imgWrapper.appendChild(diskBadge);
    } else if (game.downloads > 0) {
      const badge = document.createElement('div');
      badge.className = 'badge-disk';
      badge.style.borderRadius = '50%';
      badge.style.width = '24px';
      badge.style.height = '24px';
      badge.style.justifyContent = 'center';
      badge.style.padding = '0';
      badge.textContent = game.downloads.toString();
      imgWrapper.appendChild(badge);
    }

    card.appendChild(imgWrapper);

    // Copy AppID to clipboard on click
    card.addEventListener('click', () => {
      navigator.clipboard.writeText(game.appid).then(() => {
        // Optional visual feedback
        const originalText = appIdTag.textContent;
        appIdTag.textContent = "Copied!";
        appIdTag.classList.add('copied');
        setTimeout(() => {
          appIdTag.textContent = originalText;
          appIdTag.classList.remove('copied');
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
  const query = inputElement.value.toLowerCase().trim();

  if (!query) {
    filteredGames = allGames;
  } else {
    filteredGames = allGames.filter(game => game.name.toLowerCase().includes(query));
  }

  // Reset to first page of the new result set
  goToPage(1);
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

async function initApp() {
  const gameGrid = document.getElementById('game-grid')!;
  const scrollToTopBtn = document.getElementById('scroll-to-top')!;
  const gameGridContainer = document.querySelector('.game-grid-container')!;
  const searchInput = document.querySelector('.search-input') as HTMLInputElement;

  // Setup routing
  setupNavigation();

  // Setup plan tracking & WhatsApp CTA logic
  setupPaymentTracking();



  // Listen to search input typing
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }

  // Show loading state (Skeleton)
  const gameList = document.getElementById('game-list')!;
  gameGrid.innerHTML = '';
  gameList.innerHTML = '';

  for (let i = 0; i < 24; i++) {
    const card = document.createElement('div');
    card.className = 'skeleton-card skeleton';
    gameGrid.appendChild(card);
  }

  for (let i = 0; i < 20; i++) {
    const li = document.createElement('div');
    li.className = 'list-item skeleton-sidebar-item';

    const icon = document.createElement('div');
    icon.className = 'skeleton-sidebar-icon skeleton';

    const text = document.createElement('div');
    text.className = 'skeleton-sidebar-text skeleton';

    li.appendChild(icon);
    li.appendChild(text);
    gameList.appendChild(li);
  }

  allGames = await fetchGames();
  filteredGames = allGames;

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
