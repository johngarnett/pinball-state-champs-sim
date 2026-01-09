* coded by John Garnett, Jan 8, 2026
* no warranty expressed or implied.
* Copyright 2026 by John Garnett
* License: MIT ( https://opensource.org/licenses/MIT )
* description: Simulates IFPA State Championships, assuming a field size of 24

# Details

This code uses Glicko ratings (including standard deviation) from Matchplay.Events to simulate
the IFPA state final given a field in ./data/open-field.tsv and a bracket in ./data/bracket-24.json.
It calculates the likelihood that each player will place 1st, 2nd, or 3rd. It also calculates the
likelihood that each player will advance out of each round. Finally, it calculates an average
placement. Places 1, 2, 3, and 4 are unique, but places for other rounds include ties amongst
all players who lost in the same round.

This code treats the Glicko ratings as if they were ELO ratings. Ratings are generated from
a normal distribution using rd as the standard deviation.

Note that the output of this code is only as accurate as the underlying Glicko ratings.
This code does not take into account which machines are being played or many other
relevant factors. On any given day, anyone could win!

This project was inspired by https://spacecitypinball.com/projects/2022_nacs_predictions.html

See https://app.matchplay.events/tournaments/220902/bracket for a bracket to use with this code.

# Installation

npm install

# Usage

node state.js > results.tsv

# Help

node state.js --help

# Source Code Repository

https://github.com/johngarnett/pinball-state-champs-sim
