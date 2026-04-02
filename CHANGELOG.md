# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 0.1.1 - 2026-04-02
### Added
- Batch screenshots: optional **wait-for-runtime-ready** gate per screen (MB store runtimeState contains `dataMap`/`itemListMap`) to reduce capturing loading states.

### Changed
- Web UI: expose the runtime-ready toggle and timeout for batch screenshots.
- CLI: add flags to enable/disable runtime-ready waiting and configure timeout.

