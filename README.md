# nagusamecs.github.io

Personal portfolio site for [NagusameCS](https://github.com/NagusameCS), hosted at **https://nagusamecs.github.io**.

## Features

- **Auto-populated repos** — fetches all public repositories from the GitHub API, with search and filter
- **Rich repo modals** — each project shows its icon (`.github/icon.png`), social preview (`.github/social-preview.png` or GitHub OpenGraph fallback), description, stats, topics, and links
- **Ignore list** — `config/ignored-repos.json` lets you hide specific repos
- **Collaborations** — `config/collaborations.json` lets you showcase projects you've worked on with others
- **Store integrations** — `config/store-links.json` supports Apple App Store, Google Play, and VS Code Marketplace links (VS Code extensions auto-enrich via the Marketplace API)
- **GitHub profile** — avatar, name, bio, company, location, and blog pulled live from the API
- **Activity graph** — contribution heatmap built from public events, plus a recent activity feed
- **Responsive** — works on mobile and desktop
- **No build step** — vanilla HTML/CSS/JS, deploys directly via GitHub Pages

## Configuration

### `config/ignored-repos.json`
```json
{ "ignored": ["repo-name-to-hide"] }
```

### `config/collaborations.json`
```json
{
  "collaborations": [
    {
      "name": "Project Name",
      "description": "What you did",
      "url": "https://github.com/org/repo",
      "collaborators": ["PersonA", "PersonB"],
      "role": "Contributor",
      "icon": "fas fa-users"
    }
  ]
}
```

### `config/store-links.json`
```json
{
  "appStore": [{ "name": "App", "url": "https://apps.apple.com/...", "description": "...", "icon": "" }],
  "playStore": [{ "name": "App", "url": "https://play.google.com/...", "description": "...", "icon": "" }],
  "vscodeMarketplace": [{ "name": "Ext", "url": "https://marketplace.visualstudio.com/items?itemName=pub.ext", "description": "...", "icon": "" }]
}
```

### Repo icons & social previews
Add to any repo you own:
- `.github/icon.png` — shown as the repo's icon on the card and modal
- `.github/social-preview.png` — shown in the modal (falls back to GitHub's auto-generated OpenGraph image)
