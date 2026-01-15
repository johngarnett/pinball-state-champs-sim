// Matchplay API utility functions

const fs = require('fs')
const path = require('path')

const MATCHPLAY_URL = process.env.MATCHPLAY_URL || 'https://app.matchplay.events/api/'
const MATCHPLAY_API_TOKEN = process.env.MATCHPLAY_API_TOKEN
const API_DELAY_MS = 600
const CACHE_DIR = path.join(__dirname, '.cache')
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function getCachePath(tournamentId) {
    return path.join(CACHE_DIR, `tournament-${tournamentId}.json`)
}

function readCache(tournamentId) {
    const cachePath = getCachePath(tournamentId)
    try {
        if (!fs.existsSync(cachePath)) {
            return null
        }
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
        const age = Date.now() - data.timestamp
        if (age > CACHE_TTL_MS) {
            console.error(`Cache expired for tournament ${tournamentId}`)
            return null
        }
        console.error(`Using cached data for tournament ${tournamentId} (${Math.round(age / 60000)} minutes old)`)
        return data.field
    } catch (error) {
        console.error(`Error reading cache: ${error.message}`)
        return null
    }
}

function writeCache(tournamentId, field) {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true })
        }
        const data = {
            timestamp: Date.now(),
            field
        }
        fs.writeFileSync(getCachePath(tournamentId), JSON.stringify(data, null, 2))
        console.error(`Cached tournament ${tournamentId} field data`)
    } catch (error) {
        console.error(`Error writing cache: ${error.message}`)
    }
}

function clearCache(tournamentId = null) {
    try {
        if (tournamentId) {
            const cachePath = getCachePath(tournamentId)
            if (fs.existsSync(cachePath)) {
                fs.unlinkSync(cachePath)
                console.error(`Cleared cache for tournament ${tournamentId}`)
            }
        } else if (fs.existsSync(CACHE_DIR)) {
            const files = fs.readdirSync(CACHE_DIR)
            for (const file of files) {
                fs.unlinkSync(path.join(CACHE_DIR, file))
            }
            console.error(`Cleared all cache files`)
        }
    } catch (error) {
        console.error(`Error clearing cache: ${error.message}`)
    }
}

/**
 * Search for users on Matchplay
 * @param {string} query - Search query (player name)
 * @returns {Promise<Object>} Search results from Matchplay API
 */
async function searchUsers(query) {
    if (!MATCHPLAY_API_TOKEN) {
        throw new Error('MATCHPLAY_API_TOKEN not configured in environment')
    }

    const url = new URL('search', MATCHPLAY_URL)
    url.searchParams.append('query', query)
    url.searchParams.append('type', 'users')

    const headers = {
        'Authorization': `Bearer ${MATCHPLAY_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    try {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] 🌐 API CALL: GET ${url.toString()}`)

        const response = await fetch(url, {
            method: 'GET',
            headers
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Matchplay API error (${response.status}): ${errorText}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error calling Matchplay API:', error)
        throw error
    }
}

/**
 * Get user information from Matchplay (including rating and IFPA data)
 * @param {string} userId - Matchplay user ID
 * @returns {Promise<Object>} User data from Matchplay API
 */
async function getUserRating(userId) {
    if (!MATCHPLAY_API_TOKEN) {
        throw new Error('MATCHPLAY_API_TOKEN not configured in environment')
    }

    const url = new URL(`users/${userId}`, MATCHPLAY_URL)
    url.searchParams.append('includeIfpa', '1')
    url.searchParams.append('includeCounts', '0')

    const headers = {
        'Authorization': `Bearer ${MATCHPLAY_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    try {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] 🌐 API CALL: GET ${url.toString()}`)

        const response = await fetch(url, {
            method: 'GET',
            headers
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Matchplay API error (${response.status}): ${errorText}`)
        }

        const data = await response.json()

        // Transform to match the format expected by calling code
        // The old ratings endpoint returned { rating: {...} }
        // The new users endpoint returns { user: {...}, rating: {...} }
        return data
    } catch (error) {
        console.error(`Error fetching user data for user ${userId}:`, error)
        throw error
    }
}

/**
 * Get user rating from Matchplay using IFPA ID
 * @param {string} ifpaId - IFPA ID
 * @returns {Promise<Object>} Rating data from Matchplay API
 */
async function getRatingByIfpaId(ifpaId) {
    if (!MATCHPLAY_API_TOKEN) {
        throw new Error('MATCHPLAY_API_TOKEN not configured in environment')
    }

    const url = new URL(`ratings/ifpa/${ifpaId}`, MATCHPLAY_URL)

    const headers = {
        'Authorization': `Bearer ${MATCHPLAY_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    try {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] 🌐 API CALL: GET ${url.toString()}`)

        const response = await fetch(url, {
            method: 'GET',
            headers
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Matchplay API error (${response.status}): ${errorText}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(`Error fetching rating for IFPA ID ${ifpaId}:`, error)
        throw error
    }
}

/**
 * Get tournament information from Matchplay
 * @param {number} tournamentId - Tournament ID
 * @param {boolean} includePlayers - Whether to include players in response
 * @returns {Promise<Object>} Tournament data from Matchplay API
 */
async function getTournament(tournamentId, includePlayers = false) {
    if (!MATCHPLAY_API_TOKEN) {
        throw new Error('MATCHPLAY_API_TOKEN not configured in environment')
    }

    const url = new URL(`tournaments/${tournamentId}`, MATCHPLAY_URL)
    if (includePlayers) {
        url.searchParams.append('includePlayers', '1')
    }

    const headers = {
        'Authorization': `Bearer ${MATCHPLAY_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    try {
        const timestamp = new Date().toISOString()
        console.error(`[${timestamp}] API: GET ${url.toString()}`)

        const response = await fetch(url, {
            method: 'GET',
            headers
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Matchplay API error (${response.status}): ${errorText}`)
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error(`Error fetching tournament ${tournamentId}:`, error)
        throw error
    }
}

/**
 * Get tournament field with ratings from Matchplay
 * @param {number} tournamentId - Tournament ID
 * @param {boolean} skipCache - Skip cache and fetch fresh data
 * @returns {Promise<Array>} Array of player objects with name, seed, rating, rd
 */
async function getTournamentField(tournamentId, skipCache = false) {
    if (!skipCache) {
        const cached = readCache(tournamentId)
        if (cached) {
            return cached
        }
    }

    const tournament = await getTournament(tournamentId, true)
    const players = tournament.data.players

    const field = []
    for (let i = 0; i < players.length; i++) {
        const player = players[i]
        const name = player.name
        const ifpaId = player.ifpaId
        const matchplayId = player.claimedBy
        const seed = player.tournamentPlayer.seed + 1

        await sleep(API_DELAY_MS)

        let rating = null
        let rd = null

        try {
            if (matchplayId) {
                const userData = await getUserRating(matchplayId)
                if (userData.rating) {
                    rating = userData.rating.rating
                    rd = userData.rating.rd
                }
            } else if (ifpaId) {
                const ratingData = await getRatingByIfpaId(ifpaId)
                if (ratingData.rating) {
                    rating = ratingData.rating.rating
                    rd = ratingData.rating.rd
                }
            }
        } catch (error) {
            console.error(`Warning: Could not fetch rating for ${name}:`, error.message)
        }

        if (rating === null || rd === null) {
            console.error(`Warning: No rating found for ${name}, using defaults`)
            rating = 1500
            rd = 350
        }

        field.push({ name, seed, rating, rd })
        console.error(`Loaded: ${name} (seed ${seed}, rating ${rating}, rd ${rd})`)
    }

    // Sort by seed so field[0] is seed 1, field[1] is seed 2, etc.
    field.sort((a, b) => a.seed - b.seed)

    writeCache(tournamentId, field)
    return field
}

module.exports = {
    searchUsers,
    getUserRating,
    getRatingByIfpaId,
    getTournament,
    getTournamentField,
    clearCache
}
