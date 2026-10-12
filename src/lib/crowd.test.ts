import { describe, expect, it } from 'vitest'
import { crowdLean, tallyDelta } from './crowd'

describe('crowdLean', () => {
  it('rounds the bigger side down to a step', () => {
    expect(crowdLean({ O: 6, U: 4 })).toEqual({ side: 'O', atLeast: 5 })
    expect(crowdLean({ O: 1, U: 12 })).toEqual({ side: 'U', atLeast: 10 })
    expect(crowdLean({ O: 31, U: 0 })).toEqual({ side: 'O', atLeast: 20 })
  })

  it('shows from 3 players on a side', () => {
    expect(crowdLean({ O: 2, U: 0 })).toBeNull()
    expect(crowdLean({ O: 3, U: 0 })).toEqual({ side: 'O', atLeast: 3 })
  })

  it('shows nothing on a tie or without counts', () => {
    expect(crowdLean({ O: 5, U: 5 })).toBeNull()
    expect(crowdLean(undefined)).toBeNull()
  })
})

describe('tallyDelta', () => {
  it('counts a new pick', () => {
    expect(tallyDelta(undefined, 'O')).toEqual({ O: 1, U: 0 })
  })

  it('moves a count when switching sides', () => {
    expect(tallyDelta('O', 'U')).toEqual({ O: -1, U: 1 })
  })

  it('removes a cleared pick', () => {
    expect(tallyDelta('U', null)).toEqual({ O: 0, U: -1 })
  })

  it('is zero when nothing changes', () => {
    expect(tallyDelta('O', 'O')).toEqual({ O: 0, U: 0 })
  })
})
