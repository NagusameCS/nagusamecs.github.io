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
  const bioText = profile.bio || 'Great things are not done quickly';
  document.getElementById('bio').textContent = bioText;

  // Meta
  if (profile.company) {
    document.getElementById('company-link').textContent = profile.company;
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
    return `
      <div class="repo-card fade-in" data-index="${i}" data-fork="${repo.fork}" style="animation-delay: ${i * 0.03}s">
        <div class="repo-card-header">
          <img class="repo-card-icon" src="${iconUrl}" alt="" onerror="repoIconFallback(this)">
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
  // .github/icon.png failed — show a clean placeholder
  const name = img.closest('.repo-card')?.querySelector('.repo-card-title')?.textContent || '';
  const letter = name.charAt(0).toUpperCase() || '?';
  img.outerHTML = `<div class="repo-card-icon-placeholder">${letter}</div>`;
}

// ===== REPO MODAL =====
function openRepoModal(repo) {
  const modal = document.getElementById('repo-modal');
  const langColor = LANG_COLORS[repo.language] || '#8b949e';
  const iconUrl = `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${repo.default_branch}/.github/icon.png`;
  // Social preview: use opengraph image
  const socialPreviewUrl = `https://opengraph.githubassets.com/1/${GH_USER}/${repo.name}`;

  // Icon — try .github/icon.png → letter placeholder
  const iconEl = document.getElementById('modal-icon');
  iconEl.src = iconUrl;
  iconEl.onerror = function () {
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
  try {
    let allEvents = [];
    for (let p = 1; p <= 3; p++) {
      const events = await fetchJSONSafe(`${GH_API}/users/${GH_USER}/events/public?per_page=100&page=${p}`, []);
      allEvents = allEvents.concat(events);
      if (events.length < 100) break;
    }

    // Count events per day for last 90 days
    const dayCounts = {};
    allEvents.forEach(ev => {
      const day = ev.created_at.split('T')[0];
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    const today = new Date();
    const days = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, count: dayCounts[dateStr] || 0, day: d });
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);
    const totalEvents = days.reduce((s, d) => s + d.count, 0);
    const activeDays = days.filter(d => d.count > 0).length;

    // Build SVG pulse bar chart
    const barW = 7;
    const gap = 2;
    const svgW = days.length * (barW + gap);
    const svgH = 100;

    const bars = days.map((d, i) => {
      const x = i * (barW + gap);
      if (d.count === 0) return '';
      const h = Math.max(3, (d.count / maxCount) * svgH);
      const y = svgH - h;
      const op = (0.35 + (d.count / maxCount) * 0.65).toFixed(2);
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="1.5" fill="#fff" opacity="${op}"><title>${d.date}: ${d.count} event${d.count > 1 ? 's' : ''}</title></rect>`;
    }).join('');

    // Month labels below the bars
    const months = [];
    let lastM = -1;
    days.forEach((d, i) => {
      const m = d.day.getMonth();
      if (m !== lastM) {
        lastM = m;
        months.push(`<text x="${i * (barW + gap)}" y="${svgH + 14}" fill="#666" font-size="10" font-family="inherit">${d.day.toLocaleDateString('en-US', { month: 'short' })}</text>`);
      }
    });

    container.innerHTML = `
      <div class="pulse-header">
        <div class="pulse-stats">
          <span><strong>${totalEvents}</strong> events</span>
          <span><strong>${activeDays}</strong> active days</span>
        </div>
        <span class="pulse-period">Last 90 days</span>
      </div>
      <div class="pulse-chart">
        <svg width="100%" height="${svgH + 20}" viewBox="0 0 ${svgW} ${svgH + 20}" preserveAspectRatio="none">
          <line x1="0" y1="${svgH}" x2="${svgW}" y2="${svgH}" stroke="#222" stroke-width="1"/>
          ${bars}
          ${months.join('')}
        </svg>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem;">Could not load activity data.</p>`;
  }
}

async function loadRecentActivity() {
  const feed = document.getElementById('activity-feed');
  try {
    const events = await fetchJSON(`${GH_API}/users/${GH_USER}/events/public?per_page=30`);

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
      const repoName = ev.repo.name.split('/')[1];
      const repoLink = `<a href="https://github.com/${ev.repo.name}" target="_blank"><strong>${repoName}</strong></a>`;
      switch (ev.type) {
        case 'PushEvent': {
          const commits = ev.payload.commits || [];
          if (commits.length === 0) return null;
          const msg = commits[0].message.split('\n')[0];
          const extra = commits.length > 1 ? ` (+${commits.length - 1} more)` : '';
          return `Pushed to ${repoLink}: "${escapeHtml(msg)}"${extra}`;
        }
        case 'CreateEvent':
          if (ev.payload.ref_type === 'repository') return `Created repository ${repoLink}`;
          return `Created ${ev.payload.ref_type} <strong>${ev.payload.ref || ''}</strong> in ${repoLink}`;
        case 'DeleteEvent':
          return `Deleted ${ev.payload.ref_type} <strong>${ev.payload.ref}</strong> in ${repoLink}`;
        case 'WatchEvent':
          return `Starred ${repoLink}`;
        case 'ForkEvent':
          return `Forked ${repoLink}`;
        case 'IssuesEvent':
          return `${ev.payload.action} issue in ${repoLink}`;
        case 'IssueCommentEvent':
          return `Commented on issue in ${repoLink}`;
        case 'PullRequestEvent':
          return `${ev.payload.action} PR in ${repoLink}`;
        case 'PullRequestReviewEvent':
          return `Reviewed PR in ${repoLink}`;
        case 'ReleaseEvent':
          return `Published release in ${repoLink}`;
        default:
          return `Activity in ${repoLink}`;
      }
    }

    const items = events
      .map(ev => ({ ev, desc: describeEvent(ev) }))
      .filter(({ desc }) => desc !== null)
      .slice(0, 10);

    if (items.length === 0) {
      feed.innerHTML = '<li class="activity-item"><span class="activity-text" style="color:var(--text-muted)">No recent activity.</span></li>';
      return;
    }

    feed.innerHTML = items.map(({ ev, desc }) => `
      <li class="activity-item">
        <i class="${eventIcons[ev.type] || 'fas fa-bolt'}"></i>
        <span class="activity-text">${desc}</span>
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
