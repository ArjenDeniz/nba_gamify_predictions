export type Conference = 'East' | 'West'

export type Team = {
  id: string // ESPN team id
  abbr: string // ESPN abbreviation (used for logo URLs)
  name: string
  conf: Conference
  line: number // preseason over/under win total
}

export const LINES_SOURCE = {
  book: 'BetMGM',
  asOf: '2026-10-09',
  url: 'https://sports.betmgm.com/en/blog/nba/nba-odds-predictions-season-win-totals-bm23/',
}

export const TEAMS: Team[] = [
  // East
  { id: '1', abbr: 'atl', name: 'Atlanta Hawks', conf: 'East', line: 43.5 },
  { id: '2', abbr: 'bos', name: 'Boston Celtics', conf: 'East', line: 51.5 },
  { id: '17', abbr: 'bkn', name: 'Brooklyn Nets', conf: 'East', line: 24.5 },
  { id: '30', abbr: 'cha', name: 'Charlotte Hornets', conf: 'East', line: 39.5 },
  { id: '4', abbr: 'chi', name: 'Chicago Bulls', conf: 'East', line: 29.5 },
  { id: '5', abbr: 'cle', name: 'Cleveland Cavaliers', conf: 'East', line: 47.5 },
  { id: '8', abbr: 'det', name: 'Detroit Pistons', conf: 'East', line: 49.5 },
  { id: '11', abbr: 'ind', name: 'Indiana Pacers', conf: 'East', line: 43.5 },
  { id: '14', abbr: 'mia', name: 'Miami Heat', conf: 'East', line: 46.5 },
  { id: '15', abbr: 'mil', name: 'Milwaukee Bucks', conf: 'East', line: 25.5 },
  { id: '18', abbr: 'ny', name: 'New York Knicks', conf: 'East', line: 52.5 },
  { id: '19', abbr: 'orl', name: 'Orlando Magic', conf: 'East', line: 43.5 },
  { id: '20', abbr: 'phi', name: 'Philadelphia 76ers', conf: 'East', line: 50.5 },
  { id: '28', abbr: 'tor', name: 'Toronto Raptors', conf: 'East', line: 46.5 },
  { id: '27', abbr: 'wsh', name: 'Washington Wizards', conf: 'East', line: 34.5 },
  // West
  { id: '6', abbr: 'dal', name: 'Dallas Mavericks', conf: 'West', line: 34.5 },
  { id: '7', abbr: 'den', name: 'Denver Nuggets', conf: 'West', line: 49.5 },
  { id: '9', abbr: 'gs', name: 'Golden State Warriors', conf: 'West', line: 40.5 },
  { id: '10', abbr: 'hou', name: 'Houston Rockets', conf: 'West', line: 48.5 },
  { id: '12', abbr: 'lac', name: 'LA Clippers', conf: 'West', line: 28.5 },
  { id: '13', abbr: 'lal', name: 'Los Angeles Lakers', conf: 'West', line: 46.5 },
  { id: '29', abbr: 'mem', name: 'Memphis Grizzlies', conf: 'West', line: 29.5 },
  { id: '16', abbr: 'min', name: 'Minnesota Timberwolves', conf: 'West', line: 48.5 },
  { id: '3', abbr: 'no', name: 'New Orleans Pelicans', conf: 'West', line: 27.5 },
  { id: '25', abbr: 'okc', name: 'Oklahoma City Thunder', conf: 'West', line: 62.5 },
  { id: '21', abbr: 'phx', name: 'Phoenix Suns', conf: 'West', line: 40.5 },
  { id: '22', abbr: 'por', name: 'Portland Trail Blazers', conf: 'West', line: 42.5 },
  { id: '23', abbr: 'sac', name: 'Sacramento Kings', conf: 'West', line: 21.5 },
  { id: '24', abbr: 'sa', name: 'San Antonio Spurs', conf: 'West', line: 59.5 },
  { id: '26', abbr: 'utah', name: 'Utah Jazz', conf: 'West', line: 37.5 },
]

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.id, t]))

export const teamsIn = (conf: Conference) => TEAMS.filter((t) => t.conf === conf)

export const logoUrl = (t: Team) => `https://a.espncdn.com/i/teamlogos/nba/500/${t.abbr}.png`
