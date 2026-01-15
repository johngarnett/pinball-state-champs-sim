# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monte Carlo simulation for pinball tournament brackets. Simulates match outcomes using Glicko ratings treated as ELO, running many iterations to calculate win probabilities and placement statistics.

## Commands

```bash
npm start          # Run simulation (outputs TSV to stdout)
node open.js       # Same as above
```

## Data Files

- `field.tsv` - Tab-delimited player data with columns: name, seed, rating, rd
- `bracket.json` - Tournament bracket structure defining matches and progression

## Code Style

- No semicolons at end of lines
- 3-space indentation
- CommonJS requires (not ES modules)

## Key Dependencies

- `@stdlib/random-base-minstd` and `@stdlib/random-base-normal` for seeded RNG
- Note: stdlib packages use hyphens in require paths (e.g., `require('@stdlib/random-base-minstd')`) not slashes
