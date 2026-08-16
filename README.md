# Agent Plugkit Marketplace

The official plugin marketplace maintained by the Agent Plugkit organization.

## Register

```bash
npx agent-plugkit install-repo agent-plugkit/plugkit-marketplace --all
```

Registration makes this marketplace available to selected clients. Plugin installation remains a
separate client action.

## Contents

Canonical plugin declarations live in `plugins/*/plugin.yaml`. Portable manifests, client-native
manifests, marketplace indexes, and `plugins/CATALOG.md` are generated from those declarations and
must not be edited by hand.

## Development

```bash
npm ci
npm run check
npm run release:local
```

`npm run check` regenerates all plugin artifacts and indexes, validates the complete marketplace,
and checks that the public repository contains no internal planning or machine-local material.

## License

MIT
