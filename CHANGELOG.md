# Changelog

All notable changes to FinTracker will be documented in this file.

## [0.2.0] - 2026-07-03

### Changed
- Migrated from single-row transactions to multi-leg operations model
- Database schema: added operations, operation_entries, balance_snapshots tables
- Removed transactions, matched_transactions tables
- All API endpoints rewritten for new model

### Added
- Fee auto-detection with user confirmation flow
- Balance snapshots with history endpoint
- Exchange sync (Bybit, OKX) creates operations+entries
- Network scanners create operations+entries
- Step-by-step wizard for creating operations
- Dashboard shows recent operations with entries summary
- Health check endpoint at /api/health
- Production Dockerfile with multi-stage build
- docker-compose.yml with healthcheck and resource limits
- Automated backup and restore scripts
- Rate limiting middleware
- Comprehensive documentation

### Fixed
- Balance recalculation on operation confirm/delete
- Fee detection now uses deficit (not full entry amount)
- Type-safe API routes with new model

## [0.1.0] - 2026-06-XX

### Added
- Initial release with single-row transactions
- User authentication (NextAuth)
- Bybit and OKX integration
- Network blockchain scanners
- Basic balance tracking
