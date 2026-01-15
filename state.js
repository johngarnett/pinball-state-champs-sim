/*
   coded by John Garnett, Jan 8, 2026
   no warranty expressed or implied.
   Copyright 2026 by John Garnett
   License: MIT ( https://opensource.org/licenses/MIT )

   See README.md

   Simulates IFPA State Championships using Glicko ratings from Matchplay.Events

   install: npm install
   usage: node state.js > results.tsv
   help: node state.js --help
*/

require('dotenv').config()
const fs = require('fs')
const { parse } = require('csv-parse/sync')
const { program } = require('commander')
const minstd = require('@stdlib/random-base-minstd')
const normal = require('@stdlib/random-base-normal')
const { getTournamentField, clearCache } = require('./matchplay-api')

const VALID_FIELD_SIZES = [16, 24]

program
   .option('--field <name>', 'field name (e.g. open-field)', 'open-field')
   .option('--tournament <id>', 'Matchplay tournament ID (overrides --field)')
   .option('--clear', 'clear cached tournament data before fetching')
   .option('--seed <number>', 'random seed', '42')
   .option('--iterations <number>', 'number of simulations', '1000000')
   .parse()

const options = program.opts()
const ITERATIONS = parseInt(options.iterations, 10)
const seededRng = minstd.factory({ seed: parseInt(options.seed, 10) })

// Use a uniform distribution for determining the winner of a game.

const matchRng = seededRng.normalized

// Use a normal distribution for generating ratings.

const ratingRng = normal.factory({ prng: matchRng })

const RESULTS_DIR = './results'

main()

async function main() {
   var field
   var outputName
   if (options.tournament) {
      const tournamentId = parseInt(options.tournament, 10)
      outputName = tournamentId
      if (options.clear) {
         clearCache(tournamentId)
      }
      console.error(`Fetching tournament ${tournamentId} from Matchplay...`)
      field = await getTournamentField(tournamentId)
   } else {
      outputName = options.field
      field = readField(`./data/${options.field}.tsv`)
   }
   const outputPathTsv = `${RESULTS_DIR}/results-${outputName}.tsv`
   const outputPathJson = `${RESULTS_DIR}/results-${outputName}.json`

   if (!VALID_FIELD_SIZES.includes(field.length)) {
      console.error(`Error: Field must contain ${VALID_FIELD_SIZES.join(' or ')} players, found: ${field.length}`)
      process.exit(1)
   }

   // Save the original input field before adding simulation fields
   const inputField = field.map(player => ({ ...player }))

   // Initialize simulation fields for each player
   field = field.map(player => ({
      ...player,
      wins: new Array(5).fill(0),
      gold: 0,
      silver: 0,
      bronze: 0,
      place: 0
   }))

   var bracketTemplate = slurp(`./data/bracket-${field.length}.json`)
   var bracket = {}
   var consolation = []

   // Extract and properly sort the match keys: w1, w2, w3, ...

   var matches = Object.keys(bracketTemplate)
      .filter(k => !bracketTemplate[k].final)
      .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))

   const rounds = (matches.length == 23) ? 5 : 4

   function f(s) {
      return field[s - 1]
   }

   function finalMatchKeys() {
      if (matches.length == 23) {
         return ['w32', 'w31']
      } else if (matches.length == 15) {
         return ['w16', 'w15']
      } else {
         console.log('Error: Expected a single-elimination bracket with a field of 16 or 24, not: ', matches.length + 1)
         process.exit(2)
      }
   }

   function playForThird() {
      var winner = play(consolation[0], consolation[1], 3)
      f(winner).bronze++
      f(winner).place += 3
      if (winner == consolation[0]) {
         f(consolation[1]).place += 4
      } else {
         f(consolation[0]).place += 4
      }
   }

   function play(s1, s2, games) {
      var fs1 = f(s1)
      var fs2 = f(s2)
      var r1 = ratingRng(fs1.rating, fs1.rd)
      var r2 = ratingRng(fs2.rating, fs2.rd)
      var p = odds(r1, r2)
      var w1 = 0
      var w2 = 0
      const half = games / 2
      for (var i = 0; i < games; i++) {
         if (matchRng() < p) {
            w1++
         } else {
            w2++
         }
         if ((w1 > half) || (w2 > half)) {
            break
         }
      }
      return (w1 > w2) ? s1 : s2
   }

   // Run the simulation many times.

   for (var ww = 0; ww < ITERATIONS; ww++) {
      bracket = JSON.parse(JSON.stringify(bracketTemplate))
      consolation = []
      for (var zz = 0; zz < matches.length; zz++) {
         var m = matches[zz]
         var match = bracket[m]
         var s1 = match.players[0]
         var s2 = match.players[1]
         var winner = play(s1, s2, 7)
         var loser = (winner == s1) ? s2 : s1

         if (match.round == (rounds - 1)) {
            if (winner == s1) {
               consolation.push(s2)
            } else {
               consolation.push(s1)
            }
         } else if (match.round < (rounds - 1)) {
            // All players who do not place 1st - 4th will tie with other players who lose in the same round.
            switch (match.round) {
               case 1:
                  f(loser).place += 17
                  break
               case 2:
                  f(loser).place += 9
                  break
               case 3:
                  f(loser).place += 5
                  break
            }
         }
         f(winner).wins[match.round - 1]++
         bracket[match.feeds[0]].players[match.feeds[1]] = winner
      }
      const [ultimate, penultimate] = finalMatchKeys()

      f(bracket[ultimate].players[0]).gold++
      f(bracket[ultimate].players[0]).place += 1
      if (bracket[ultimate].players[0] == bracket[penultimate].players[0]) {
         f(bracket[penultimate].players[1]).silver++
         f(bracket[penultimate].players[1]).place += 2
      } else {
         f(bracket[penultimate].players[0]).silver++
         f(bracket[penultimate].players[0]).place += 2
      }
      playForThird()
   }

   var partialHeading = ['name', 'seed', 'rating', 'rd']

   for (var k = 0; k < (rounds - 1); k++) {
      partialHeading.push('round ' + (k + 1))
   }
   const heading = partialHeading.concat(['gold', 'silver', 'bronze', 'average placement'])

   var tsvOutput = []
   tsvOutput.push(heading.join("\t"))

   var jsonResults = []

   for (var mm = 0; mm < field.length; mm++) {
      var partial = [field[mm].name, field[mm].seed, field[mm].rating, field[mm].rd]

      var roundWinProbabilities = {}
      for (var j = 0; j < (rounds - 1); j++) {
         partial.push(field[mm].wins[j] / ITERATIONS)
         roundWinProbabilities[`round${j + 1}`] = field[mm].wins[j] / ITERATIONS
      }
      var fields = partial.concat([field[mm].gold / ITERATIONS, field[mm].silver / ITERATIONS, field[mm].bronze / ITERATIONS, field[mm].place / ITERATIONS])

      tsvOutput.push(fields.join("\t"))

      jsonResults.push({
         name: field[mm].name,
         seed: field[mm].seed,
         rating: field[mm].rating,
         ratingDeviation: field[mm].rd,
         roundWinProbabilities,
         goldProbability: field[mm].gold / ITERATIONS,
         silverProbability: field[mm].silver / ITERATIONS,
         bronzeProbability: field[mm].bronze / ITERATIONS,
         averagePlacement: field[mm].place / ITERATIONS
      })
   }

   const jsonOutput = {
      generatedAt: new Date().toISOString(),
      iterations: ITERATIONS,
      source: options.tournament ? `tournament:${outputName}` : `field:${outputName}`,
      input: inputField,
      results: jsonResults
   }

   if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true })
   }

   // Determine output file paths, versioning if input or iterations changed
   const { tsvPath, jsonPath } = getOutputPaths(outputName, inputField, ITERATIONS)

   fs.writeFileSync(tsvPath, tsvOutput.join("\n") + "\n")
   fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2) + "\n")
   console.error(`Results written to ${tsvPath} and ${jsonPath}`)
}

function getOutputPaths(outputName, inputField, iterations) {
   const baseJsonPath = `${RESULTS_DIR}/results-${outputName}.json`
   const baseTsvPath = `${RESULTS_DIR}/results-${outputName}.tsv`

   // Find all existing result files for this output name
   const files = fs.existsSync(RESULTS_DIR) ? fs.readdirSync(RESULTS_DIR) : []
   const pattern = new RegExp(`^results-${outputName}(-\\d+)?\\.json$`)
   const matchingFiles = files.filter(f => pattern.test(f))

   if (matchingFiles.length === 0) {
      // No existing files, use base paths
      return { tsvPath: baseTsvPath, jsonPath: baseJsonPath }
   }

   // Find the most recent version (highest number or base)
   let maxVersion = 0
   let mostRecentFile = `results-${outputName}.json`
   for (const file of matchingFiles) {
      const match = file.match(new RegExp(`^results-${outputName}-(\\d+)\\.json$`))
      if (match) {
         const version = parseInt(match[1], 10)
         if (version > maxVersion) {
            maxVersion = version
            mostRecentFile = file
         }
      } else if (maxVersion === 0) {
         mostRecentFile = file
      }
   }

   // Read the most recent file and compare input and iterations
   const mostRecentPath = `${RESULTS_DIR}/${mostRecentFile}`
   try {
      const existingData = JSON.parse(fs.readFileSync(mostRecentPath, 'utf8'))
      const existingInput = JSON.stringify(existingData.input)
      const newInput = JSON.stringify(inputField)
      const sameInput = existingInput === newInput
      const sameIterations = existingData.iterations === iterations

      if (sameInput && sameIterations) {
         // Input and iterations unchanged, overwrite the most recent files
         const suffix = maxVersion > 0 ? `-${maxVersion}` : ''
         return {
            tsvPath: `${RESULTS_DIR}/results-${outputName}${suffix}.tsv`,
            jsonPath: mostRecentPath
         }
      } else {
         // Input or iterations changed, create new version
         const newVersion = maxVersion + 1
         return {
            tsvPath: `${RESULTS_DIR}/results-${outputName}-${newVersion}.tsv`,
            jsonPath: `${RESULTS_DIR}/results-${outputName}-${newVersion}.json`
         }
      }
   } catch (error) {
      console.error(`Warning: Could not read ${mostRecentPath}, creating new file`)
      return { tsvPath: baseTsvPath, jsonPath: baseJsonPath }
   }
}

// Read player data including name, seed, rating, and rd.

function readField(filename) {
   try {
      const data = fs.readFileSync(filename, 'utf8')
      const records = parse(data, {
         columns: true,
         delimiter: '\t',
         trim: true
      })

      return records.map(record => ({
         name: record.name,
         rating: parseFloat(record.rating),
         rd: parseFloat(record.rd),
         seed: parseInt(record.seed, 10)
      }))
   } catch (err) {
      console.error(err)
      return []
   }
}

// Use the ELO formula for computing win percentage from ELO rating.

function odds(r1, r2) {
   return 1.0 / (1 + 10 ** (-(r1 - r2) / 400))
}

function slurp(filename) {
   try {
     // Read the file content into the 'data' string all at once
     const data = fs.readFileSync(filename, 'utf8');

     return JSON.parse(data)
   } catch (err) {
     console.error(err);
   }
   return ''
}
