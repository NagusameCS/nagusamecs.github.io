/**
 * NagusameCS Portfolio — Main Application
 * Pulls data live from GitHub API, config JSONs, and store APIs.
 */

const GH_USER = 'NagusameCS';
const GH_API = 'https://api.github.com';
const CONFIG_BASE = 'config';

// Icon overrides — local SVG/PNG for specific repos
const ICON_OVERRIDES = {
  'TensorOS': 'tensoricon.svg',
};

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
let currentView = 'grid';

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

  const isExpanded = currentView === 'expanded';
  grid.className = isExpanded ? 'repo-grid repo-grid-expanded' : 'repo-grid';

  grid.innerHTML = repos.map((repo, i) => {
    const langColor = LANG_COLORS[repo.language] || '#8b949e';
    const overrideIcon = ICON_OVERRIDES[repo.name];
    const iconUrl = overrideIcon || `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${repo.default_branch}/.github/icon.png`;
    const socialPreviewUrl = `https://opengraph.githubassets.com/1/${GH_USER}/${repo.name}`;

    const socialPreviewHtml = isExpanded
      ? `<img class="repo-card-preview" src="${socialPreviewUrl}" alt="" onerror="this.style.display='none'">`
      : '';

    return `
      <div class="repo-card ${isExpanded ? 'repo-card-expanded' : ''} fade-in" data-index="${i}" data-fork="${repo.fork}" style="animation-delay: ${i * 0.03}s">
        <div class="repo-card-header">
          <img class="repo-card-icon" src="${iconUrl}" alt="" onerror="repoIconFallback(this)">
          <div>
            <span class="repo-card-title">${escapeHtml(repo.name)}</span>
            ${repo.fork ? '<span class="repo-card-fork">Fork</span>' : ''}
          </div>
        </div>
        ${socialPreviewHtml}
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
  const overrideIcon = ICON_OVERRIDES[repo.name];
  const iconUrl = overrideIcon || `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${repo.default_branch}/.github/icon.png`;
  // Social preview: use opengraph image
  const socialPreviewUrl = `https://opengraph.githubassets.com/1/${GH_USER}/${repo.name}`;

  // Icon — try override or .github/icon.png → hide on error
  const iconEl = document.getElementById('modal-icon');
  iconEl.src = iconUrl;
  iconEl.style.display = 'block';
  iconEl.onerror = function () {
    this.style.display = 'none';
  };

  // Social preview — try repo's own social image, then OpenGraph
  const previewEl = document.getElementById('modal-social-preview');
  previewEl.classList.remove('visible');

  // Chain: custom .github/social-preview.png → GitHub OpenGraph image
  const customPreview = `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${repo.default_branch}/.github/social-preview.png`;

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

  // Set current repo for tab loading
  currentModalRepo = repo;

  // Reset to Overview tab
  switchModalTab('overview');

  // Clear tab cache for this repo (so lazy loads fire again)
  ['readme', 'releases', 'license'].forEach(t => {
    delete modalTabCache[`${repo.full_name}-${t}`];
  });

  // Load full language breakdown
  loadModalLanguages(repo);
}

function closeModal() {
  document.getElementById('repo-modal').classList.remove('active');
  document.body.style.overflow = '';
  currentModalRepo = null;
}

// Track current modal repo for tab loading
let currentModalRepo = null;
const modalTabCache = {};

function switchModalTab(tabName) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.toggle('active', c.id === `modal-tab-${tabName}`));

  if (!currentModalRepo) return;
  const repo = currentModalRepo;
  const cacheKey = `${repo.full_name}-${tabName}`;

  if (tabName === 'readme' && !modalTabCache[cacheKey]) {
    modalTabCache[cacheKey] = true;
    loadModalReadme(repo);
  } else if (tabName === 'releases' && !modalTabCache[cacheKey]) {
    modalTabCache[cacheKey] = true;
    loadModalReleases(repo);
  } else if (tabName === 'license' && !modalTabCache[cacheKey]) {
    modalTabCache[cacheKey] = true;
    loadModalLicense(repo);
  }
}

async function loadModalReadme(repo) {
  const el = document.getElementById('modal-readme-body');
  el.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading README...</div>';
  try {
    const res = await fetch(`${GH_API}/repos/${repo.full_name}/readme`, {
      headers: { Accept: 'application/vnd.github.html' }
    });
    if (!res.ok) throw new Error('No README');
    const html = await res.text();
    el.innerHTML = html;
  } catch {
    el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No README available.</p>';
  }
}

async function loadModalReleases(repo) {
  const el = document.getElementById('modal-releases-body');
  el.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading releases...</div>';
  try {
    const releases = await fetchJSON(`${GH_API}/repos/${repo.full_name}/releases?per_page=10`);
    if (releases.length === 0) {
      el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No releases published.</p>';
      return;
    }
    el.innerHTML = releases.map(r => {
      const body = r.body ? escapeHtml(r.body).substring(0, 300) + (r.body.length > 300 ? '...' : '') : 'No release notes.';
      return `
        <div class="release-item">
          <h4>${escapeHtml(r.name || r.tag_name)}</h4>
          <span class="release-tag"><i class="fas fa-tag"></i> ${escapeHtml(r.tag_name)} &middot; ${timeAgo(r.published_at || r.created_at)}</span>
          <p>${body}</p>
          <a href="${r.html_url}" target="_blank">View release &rarr;</a>
        </div>`;
    }).join('');
  } catch {
    el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Could not load releases.</p>';
  }
}

async function loadModalLicense(repo) {
  const el = document.getElementById('modal-license-body');
  el.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading license...</div>';
  try {
    const res = await fetch(`${GH_API}/repos/${repo.full_name}/license`);
    if (!res.ok) throw new Error('No license');
    const data = await res.json();
    const content = atob(data.content);
    el.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
  } catch {
    el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No license file found.</p>';
  }
}

async function loadModalLanguages(repo) {
  const el = document.getElementById('modal-languages-detail');
  el.innerHTML = '';
  try {
    const langs = await fetchJSON(`${GH_API}/repos/${repo.full_name}/languages`);
    const entries = Object.entries(langs);
    if (entries.length === 0) return;
    const total = entries.reduce((s, [, v]) => s + v, 0);
    el.innerHTML = entries.map(([lang, bytes]) => {
      const pct = ((bytes / total) * 100).toFixed(1);
      const color = LANG_COLORS[lang] || '#8b949e';
      return `<span class="modal-lang-tag"><span class="lang-dot" style="background:${color}"></span>${lang} ${pct}%</span>`;
    }).join('');
  } catch {
    // Silently fail
  }
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

  // View toggle buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderRepos(allRepos);
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

  // Tab clicks
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => switchModalTab(tab.dataset.tab));
  });

  // Chevron navigation
  const tabNames = ['overview', 'readme', 'releases', 'license'];
  document.querySelector('.modal-chevron-left').addEventListener('click', () => {
    const currentTab = document.querySelector('.modal-tab.active')?.dataset.tab || 'overview';
    const idx = tabNames.indexOf(currentTab);
    const prev = tabNames[(idx - 1 + tabNames.length) % tabNames.length];
    switchModalTab(prev);
  });
  document.querySelector('.modal-chevron-right').addEventListener('click', () => {
    const currentTab = document.querySelector('.modal-tab.active')?.dataset.tab || 'overview';
    const idx = tabNames.indexOf(currentTab);
    const next = tabNames[(idx + 1) % tabNames.length];
    switchModalTab(next);
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

// ===== KONAMI CODE EASTER EGG — AGAR.IO MODE =====
(function () {
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
  let seq = 0;
  let active = false;

  // State
  let blob, hud, blobSize, blobX, blobY, targetX, targetY, frame, food, eaten, scrollY0;

  document.addEventListener('keydown', (e) => {
    if (active) {
      if (e.key === 'Escape') stopAgar();
      return;
    }
    const expect = KONAMI[seq];
    // Match by e.key for all keys (ArrowUp, ArrowDown, b, a, etc.)
    const keyVal = e.key;
    let match = false;
    if (expect.startsWith('Arrow')) {
      match = keyVal === expect;
    } else if (expect === 'KeyB') {
      match = keyVal.toLowerCase() === 'b';
    } else if (expect === 'KeyA') {
      match = keyVal.toLowerCase() === 'a';
    }

    if (match) {
      seq++;
      if (seq === KONAMI.length) {
        seq = 0;
        startAgar();
      }
    } else {
      // Check if this key restarts the sequence
      seq = (keyVal === 'ArrowUp') ? 1 : 0;
    }
  });

  function startAgar() {
    if (active) return;
    active = true;
    eaten = 0;
    blobSize = 120;
    scrollY0 = window.scrollY;

    const avatarSrc = document.getElementById('avatar').src;

    // Blob element
    blob = document.createElement('div');
    blob.id = 'agar-blob';
    Object.assign(blob.style, {
      position: 'fixed', left: '0', top: '0',
      width: blobSize + 'px', height: blobSize + 'px',
      borderRadius: '50%', zIndex: '99999', pointerEvents: 'none',
      backgroundImage: `url(${avatarSrc})`, backgroundSize: 'cover', backgroundPosition: 'center',
      border: '3px solid rgba(255,255,255,0.35)',
      boxShadow: '0 0 30px rgba(255,255,255,0.08)',
      transform: 'translate(-50%,-50%)',
      transition: 'width 0.2s ease, height 0.2s ease',
    });
    document.body.appendChild(blob);

    // HUD
    hud = document.createElement('div');
    hud.id = 'agar-hud';
    hud.innerHTML = `
      <div style="position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:100000;
        background:rgba(0,0,0,0.9);border:1px solid #333;border-radius:8px;padding:10px 22px;
        font-family:inherit;color:#fff;text-align:center;pointer-events:none;font-size:0.82rem;
        backdrop-filter:blur(6px);">
        <div style="font-size:1rem;font-weight:700;letter-spacing:1px;margin-bottom:3px;">AGAR MODE</div>
        <div>Eaten: <strong id="agar-eaten">0</strong> &nbsp;&middot;&nbsp; Size: <strong id="agar-size">120</strong></div>
        <div style="color:#666;font-size:0.7rem;margin-top:3px;">Move mouse &middot; ESC to exit</div>
      </div>`;
    document.body.appendChild(hud);

    // Disable scrolling
    document.body.style.overflow = 'hidden';

    // Hide original avatar
    document.getElementById('avatar').style.visibility = 'hidden';

    // Starting position = center of viewport
    blobX = window.innerWidth / 2;
    blobY = window.innerHeight / 2;
    targetX = blobX;
    targetY = blobY;

    collectFood();

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onTouch, { passive: false });

    frame = requestAnimationFrame(loop);
  }

  // Gather all "edible" elements
  function collectFood() {
    const sels = [
      '.skill-tag', '.about-detail-tag', '.highlight-item',
      '.repo-card', '.store-card', '.award-card', '.collab-card',
      '.contact-card', '.activity-item', '.timeline-item',
      '.filter-btn', '.view-btn', '.stat', '.lang-bar',
      '.section-title', '.nav-logo', '.nav-links a',
      '.hero-meta span', '.hero-bio', '.store-badge',
      '.modal-topic', '.repo-card-meta span',
    ];
    food = [];
    sels.forEach(s => {
      document.querySelectorAll(s).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && !el.dataset.agarEaten) {
          food.push(el);
        }
      });
    });
  }

  function onMove(e) { targetX = e.clientX; targetY = e.clientY; }
  function onTouch(e) { e.preventDefault(); targetX = e.touches[0].clientX; targetY = e.touches[0].clientY; }

  function loop() {
    if (!active) return;

    // Smooth movement — larger blob moves slower like real agar.io
    const speed = Math.max(0.03, 0.1 - blobSize * 0.00008);
    blobX += (targetX - blobX) * speed;
    blobY += (targetY - blobY) * speed;

    blob.style.left = blobX + 'px';
    blob.style.top = blobY + 'px';
    blob.style.width = blobSize + 'px';
    blob.style.height = blobSize + 'px';

    // Collision detection
    const blobR = blobSize / 2;

    for (let i = food.length - 1; i >= 0; i--) {
      const el = food[i];
      if (el.dataset.agarEaten) { food.splice(i, 1); continue; }

      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;

      const elSize = Math.max(r.width, r.height);

      // Must be bigger to eat
      if (blobSize <= elSize) continue;

      // Distance from blob center to element center
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(blobX - cx, blobY - cy);

      // Eat when the element center is within the blob
      if (dist < blobR * 0.65) {
        eatEl(el, elSize);
        food.splice(i, 1);
      }
    }

    // Auto-scroll the page toward the blob if it's near edges
    const margin = 60;
    if (blobY < margin) window.scrollBy(0, -6);
    else if (blobY > window.innerHeight - margin) window.scrollBy(0, 6);

    // Re-collect food periodically (for elements that came into view from scrolling)
    if (Math.random() < 0.01) collectFood();

    frame = requestAnimationFrame(loop);
  }

  function eatEl(el, elSize) {
    el.dataset.agarEaten = '1';

    // Satisfying consume animation
    el.style.transition = 'transform 0.25s cubic-bezier(0.4,0,1,1), opacity 0.25s ease';
    el.style.transformOrigin = 'center';
    el.style.transform = 'scale(0) rotate(10deg)';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';

    // Grow — bigger items = more growth
    const growth = Math.max(1.5, Math.sqrt(elSize) * 0.6);
    blobSize += growth;

    // Pulse effect on blob
    blob.style.transition = 'width 0.1s ease, height 0.1s ease';
    setTimeout(() => {
      blob.style.transition = 'width 0.2s ease, height 0.2s ease';
    }, 100);

    // Update HUD
    eaten++;
    const eatenEl = document.getElementById('agar-eaten');
    const sizeEl = document.getElementById('agar-size');
    if (eatenEl) eatenEl.textContent = eaten;
    if (sizeEl) sizeEl.textContent = Math.round(blobSize);
  }

  function stopAgar() {
    active = false;
    cancelAnimationFrame(frame);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onTouch);

    // Remove blob + HUD
    if (blob) blob.remove();
    if (hud) hud.remove();

    // Restore all eaten elements
    document.querySelectorAll('[data-agar-eaten]').forEach(el => {
      el.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
      el.style.transform = '';
      el.style.opacity = '';
      el.style.pointerEvents = '';
      delete el.dataset.agarEaten;
    });

    // Restore avatar + scrolling
    document.getElementById('avatar').style.visibility = '';
    document.body.style.overflow = '';
    window.scrollTo(0, scrollY0);
  }
})();
