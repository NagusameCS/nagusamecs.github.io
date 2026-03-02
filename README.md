# nagusamecs.github.io

Personal portfolio site for [NagusameCS](https://github.com/NagusameCS), hosted at **https://nagusamecs.github.io**.

I hope this will come in handy for anyone wanting to make their own portfolio :D

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
