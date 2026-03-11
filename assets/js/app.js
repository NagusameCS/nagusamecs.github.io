/**
 * NagusameCS Portfolio — Main Application
 * Pulls data live from GitHub API, config JSONs, and store APIs.
 */

// ===== INTRO ANIMATION =====
(function runIntro() {
  const overlay = document.getElementById('intro-overlay');
  const slash = document.getElementById('intro-slash');
  if (!overlay || !slash) return;

  document.body.classList.add('intro-active');

  // Diagonal length from top-right to bottom-left
  const diag = Math.hypot(window.innerWidth, window.innerHeight);
  const angle = Math.atan2(window.innerHeight, window.innerWidth) * (180 / Math.PI);

  // Position the slash at top-right, rotated toward bottom-left
  slash.style.transform = `rotate(-${angle}deg)`;
  slash.style.width = '0px';
  slash.style.height = '1px';

  // Phase 1: Line shoots across, starting thin and getting thicker
  requestAnimationFrame(() => {
    slash.style.transition = 'width 0.45s cubic-bezier(0.16, 1, 0.3, 1), height 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
    slash.style.width = diag + 'px';
    slash.style.height = '4px';
  });

  // Phase 2: Overlay flips to black as the line finishes
  setTimeout(() => {
    overlay.classList.add('to-black');
  }, 380);

  // Phase 3: Fade out the black overlay to reveal the site
  setTimeout(() => {
    slash.style.display = 'none';
    overlay.classList.add('fade-out');
    document.body.classList.remove('intro-active');
  }, 560);

  // Clean up
  setTimeout(() => {
    overlay.remove();
  }, 890);
})();

const GH_USER = 'NagusameCS';
const GH_API = 'https://api.github.com';
const CONFIG_BASE = 'config';

// Icon overrides — local SVG/PNG for specific repos
const ICON_OVERRIDES = {
  'TensorOS': 'tensoricon.svg',
  'GitAudit': 'assets/icons/gitaudit.svg',
  'HEATMAP': 'assets/icons/heatmap.svg',
  'IVY': 'assets/icons/ivy.png',
  'OpenNotes': 'assets/icons/opennotes.svg',
  'OpenNotesAPI': 'assets/icons/opennotesapi.png',
  'Pseudocode': 'assets/icons/pseudocode.png',
  'Shell': 'assets/icons/shell.svg',
  'Valentin': 'assets/icons/valentin.svg',
  'Veritas': 'assets/icons/veritas.svg',
  'opencs-repo': 'assets/icons/opencs-repo.svg',
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

  // Avatar — use local copy for faster loading
  document.getElementById('avatar').src = 'assets/avatar.png';

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

    const socialPreviewHtml = isExpanded
      ? `<img class="repo-card-preview" src="https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${repo.default_branch || 'main'}/.github/social-preview.png" alt="" onerror="this.style.display='none'">`
      : '';

    const letter = (repo.name.charAt(0) || '?').toUpperCase();
    const heatmapClass = repo.name === 'HEATMAP' ? ' heatmap-icon-bg' : '';
    const iconHtml = overrideIcon
      ? `<img class="repo-card-icon${heatmapClass}" src="${overrideIcon}" alt="" onerror="repoIconFallback(this)">`
      : `<div class="repo-card-icon-placeholder">${letter}</div>`;

    return `
      <div class="repo-card ${isExpanded ? 'repo-card-expanded' : ''} fade-in" data-index="${i}" data-fork="${repo.fork}" style="animation-delay: ${i * 0.03}s">
        <div class="repo-card-header">
          ${iconHtml}
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

// ===== FEATURED CAROUSEL — REMOVED =====

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

  // Icon — only show image if there's an override, otherwise hide
  const iconEl = document.getElementById('modal-icon');
  if (overrideIcon) {
    iconEl.src = overrideIcon;
    iconEl.style.display = 'block';
    iconEl.className = repo.name === 'HEATMAP' ? 'modal-icon heatmap-icon-bg' : 'modal-icon';
    iconEl.onerror = function () { this.style.display = 'none'; };
  } else {
    iconEl.style.display = 'none';
    iconEl.className = 'modal-icon';
  }

  // Social preview — try multiple custom paths, then hide if none found
  const previewEl = document.getElementById('modal-social-preview');
  previewEl.classList.remove('visible');

  const branch = repo.default_branch || 'main';
  const previewCandidates = [
    `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${branch}/.github/social-preview.png`,
    `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${branch}/.github/social-preview.jpg`,
    `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${branch}/.github/preview.png`,
    `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${branch}/.github/preview.jpg`,
    `https://raw.githubusercontent.com/${GH_USER}/${repo.name}/${branch}/.github/banner.png`,
  ];

  function tryPreview(idx) {
    if (idx >= previewCandidates.length) {
      // No custom preview found — hide
      previewEl.style.display = 'none';
      return;
    }
    const testImg = new Image();
    testImg.onload = function () {
      previewEl.src = previewCandidates[idx];
      previewEl.style.display = '';
      previewEl.classList.add('visible');
    };
    testImg.onerror = function () { tryPreview(idx + 1); };
    testImg.src = previewCandidates[idx];
  }
  tryPreview(0);

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
    // Fetch raw README markdown from GitHub API
    const meta = await fetchJSON(`${GH_API}/repos/${repo.full_name}/readme`);
    const rawUrl = meta.download_url;
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error('No README');
    const md = await res.text();

    // Configure marked with GitHub-flavored markdown
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    // Fix relative image/link URLs to point to the repo's raw content
    const baseRaw = `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/`;
    const baseRepo = `https://github.com/${repo.full_name}/blob/${repo.default_branch}/`;

    const renderer = new marked.Renderer();

    // Rewrite relative image src to raw.githubusercontent
    renderer.image = function (token) {
      let href, title, text;
      if (typeof token === 'object' && token !== null) {
        href = token.href || '';
        title = token.title || '';
        text = token.text || '';
      } else {
        href = token || '';
        title = arguments[1] || '';
        text = arguments[2] || '';
      }
      if (href && !href.startsWith('http') && !href.startsWith('data:')) {
        href = baseRaw + href.replace(/^\.\//, '');
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${href}" alt="${escapeHtml(text || '')}"${titleAttr} style="max-width:100%;">`;
    };

    // Rewrite relative link href to GitHub blob
    renderer.link = function (token) {
      let href, title, text;
      if (typeof token === 'object' && token !== null) {
        href = token.href || '';
        title = token.title || '';
        text = token.text || '';
      } else {
        href = token || '';
        title = arguments[1] || '';
        text = arguments[2] || '';
      }
      if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
        href = baseRepo + href.replace(/^\.\//, '');
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener">${text}</a>`;
    };

    // Checkbox list items (GitHub task lists)
    renderer.listitem = function (token) {
      let text;
      if (typeof token === 'object' && token !== null) {
        text = token.text || '';
      } else {
        text = token || '';
      }
      if (typeof text === 'string' && text.startsWith('<input')) {
        return `<li class="task-list-item">${text}</li>\n`;
      }
      return `<li>${text}</li>\n`;
    };

    marked.use({ renderer });
    const html = marked.parse(md);
    el.innerHTML = `<div class="markdown-body">${html}</div>`;

    // Apply syntax highlighting to any code blocks that weren't caught
    el.querySelectorAll('pre code').forEach(block => {
      hljs.highlightElement(block);
    });
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
    const data = await fetchJSON(`https://github-contributions-api.jogruber.de/v4/${GH_USER}?y=last`);
    const contributions = data.contributions || [];

    const dayMap = {};
    contributions.forEach(day => { dayMap[day.date] = day.count; });

    const today = new Date();
    const days = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ date: dateStr, count: dayMap[dateStr] || 0, day: d });
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);
    const totalContributions = days.reduce((s, d) => s + d.count, 0);
    const activeDays = days.filter(d => d.count > 0).length;
    const currentStreak = computeStreak(days);

    // Best day
    const bestDay = days.reduce((best, d) => d.count > best.count ? d : best, days[0]);

    const cellSize = 11;
    const cellGap = 2;
    const cellStep = cellSize + cellGap;

    const firstDow = days[0].day.getDay();
    const weeks = [];
    let currentWeek = new Array(7).fill(null);
    for (let i = 0; i < firstDow; i++) currentWeek[i] = null;
    days.forEach((d, idx) => {
      const dow = d.day.getDay();
      currentWeek[dow] = d;
      if (dow === 6 || idx === days.length - 1) {
        weeks.push(currentWeek);
        currentWeek = new Array(7).fill(null);
      }
    });

    const numWeeks = weeks.length;
    const dayLabelsW = 28;
    const svgW = dayLabelsW + numWeeks * cellStep;
    const svgH = 7 * cellStep + 24;
    const gridTop = 18;

    // Green-tinted intensity scale (GitHub-style but monochrome-friendly)
    const LEVELS = [
      '#161b22',           // 0 — empty
      '#0e4429',           // 1 — low
      '#006d32',           // 2 — medium-low
      '#26a641',           // 3 — medium-high
      '#39d353',           // 4 — high
    ];
    function getCellLevel(count) {
      if (count === 0) return 0;
      const ratio = count / maxCount;
      if (ratio <= 0.25) return 1;
      if (ratio <= 0.50) return 2;
      if (ratio <= 0.75) return 3;
      return 4;
    }

    let cells = '';
    weeks.forEach((week, wi) => {
      week.forEach((d, di) => {
        if (!d) return;
        const x = dayLabelsW + wi * cellStep;
        const y = gridTop + di * cellStep;
        const level = getCellLevel(d.count);
        cells += `<rect class="heatmap-cell" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${LEVELS[level]}" data-date="${d.date}" data-count="${d.count}" data-level="${level}"/>`;
      });
    });

    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    const dayLabelsSvg = dayLabels.map((label, i) => {
      if (!label) return '';
      const y = gridTop + i * cellStep + cellSize - 1;
      return `<text x="0" y="${y}" fill="#484f58" font-size="9" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${label}</text>`;
    }).join('');

    let monthLabels = '';
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const firstDay = week.find(d => d !== null);
      if (!firstDay) return;
      const m = firstDay.day.getMonth();
      if (m !== lastMonth) {
        lastMonth = m;
        const x = dayLabelsW + wi * cellStep;
        monthLabels += `<text x="${x}" y="10" fill="#484f58" font-size="9" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${firstDay.day.toLocaleDateString('en-US', { month: 'short' })}</text>`;
      }
    });

    container.innerHTML = `
      <div class="graph-header">
        <div class="graph-stat-group">
          <div class="graph-stat">
            <span class="graph-stat-value">${totalContributions.toLocaleString()}</span>
            <span class="graph-stat-label">contributions</span>
          </div>
          <div class="graph-stat">
            <span class="graph-stat-value">${activeDays}</span>
            <span class="graph-stat-label">active days</span>
          </div>
          ${currentStreak > 0 ? `<div class="graph-stat"><span class="graph-stat-value">${currentStreak}</span><span class="graph-stat-label">day streak</span></div>` : ''}
          ${bestDay.count > 0 ? `<div class="graph-stat"><span class="graph-stat-value">${bestDay.count}</span><span class="graph-stat-label">best day</span></div>` : ''}
        </div>
        <span class="graph-period">Last 365 days</span>
      </div>
      <div class="heatmap-chart">
        <svg width="100%" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMinYMid meet">
          ${monthLabels}
          ${dayLabelsSvg}
          ${cells}
        </svg>
      </div>
      <div class="heatmap-footer">
        <a href="https://github.com/${GH_USER}" target="_blank" class="heatmap-link">View full profile on GitHub &rarr;</a>
        <div class="heatmap-legend">
          <span class="heatmap-legend-label">Less</span>
          ${LEVELS.map(c => `<span class="heatmap-legend-cell" style="background:${c}"></span>`).join('')}
          <span class="heatmap-legend-label">More</span>
        </div>
      </div>
    `;

    // Interactive tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'heatmap-tooltip';
    document.body.appendChild(tooltip);

    const svg = container.querySelector('.heatmap-chart svg');
    svg.addEventListener('mouseover', (e) => {
      const rect = e.target.closest('.heatmap-cell');
      if (!rect) return;
      const count = parseInt(rect.dataset.count);
      const dateStr = rect.dataset.date;
      const dateObj = new Date(dateStr + 'T12:00:00');
      const formatted = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      tooltip.innerHTML = `<strong>${count} contribution${count !== 1 ? 's' : ''}</strong><span class="tooltip-date">${formatted}</span>`;
      tooltip.classList.add('visible');
    });
    svg.addEventListener('mousemove', (e) => {
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 36) + 'px';
    });
    svg.addEventListener('mouseout', (e) => {
      if (e.target.classList?.contains('heatmap-cell')) {
        tooltip.classList.remove('visible');
      }
    });
  } catch (e) {
    container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem;">Could not load activity data.</p>`;
  }
}

function computeStreak(days) {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak++;
    else break;
  }
  return streak;
}

async function loadRecentActivity() {
  const feed = document.getElementById('activity-feed');
  try {
    // Fetch all available event pages (GitHub keeps up to 10 pages of 100)
    let allEvents = [];
    for (let p = 1; p <= 10; p++) {
      const batch = await fetchJSONSafe(`${GH_API}/users/${GH_USER}/events/public?per_page=100&page=${p}`, []);
      allEvents = allEvents.concat(batch);
      if (batch.length < 100) break;
    }
    const events = allEvents;

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
      .filter(({ desc }) => desc !== null);

    if (items.length === 0) {
      feed.innerHTML = '<li class="activity-item"><span class="activity-text" style="color:var(--text-muted)">No recent activity.</span></li>';
      return;
    }

    // Show initial batch, with "Show More" button if there are more
    const INITIAL_COUNT = 15;
    const showItems = (count) => {
      const visible = items.slice(0, count);
      feed.innerHTML = visible.map(({ ev, desc }) => `
        <li class="activity-item">
          <i class="${eventIcons[ev.type] || 'fas fa-bolt'}"></i>
          <span class="activity-text">${desc}</span>
          <span class="activity-time">${timeAgo(ev.created_at)}</span>
        </li>
      `).join('');
      if (count < items.length) {
        const more = document.createElement('li');
        more.className = 'activity-show-more';
        more.innerHTML = `<button class="btn btn-secondary" style="width:100%;justify-content:center;">Show more (${items.length - count} remaining)</button>`;
        more.querySelector('button').addEventListener('click', () => showItems(count + 30));
        feed.appendChild(more);
      }
    };
    showItems(INITIAL_COUNT);
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
  setupCurrencyConversion();
  setupServiceCardToggle();
  setupRateTabs();


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

// ===== CURRENCY CONVERSION =====
// ===== SERVICE CARD SUB-SERVICE TOGGLE =====
function setupServiceCardToggle() {
  document.querySelectorAll('.service-card.expandable').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.sub-service')) return;
      card.classList.toggle('expanded');
    });
  });
}

function setupCurrencyConversion() {
  const RATES = {
    USD: { rate: 1, symbol: '$', decimals: 0 },
    EUR: { rate: 0.92, symbol: '\u20ac', decimals: 0 },
    GBP: { rate: 0.79, symbol: '\u00a3', decimals: 0 },
    MXN: { rate: 17.15, symbol: '$', decimals: 0 },
    JPY: { rate: 149.5, symbol: '\u00a5', decimals: 0 },
    CAD: { rate: 1.36, symbol: '$', decimals: 0 },
    AUD: { rate: 1.53, symbol: '$', decimals: 0 },
  };

  let currentCurrency = 'USD';

  // Try to auto-detect region
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.startsWith('Europe/London') || tz.startsWith('Europe/Belfast')) currentCurrency = 'GBP';
    else if (tz.startsWith('Europe/')) currentCurrency = 'EUR';
    else if (tz.startsWith('America/Mexico') || tz === 'America/Cancun' || tz === 'America/Merida' || tz === 'America/Monterrey' || tz === 'America/Matamoros' || tz === 'America/Mazatlan' || tz === 'America/Chihuahua' || tz === 'America/Hermosillo' || tz === 'America/Tijuana' || tz === 'America/Bahia_Banderas' || tz === 'America/Ojinaga') currentCurrency = 'MXN';
    else if (tz.startsWith('Asia/Tokyo')) currentCurrency = 'JPY';
    else if (tz.startsWith('America/Toronto') || tz.startsWith('America/Vancouver') || tz.startsWith('America/Edmonton') || tz.startsWith('America/Winnipeg') || tz.startsWith('America/Halifax') || tz.startsWith('America/St_Johns')) currentCurrency = 'CAD';
    else if (tz.startsWith('Australia/')) currentCurrency = 'AUD';
  } catch (e) {}

  function formatNumber(n) {
    return n >= 1000 ? n.toLocaleString('en-US') : String(n);
  }

  function updateRates(currency) {
    currentCurrency = currency;
    const info = RATES[currency];
    const multiplier = 1;
    document.querySelectorAll('.service-rate').forEach(el => {
      const baseUSD = parseFloat(el.dataset.rate);
      const isFlat = el.dataset.flat === 'true';
      const converted = Math.round(baseUSD * info.rate * (isFlat ? 1 : multiplier));
      el.dataset.display = `${info.symbol}${formatNumber(converted)}`;
    });
    const label = document.getElementById('currency-label');
    if (label) label.textContent = currency;
    document.querySelectorAll('.currency-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.currency === currency);
    });
  }

  // Toggle currency selector visibility
  const toggleBtn = document.getElementById('currency-toggle');
  const selector = document.getElementById('currency-selector');
  if (toggleBtn && selector) {
    toggleBtn.addEventListener('click', () => {
      selector.style.display = selector.style.display === 'none' ? '' : 'none';
    });
  }

  // Currency button clicks
  document.querySelectorAll('.currency-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      updateRates(btn.dataset.currency);
    });
  });

  // Initialize
  updateRates(currentCurrency);
}

// ===== RATE TYPE TABS =====
function setupRateTabs() {
  const tabs = document.querySelectorAll('.rate-tab');
  const panels = document.querySelectorAll('.rate-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`panel-${tab.dataset.tab}`);
      if (target) target.classList.add('active');
    });
  });
}



// ===== ORBITING SOCIAL BUTTONS — 3D RING (EDGE-ON) =====
(function () {
  function initOrbitSocials() {
    const container = document.getElementById('hero-socials');
    if (!container) return;
    const btns = Array.from(container.querySelectorAll('.social-btn'));
    const count = btns.length;
    const wrapper = container.closest('.avatar-orbit-wrapper');
    if (!wrapper) return;

    const BASE_SPEED = 0.0007;   // radians per ms (normal speed)
    const MIN_SPEED = 0.00012;   // radians per ms (when cursor is right on top)
    const SLOW_RADIUS = 200;     // px — cursor within this distance starts slowing
    const RADIUS_X = 108;        // horizontal radius (wide)
    const RADIUS_Y = 18;         // vertical radius (flat ring)
    const SCALE_FRONT = 1.05;
    const SCALE_BACK = 0.6;
    const OPACITY_FRONT = 1.0;
    const OPACITY_BACK = 0.35;
    const BTN_SIZE = 36;
    const DOCK_RIGHT = 20;       // px from right viewport edge
    const DOCK_TOP = 68;         // px from top (below nav)
    const DOCK_GAP = 44;         // vertical spacing in docked column

    const heroSection = document.getElementById('hero');
    let isDocked = false;
    let flyT = 0;                // smoothed scroll progress 0..1
    let orbitAngle = 0;
    let lastTime = performance.now();

    // Track mouse for proximity slowdown
    let mouseX = -9999, mouseY = -9999;
    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
    document.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; });

    function animate(now) {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;

      /* --- cursor proximity → speed (cubic ease for gentle transition) --- */
      const wr = wrapper.getBoundingClientRect();
      const wrapCX = wr.left + wr.width / 2;
      const wrapCY = wr.top + wr.height / 2;
      const cursorDist = Math.hypot(mouseX - wrapCX, mouseY - wrapCY);
      const rawProximity = Math.max(0, Math.min(1, 1 - cursorDist / SLOW_RADIUS));
      // Cubic ease: barely noticeable at edge, strong only when very close
      const proximity = rawProximity * rawProximity * rawProximity;
      const speed = BASE_SPEED + (MIN_SPEED - BASE_SPEED) * proximity;
      orbitAngle += speed * dt;

      /* --- scroll progress --- */
      let rawScroll = 0;
      if (heroSection) {
        const r = heroSection.getBoundingClientRect();
        rawScroll = Math.max(0, Math.min(1, -r.top / (r.height * 0.55)));
      }
      flyT += (rawScroll - flyT) * 0.07;

      /* --- dock / undock --- */
      if (flyT > 0.97 && !isDocked) {
        isDocked = true;
        container.classList.remove('orbit-mode');
        container.classList.add('docked-mode');
        document.body.appendChild(container);
        btns.forEach(btn => {
          btn.style.position = '';
          btn.style.left = '';
          btn.style.top = '';
          btn.style.transform = '';
          btn.style.opacity = '';
          btn.style.zIndex = '';
        });
      } else if (flyT < 0.93 && isDocked) {
        isDocked = false;
        container.classList.remove('docked-mode');
        container.classList.add('orbit-mode');
        wrapper.appendChild(container);
      }

      /* --- animate buttons (all in viewport coords via position:fixed) --- */
      if (!isDocked) {
        const cx = wr.left + wr.width / 2;
        const cy = wr.top + wr.height / 2;
        const halfBtn = BTN_SIZE / 2;

        // Dock target: vertical column, top-right of viewport
        const dockX = window.innerWidth - DOCK_RIGHT - BTN_SIZE;

        // Smoothstep for fly interpolation (eases in and out)
        const st = flyT * flyT * (3 - 2 * flyT);

        btns.forEach((btn, i) => {
          const baseAngle = (2 * Math.PI * i) / count;
          const angle = baseAngle + orbitAngle;

          // Orbit position in viewport coords
          const orbX = cx + RADIUS_X * Math.cos(angle) - halfBtn;
          const orbY = cy + RADIUS_Y * Math.sin(angle) - halfBtn;

          // Dock position in viewport coords (vertical column)
          const dkX = dockX;
          const dkY = DOCK_TOP + i * DOCK_GAP;

          // Depth effects
          const depth = Math.sin(angle);
          const scaleOrb = SCALE_BACK + (SCALE_FRONT - SCALE_BACK) * (depth + 1) / 2;
          const opacityOrb = OPACITY_BACK + (OPACITY_FRONT - OPACITY_BACK) * (depth + 1) / 2;

          // Interpolate orbit → dock
          const x = orbX + (dkX - orbX) * st;
          const y = orbY + (dkY - orbY) * st;
          const sc = scaleOrb + (1 - scaleOrb) * st;
          const op = opacityOrb + (1 - opacityOrb) * st;

          btn.style.position = 'fixed';
          btn.style.left = x + 'px';
          btn.style.top = y + 'px';
          btn.style.transform = 'scale(' + sc.toFixed(3) + ')';
          btn.style.opacity = op.toFixed(3);
          btn.style.zIndex = depth > 0 ? 3 : 0;
        });
      }

      requestAnimationFrame(animate);
    }

    container.classList.add('orbit-mode');
    requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initOrbitSocials, 600));
  } else {
    setTimeout(initOrbitSocials, 600);
  }
})();

// ===== LONG-PRESS EASTER EGG — AGAR.IO MODE =====
(function () {
  let active = false;
  let holdTimer = null;
  const HOLD_MS = 1500; // hold for 1.5 seconds

  // State
  let blob, hud, blobSize, blobX, blobY, targetX, targetY, frame, food, eaten, scrollY0;

  // Activate on long-press of the avatar
  function attachTrigger() {
    const avatar = document.getElementById('avatar');
    if (!avatar) return;

    function startHold(e) {
      if (active) return;
      e.preventDefault();
      holdTimer = setTimeout(() => startAgar(), HOLD_MS);
    }
    function cancelHold() {
      clearTimeout(holdTimer);
    }

    avatar.addEventListener('mousedown', startHold);
    avatar.addEventListener('touchstart', startHold, { passive: false });
    avatar.addEventListener('mouseup', cancelHold);
    avatar.addEventListener('mouseleave', cancelHold);
    avatar.addEventListener('touchend', cancelHold);
    avatar.addEventListener('touchcancel', cancelHold);
  }

  // Also listen for ESC to exit
  document.addEventListener('keydown', (e) => {
    if (active && e.key === 'Escape') stopAgar();
  });

  // Attach once DOM is ready (avatar is populated by loadProfile)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(attachTrigger, 500));
  } else {
    setTimeout(attachTrigger, 500);
  }

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

    // Allow vertical scrolling (auto-scroll needs it) but prevent horizontal overflow
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';

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

  // Gather all "edible" elements — break text into individual letter spans
  function collectFood() {
    // First, shatter text nodes into individual letter spans (only once per element)
    const textContainers = document.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, span, a, li, dt, dd, label, button, .skill-tag, .about-detail-tag, .hero-bio, .nav-logo'
    );
    textContainers.forEach(el => {
      if (el.dataset.agarShattered || el.closest('#agar-hud') || el.closest('#agar-blob')) return;
      // Only shatter direct text nodes
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim().length > 0) textNodes.push(node);
      }
      textNodes.forEach(textNode => {
        const text = textNode.textContent;
        if (text.trim().length === 0) return;
        const frag = document.createDocumentFragment();
        for (let i = 0; i < text.length; i++) {
          if (text[i] === ' ') {
            frag.appendChild(document.createTextNode(' '));
          } else {
            const s = document.createElement('span');
            s.className = 'agar-letter';
            s.textContent = text[i];
            s.style.display = 'inline';
            s.style.position = 'relative';
            frag.appendChild(s);
          }
        }
        textNode.parentNode.replaceChild(frag, textNode);
      });
      el.dataset.agarShattered = '1';
    });

    // Now also collect larger elements as food
    const sels = [
      '.agar-letter',
      '.skill-tag', '.about-detail-tag', '.highlight-item',
      '.repo-card', '.store-card', '.collab-card',
      '.contact-card', '.activity-item', '.timeline-item',
      '.filter-btn', '.view-btn', '.stat',
      '.section-title', '.nav-logo', '.nav-links a',
      '.hero-meta span', '.hero-bio', '.store-badge',
      '.modal-topic', '.repo-card-meta span',
    ];
    food = [];
    sels.forEach(s => {
      document.querySelectorAll(s).forEach(el => {
        if (el.closest('#agar-hud') || el.closest('#agar-blob')) return;
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
    const margin = 180;
    const scrollSpeed = 14;
    if (blobY < margin) window.scrollBy(0, -scrollSpeed * (1 - blobY / margin));
    else if (blobY > window.innerHeight - margin) window.scrollBy(0, scrollSpeed * (1 - (window.innerHeight - blobY) / margin));

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

    // Re-merge shattered letter spans back to text nodes
    document.querySelectorAll('[data-agar-shattered]').forEach(el => {
      delete el.dataset.agarShattered;
      // Collect all text content from child spans and text nodes
      const text = el.textContent;
      // Remove all agar-letter spans and replace with single text node
      const letters = el.querySelectorAll('.agar-letter');
      if (letters.length === 0) return;
      // Simple approach: normalize text nodes - let browser merge adjacent text
      letters.forEach(span => {
        span.replaceWith(span.textContent);
      });
      el.normalize();
    });

    // Restore avatar + scrolling
    document.getElementById('avatar').style.visibility = '';
    document.body.style.overflow = '';
    window.scrollTo(0, scrollY0);
  }
})();
