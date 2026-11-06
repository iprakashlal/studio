# Portfolio website

Made with Site Studio. A single-page portfolio with its own content manager.

| File | What it is |
|---|---|
| `index.html` | The website |
| `content.json` | All text, colours, shapes and image paths |
| `assets/uploads/` | Images |
| `admin.html` + `cms/` | The site's own CMS |

## Publish on GitHub Pages
1. Upload every file to a public repository (keep the folders).
2. **Settings → Pages → Deploy from a branch → main / (root) → Save.**

## Edit the site
1. Create a fine-grained GitHub token for **this repository only** with **Contents: Read and write**.
2. Open `https://<username>.github.io/<repository>/admin.html`, connect the device and choose a login.
3. Edit, check the live preview, then **Save & publish**. The site updates about a minute later.

The token is encrypted with your password and stays in your browser. Nothing about the login is stored in the repository.
