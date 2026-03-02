/**
 * NagusameCS Portfolio — Main Application
 * Pulls data live from GitHub API, config JSONs, and store APIs.
 */

const GH_USER = 'NagusameCS';
const GH_API = 'https://api.github.com';
const CONFIG_BASE = 'config';

// Language colors (GitHub-style)
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600',
  Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB', HTML: '#e34c26',
  CSS: '#563d7c', Shell: '#89e051', Lua: '#000080', TeX: '#3D6117',
  Vue: '#41b883', Svelte: '#ff3e00', Zig: '#ec915c', Nix: '#7e7eff',
  Haskell: '#5e5086', Scala: '#c22d40', R: '#198CE7',
};

// ===== UTILITIES =====
function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  const intervals = [
    [31536000, 'year'], [2592000, 'month'], [86400, 'day'],
    [3600, 'hour'], [60, 'minute'], [1, 'second']
  ];
  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count} ${label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

async function fetchJSONSafe(url, fallback = null) {
  try { return await fetchJSON(url); }
  catch { return fallback; }
}

// ===== PROFILE =====
async function loadProfile() {
  const profile = await fetchJSON(`${GH_API}/users/${GH_USER}`);

  // Avatar
  document.getElementById('avatar').src = profile.avatar_url;

  // Name
  const displayName = profile.name || profile.login;
  document.getElementById('display-name').textContent = displayName;
  document.title = `${displayName} — Portfolio`;

  // Bio
  const bioText = profile.bio || `Software developer at ${profile.company || 'OpenCS.dev'}. Building things that matter.`;
  document.getElementById('bio').textContent = bioText;
  document.getElementById('about-bio').textContent = bioText;

  // Meta
  if (profile.company) {
    document.querySelector('#company span').textContent = profile.company;
  } else {
    document.getElementById('company').style.display = 'none';
  }
  if (profile.location) {
    document.querySelector('#location span').textContent = profile.location;
  } else {
    document.getElementById('location').style.display = 'none';
  }
  if (profile.blog) {
    const blogA = document.querySelector('#blog a');
    blogA.href = profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`;
    blogA.textContent = profile.blog.replace(/^https?:\/\//, '');
  } else {
    document.getElementById('blog').style.display = 'none';
  }

  // Stats
  document.getElementById('stat-repos').textContent = profile.public_repos;
  document.getElementById('stat-followers').textContent = profile.followers;
  document.getElementById('stat-following').textContent = profile.following;

  // About details
  const details = [];
  if (profile.company) details.push({ icon: 'fas fa-building', text: profile.company });
  if (profile.location) details.push({ icon: 'fas fa-map-marker-alt', text: profile.location });
  if (profile.blog) details.push({ icon: 'fas fa-globe', text: profile.blog.replace(/^https?:\/\//, '') });
  details.push({ icon: 'fas fa-calendar', text: `Joined ${new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` });
  if (profile.hireable) details.push({ icon: 'fas fa-briefcase', text: 'Open to opportunities' });

  document.getElementById('about-details').innerHTML = details.map(d =>
    `<span class="about-detail-tag"><i class="${d.icon}"></i>${escapeHtml(d.text)}</span>`
  ).join('');

  return profile;
}

// ===== REPOSITORIES =====
let allRepos = [];

async function loadRepos() {
  // Fetch all repos (paginated)
  let page = 1;
  let repos = [];
  while (true) {
    const batch = await fetchJSON(`${GH_API}/users/${GH_USER}/repos?per_page=100&page=${page}&sort=updated`);
    repos = repos.concat(batch);
    if (batch.length < 100) break;
    page++;
  }

  // Load ignore list
  const ignoreData = await fetchJSONSafe(`${CONFIG_BASE}/ignored-repos.json`, { ignored: [] });
  const ignoredSet = new Set((ignoreData.ignored || []).map(n => n.toLowerCase()));

  // Filter ignored
  allRepos = repos.filter(r => !ignoredSet.has(r.name.toLowerCase()));

  renderRepos(allRepos);
  computeLanguages(allRepos);
}

function renderRepos(repos) {
  const grid = document.getElementById('repo-grid');
  if (repos.length === 0) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i>No repositories found.</div>';
    return;
  }

  grid.innerHTML = repos.map((repo, i) => {
    const langColor = LANG_COLORS[repo.language] || '#8b949e';
    const iconUrl = `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${repo.default_branch}/.github/icon.png`;
    const homepageAttr = repo.homepage ? escapeHtml(repo.homepage) : '';
    return `
      <div class="repo-card fade-in" data-index="${i}" data-fork="${repo.fork}" style="animation-delay: ${i * 0.03}s">
        <div class="repo-card-header">
          <img class="repo-card-icon" src="${iconUrl}" alt="" data-homepage="${homepageAttr}" onerror="repoIconFallback(this)">
          <div>
            <span class="repo-card-title">${escapeHtml(repo.name)}</span>
            ${repo.fork ? '<span class="repo-card-fork">Fork</span>' : ''}
          </div>
        </div>
        <p class="repo-card-desc">${escapeHtml(repo.description) || '<span style="color:var(--text-muted)">No description provided.</span>'}</p>
        <div class="repo-card-meta">
          ${repo.language ? `<span><span class="lang-dot" style="background:${langColor}"></span>${repo.language}</span>` : ''}
          <span><i class="fas fa-star"></i> ${repo.stargazers_count}</span>
          <span><i class="fas fa-code-branch"></i> ${repo.forks_count}</span>
          <span><i class="fas fa-clock"></i> ${timeAgo(repo.updated_at)}</span>
        </div>
      </div>`;
  }).join('');

  // Trigger fade-in
  requestAnimationFrame(() => {
    grid.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  });

  // Card click => modal
  grid.querySelectorAll('.repo-card').forEach(card => {
    card.addEventListener('click', () => openRepoModal(allRepos[parseInt(card.dataset.index)]));
  });
}

function computeLanguages(repos) {
  const langCount = {};
  repos.forEach(r => {
    if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
  });
  const sorted = Object.entries(langCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = sorted[0]?.[1] || 1;
  const total = repos.filter(r => r.language).length;

  document.getElementById('languages-chart').innerHTML = sorted.map(([lang, count]) => {
    const pct = Math.round((count / total) * 100);
    return `
      <div class="lang-bar">
        <span class="lang-name">${lang}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span class="lang-pct">${pct}%</span>
      </div>`;
  }).join('');
}

// ===== ICON FALLBACK =====
function repoIconFallback(img) {
  const homepage = img.dataset.homepage;
  if (homepage && !img.dataset.triedFavicon) {
    img.dataset.triedFavicon = 'true';
    // Try Google's favicon service for the homepage domain
    try {
      const domain = new URL(homepage.startsWith('http') ? homepage : `https://${homepage}`).hostname;
      img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      return;
    } catch {}
  }
  // Final fallback: placeholder icon
  img.outerHTML = '<div class="repo-card-icon-placeholder"><i class="fas fa-code-branch"></i></div>';
}

// ===== REPO MODAL =====
function openRepoModal(repo) {
  const modal = document.getElementById('repo-modal');
  const langColor = LANG_COLORS[repo.language] || '#8b949e';
  const iconUrl = `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${repo.default_branch}/.github/icon.png`;
  // Social preview: use opengraph image
  const socialPreviewUrl = `https://opengraph.githubassets.com/1/${GH_USER}/${repo.name}`;

  // Icon — try .github/icon.png → homepage favicon → hide
  const iconEl = document.getElementById('modal-icon');
  iconEl.src = iconUrl;
  iconEl.dataset.homepage = repo.homepage || '';
  iconEl.dataset.triedFavicon = '';
  iconEl.onerror = function () {
    const homepage = this.dataset.homepage;
    if (homepage && !this.dataset.triedFavicon) {
      this.dataset.triedFavicon = 'true';
      try {
        const domain = new URL(homepage.startsWith('http') ? homepage : `https://${homepage}`).hostname;
        this.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        return;
      } catch {}
    }
    this.style.display = 'none';
  };
  iconEl.onload = function () {
    this.style.display = 'block';
  };
  iconEl.style.display = 'block';

  // Social preview — try repo's own social image, then OpenGraph
  const previewEl = document.getElementById('modal-social-preview');
  previewEl.classList.remove('visible');

  // Chain: custom .github/social-preview.png → GitHub OpenGraph image
  const customPreview = `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${repo.default_branch}/.github/social-preview.png`;

  // We use a test image to check if custom preview exists
  const testImg = new Image();
  testImg.onload = function () {
    previewEl.src = customPreview;
    previewEl.classList.add('visible');
  };
  testImg.onerror = function () {
    // Use GitHub's OpenGraph image (always exists for public repos)
    previewEl.src = socialPreviewUrl;
    previewEl.classList.add('visible');
  };
  testImg.src = customPreview;

  document.getElementById('modal-title').textContent = repo.name;
  document.getElementById('modal-language').innerHTML = repo.language
    ? `<span class="lang-dot" style="background:${langColor};display:inline-block;margin-right:4px"></span>${repo.language}`
    : '';
  document.getElementById('modal-description').textContent = repo.description || 'No description provided.';

  // Stats
  document.getElementById('modal-stats').innerHTML = `
    <span><i class="fas fa-star"></i> ${repo.stargazers_count} stars</span>
    <span><i class="fas fa-code-branch"></i> ${repo.forks_count} forks</span>
    <span><i class="fas fa-eye"></i> ${repo.watchers_count} watchers</span>
    <span><i class="fas fa-balance-scale"></i> ${repo.license?.spdx_id || 'No license'}</span>
    <span><i class="fas fa-clock"></i> Updated ${timeAgo(repo.updated_at)}</span>
    ${repo.size ? `<span><i class="fas fa-database"></i> ${(repo.size / 1024).toFixed(1)} MB</span>` : ''}
  `;

  // Topics
  document.getElementById('modal-topics').innerHTML = (repo.topics || []).map(t =>
    `<span class="modal-topic">${escapeHtml(t)}</span>`
  ).join('');

  // Links
  document.getElementById('modal-link').href = repo.html_url;
  const homepage = document.getElementById('modal-homepage');
  if (repo.homepage) {
    homepage.href = repo.homepage;
    homepage.style.display = 'inline-flex';
  } else {
    homepage.style.display = 'none';
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('repo-modal').classList.remove('active');
  document.body.style.overflow = '';
}

// ===== COLLABORATIONS =====
async function loadCollaborations() {
  const data = await fetchJSONSafe(`${CONFIG_BASE}/collaborations.json`, { collaborations: [] });
  const grid = document.getElementById('collab-grid');
  const collabs = data.collaborations || [];

  if (collabs.length === 0) {
    const section = document.getElementById('collaborations');
    if (section) section.style.display = 'none';
    const navLink = document.querySelector('a[href="#collaborations"]');
    if (navLink) navLink.closest('li').style.display = 'none';
    return;
  }

  grid.innerHTML = collabs.map(c => `
    <a href="${escapeHtml(c.url)}" target="_blank" class="collab-card">
      <div class="collab-card-header">
        <i class="${c.icon || 'fas fa-users'}"></i>
        <h3>${escapeHtml(c.name)}</h3>
      </div>
      <p>${escapeHtml(c.description)}</p>
      <div class="collab-people">
        ${(c.collaborators || []).map(p => `<span class="collab-person">@${escapeHtml(p)}</span>`).join('')}
      </div>
      <span class="collab-role"><i class="fas fa-tag"></i> ${escapeHtml(c.role || 'Contributor')}</span>
    </a>
  `).join('');
}

// ===== STORE APPS =====
async function loadStoreApps() {
  const data = await fetchJSONSafe(`${CONFIG_BASE}/store-links.json`, {});
  const grid = document.getElementById('store-grid');
  const items = [];

  // Apple App Store
  (data.appStore || []).forEach(app => {
    items.push({ ...app, store: 'apple', storeLabel: 'App Store', icon_class: 'fab fa-apple' });
  });
  // Google Play
  (data.playStore || []).forEach(app => {
    items.push({ ...app, store: 'android', storeLabel: 'Google Play', icon_class: 'fab fa-google-play' });
  });
  // VS Code Marketplace
  (data.vscodeMarketplace || []).forEach(app => {
    items.push({ ...app, store: 'vscode', storeLabel: 'VS Code', icon_class: 'fas fa-puzzle-piece' });
  });

  if (items.length === 0) {
    // Hide the entire section and its nav link when there are no real listings
    const section = document.getElementById('store-apps');
    if (section) section.style.display = 'none';
    const navLink = document.querySelector('a[href="#store-apps"]');
    if (navLink) navLink.closest('li').style.display = 'none';
    return;
  }

  // Try to enrich with metadata from store APIs
  const enriched = await Promise.all(items.map(item => enrichStoreItem(item)));

  grid.innerHTML = enriched.map(item => {
    const iconHtml = item.icon
      ? `<img class="store-card-icon" src="${escapeHtml(item.icon)}" alt="">`
      : `<div class="store-card-icon-placeholder ${item.store}"><i class="${item.icon_class}"></i></div>`;

    return `
      <a href="${escapeHtml(item.url)}" target="_blank" class="store-card">
        <div class="store-card-header">
          ${iconHtml}
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <span class="store-badge ${item.store}">${item.storeLabel}</span>
          </div>
        </div>
        <p>${escapeHtml(item.description || 'No description available.')}</p>
        <span class="btn btn-secondary"><i class="${item.icon_class}"></i> View in ${item.storeLabel}</span>
      </a>`;
  }).join('');
}

async function enrichStoreItem(item) {
  try {
    if (item.store === 'vscode' && item.url) {
      // Extract publisher.extension from URL
      const match = item.url.match(/itemName=([^&]+)/);
      if (match) {
        const extensionId = match[1];
        const apiUrl = `https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`;
        const body = {
          filters: [{ criteria: [{ filterType: 7, value: extensionId }] }],
          assetTypes: [],
          flags: 914
        };
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json;api-version=6.0-preview.1'
          },
          body: JSON.stringify(body)
        });
        if (res.ok) {
          const data = await res.json();
          const ext = data.results?.[0]?.extensions?.[0];
          if (ext) {
            item.name = ext.displayName || item.name;
            item.description = ext.shortDescription || item.description;
            // Find icon asset
            const iconAsset = ext.versions?.[0]?.files?.find(f => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Default');
            if (iconAsset) item.icon = iconAsset.source;
          }
        }
      }
    }
    // Note: Apple and Google Play don't have public APIs for scraping.
    // For those, the user fills in name/description/icon manually in the JSON.
  } catch (e) {
    console.warn('Store enrichment failed:', e);
  }
  return item;
}

// ===== ACTIVITY GRAPH =====
async function loadActivity() {
  await Promise.all([renderContributionGraph(), loadRecentActivity()]);
}

async function renderContributionGraph() {
  const container = document.getElementById('contribution-graph');
  
  // We'll use the GitHub events API as a proxy for activity,
  // since the contribution graph requires auth/scraping.
  // Build a heatmap from events for the last year.
  try {
    // Fetch recent events (up to 300, which is the API max for public events)
    let allEvents = [];
    for (let p = 1; p <= 3; p++) {
      const events = await fetchJSONSafe(`${GH_API}/users/${GH_USER}/events/public?per_page=100&page=${p}`, []);
      allEvents = allEvents.concat(events);
      if (events.length < 100) break;
    }

    // Count events by day
    const dayCounts = {};
    allEvents.forEach(ev => {
      const day = ev.created_at.split('T')[0];
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    // Build calendar for last 52 weeks
    const today = new Date();
    const weeks = [];
    const monthLabels = [];
    let lastMonth = -1;

    // Start from the Sunday of 52 weeks ago
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay() - 52 * 7);

    for (let w = 0; w < 53; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(date.getDate() + w * 7 + d);
        const dateStr = date.toISOString().split('T')[0];
        const count = dayCounts[dateStr] || 0;
        const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4;
        const isFuture = date > today;
        week.push({ dateStr, count, level, isFuture });

        // Track month labels
        if (d === 0 && date.getMonth() !== lastMonth) {
          monthLabels.push({ week: w, label: date.toLocaleDateString('en-US', { month: 'short' }) });
          lastMonth = date.getMonth();
        }
      }
      weeks.push(week);
    }

    // Render
    const totalContribs = allEvents.length;
    container.innerHTML = `
      <div style="margin-bottom:12px;font-size:0.9rem;color:var(--text-secondary)">
        ${totalContribs} contributions in the last year (based on public events)
      </div>
      <div class="contrib-months" style="margin-left:0">
        ${monthLabels.map(m => `<span class="contrib-month-label" style="margin-left:${m.week * 15}px;position:absolute">${m.label}</span>`).join('')}
      </div>
      <div class="contrib-calendar" style="margin-top:24px">
        ${weeks.map(week => `
          <div class="contrib-week">
            ${week.map(day => day.isFuture
              ? `<div class="contrib-day" style="opacity:0"></div>`
              : `<div class="contrib-day" data-level="${day.level}" title="${day.dateStr}: ${day.count} events"></div>`
            ).join('')}
          </div>
        `).join('')}
      </div>
      <div class="contrib-legend">
        <span>Less</span>
        <div class="contrib-day" data-level="0"></div>
        <div class="contrib-day" data-level="1"></div>
        <div class="contrib-day" data-level="2"></div>
        <div class="contrib-day" data-level="3"></div>
        <div class="contrib-day" data-level="4"></div>
        <span>More</span>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <img src="https://ghchart.rshah.org/${GH_USER}" alt="GitHub Contribution Chart" style="width:100%;max-width:800px;border-radius:8px;">
        <p style="margin-top:12px;font-size:0.85rem;color:var(--text-muted)">Contribution graph via ghchart.rshah.org</p>
      </div>`;
  }
}

async function loadRecentActivity() {
  const feed = document.getElementById('activity-feed');
  try {
    const events = await fetchJSON(`${GH_API}/users/${GH_USER}/events/public?per_page=15`);

    const eventIcons = {
      PushEvent: 'fas fa-code-commit',
      CreateEvent: 'fas fa-plus-circle',
      DeleteEvent: 'fas fa-trash',
      WatchEvent: 'fas fa-star',
      ForkEvent: 'fas fa-code-branch',
      IssuesEvent: 'fas fa-exclamation-circle',
      IssueCommentEvent: 'fas fa-comment',
      PullRequestEvent: 'fas fa-code-merge',
      PullRequestReviewEvent: 'fas fa-check-circle',
      ReleaseEvent: 'fas fa-tag',
      PublicEvent: 'fas fa-globe',
    };

    function describeEvent(ev) {
      const repo = `<strong>${ev.repo.name.split('/')[1]}</strong>`;
      switch (ev.type) {
        case 'PushEvent': {
          const count = ev.payload.commits?.length || 0;
          return `Pushed ${count} commit${count !== 1 ? 's' : ''} to ${repo}`;
        }
        case 'CreateEvent':
          return `Created ${ev.payload.ref_type} ${ev.payload.ref ? `<strong>${ev.payload.ref}</strong> in ` : ''}${repo}`;
        case 'DeleteEvent':
          return `Deleted ${ev.payload.ref_type} <strong>${ev.payload.ref}</strong> in ${repo}`;
        case 'WatchEvent':
          return `Starred ${repo}`;
        case 'ForkEvent':
          return `Forked ${repo}`;
        case 'IssuesEvent':
          return `${ev.payload.action} issue in ${repo}`;
        case 'IssueCommentEvent':
          return `Commented on issue in ${repo}`;
        case 'PullRequestEvent':
          return `${ev.payload.action} PR in ${repo}`;
        case 'PullRequestReviewEvent':
          return `Reviewed PR in ${repo}`;
        case 'ReleaseEvent':
          return `Published release in ${repo}`;
        default:
          return `Activity in ${repo}`;
      }
    }

    feed.innerHTML = events.slice(0, 10).map(ev => `
      <li class="activity-item">
        <i class="${eventIcons[ev.type] || 'fas fa-bolt'}"></i>
        <span class="activity-text">${describeEvent(ev)}</span>
        <span class="activity-time">${timeAgo(ev.created_at)}</span>
      </li>
    `).join('');
  } catch {
    feed.innerHTML = '<li class="activity-item"><span class="activity-text" style="color:var(--text-muted)">Could not load recent activity.</span></li>';
  }
}

// ===== SEARCH & FILTER =====
function setupFilters() {
  // Search
  document.getElementById('repo-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allRepos.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.language || '').toLowerCase().includes(q) ||
      (r.topics || []).some(t => t.includes(q))
    );
    renderRepos(filtered);
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      if (filter === 'all') renderRepos(allRepos);
      else if (filter === 'source') renderRepos(allRepos.filter(r => !r.fork));
      else if (filter === 'fork') renderRepos(allRepos.filter(r => r.fork));
    });
  });
}

// ===== MODAL EVENTS =====
function setupModal() {
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.getElementById('repo-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

// ===== NAV =====
function setupNav() {
  // Mobile toggle
  document.querySelector('.nav-toggle').addEventListener('click', () => {
    document.querySelector('.nav-links').classList.toggle('open');
  });
  // Close mobile nav on link click
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => {
      document.querySelector('.nav-links').classList.remove('open');
    });
  });
  // Active link highlighting
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY + 100;
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      const link = document.querySelector(`.nav-links a[href="#${id}"]`);
      if (link) {
        if (scrollY >= top && scrollY < top + height) link.classList.add('active');
        else link.classList.remove('active');
      }
    });
  });
}

// ===== SCROLL ANIMATIONS =====
function setupScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

// ===== INIT =====
document.getElementById('year').textContent = new Date().getFullYear();

async function init() {
  setupNav();
  setupModal();
  setupFilters();

  // Load everything in parallel
  await Promise.allSettled([
    loadProfile(),
    loadRepos(),
    loadCollaborations(),
    loadStoreApps(),
    loadActivity(),
  ]);

  setupScrollAnimations();
}

init();
