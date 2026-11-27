# Stolash Optimizer

Turns a PRO100 v5 formatka list into a strip order, a finished-parts list and a cut map.
Runs entirely in the browser. Specification: [docs/PRD.md](docs/PRD.md).

**Status:** v1 features implemented. Not yet checked against real PRO100 sample files.

## Setup

Tool versions are managed by [mise](https://mise.jdx.dev), dependencies by Yarn.

```sh
mise trust
mise install
yarn install
```

## Commands

| Command | Does |
|---|---|
| `yarn dev` | Development server |
| `yarn test` | Tests |
| `yarn build` | Type check and production build into `dist/` |
| `yarn preview` | Serve the built `dist/` |

## Layout

| Path | Contents |
|---|---|
| `src/core` | Pure logic: parse, classify, pack, order rows |
| `src/i18n` | English and Polish strings |
| `src/store` | `ProjectStore` and its `localStorage` implementation |
| `src/ui` | React components |

## Deployment

GitHub Actions tests and builds every push and pull request, and publishes `main` to GitHub Pages.
Once, in the repository settings, set **Pages → Source** to **GitHub Actions**.
