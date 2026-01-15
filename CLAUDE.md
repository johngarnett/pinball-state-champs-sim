# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monte Carlo simulation for pinball tournament brackets. Simulates match outcomes using Glicko ratings treated as ELO, running many iterations to calculate win probabilities and placement statistics.

## Commands

```bash
node state.js                           # Run simulation with default field (open-field)
node state.js --field women-field       # Run with a different field file
node state.js --tournament 12345        # Fetch field from Matchplay.events tournament
node state.js --tournament 12345 --clear # Clear cache before fetching
node state.js --iterations 100000       # Run fewer iterations (default: 1000000)
node state.js --seed 123                # Use different random seed (default: 42)
node state.js --help                    # Show all options
```

## Data Files

- `./data/<field-name>.tsv` - Tab-delimited player data with columns: name, seed, rating, rd
- `./data/bracket-16.json` - Bracket structure for 16-player tournaments
- `./data/bracket-24.json` - Bracket structure for 24-player tournaments
- `./results/` - Output directory for simulation results (TSV and JSON formats)
- `.cache/` - Cached tournament data from Matchplay API (24-hour TTL)

## Environment Variables

Create a `.env` file with:
```
MATCHPLAY_API_TOKEN=your_api_token_here
```

Required for `--tournament` flag to fetch player data from Matchplay.events.

## Code Style

- No semicolons at end of lines
- 3-space indentation
- CommonJS requires (not ES modules)

## Key Dependencies

- `@stdlib/random-base-minstd` and `@stdlib/random-base-normal` for seeded RNG
- `dotenv` for environment variable loading
- `commander` for CLI argument parsing
- `csv-parse` for TSV file parsing

Note: stdlib packages use hyphens in require paths (e.g., `require('@stdlib/random-base-minstd')`) not slashes

## Architecture

- `state.js` - Main simulation entry point
- `matchplay-api.js` - Matchplay.events API integration with caching
