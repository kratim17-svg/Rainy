/**
 * Data layer checks.
 *
 *   npm run check:data
 *
 * Runs the repositories against an in-memory stand-in for localStorage, so
 * it needs no browser. Add a case here whenever a model changes.
 */

const mem = new Map()
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
  addEventListener() {},
}

const D = await import(new URL('../src/data/index.js', import.meta.url))
const { checkIns, brainDumps, breathingSessions, journalEntries, notificationSettings, ValidationError } = D

let pass = 0, fail = 0
const ok = (n, c) => {
  if (c) { pass++; console.log('  PASS', n) }
  else { fail++; console.log('  FAIL', n) }
}
const throws = async (n, fn) => {
  try { await fn(); ok(n, false) }
  catch (e) { ok(n, e instanceof ValidationError) }
}

console.log('\n-- CheckIn --')
const c1 = await checkIns.create({ timeSlot: 'morning', score: 7 })
ok('exact field set', JSON.stringify(Object.keys(c1).sort()) === JSON.stringify(['id','score','timeSlot','timestamp']))
ok('no createdAt/updatedAt leaked', !('createdAt' in c1) && !('updatedAt' in c1))
ok('uuid id', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c1.id))
ok('ISO8601 timestamp', c1.timestamp === new Date(c1.timestamp).toISOString())
ok('score kept', c1.score === 7 && c1.timeSlot === 'morning')
ok('score 0 allowed', (await checkIns.create({ timeSlot: 'night', score: 0 })).score === 0)
ok('score 10 allowed', (await checkIns.create({ timeSlot: 'midday', score: 10 })).score === 10)
await throws('score 11 rejected', () => checkIns.create({ timeSlot: 'morning', score: 11 }))
await throws('score -1 rejected', () => checkIns.create({ timeSlot: 'morning', score: -1 }))
await throws('bad timeSlot rejected', () => checkIns.create({ timeSlot: 'afternoon', score: 5 }))
await throws('missing score rejected', () => checkIns.create({ timeSlot: 'morning' }))
await throws('missing timeSlot rejected', () => checkIns.create({ score: 5 }))
ok('bands', D.bandForScore(0)==='low' && D.bandForScore(3)==='low' && D.bandForScore(4)==='medium'
  && D.bandForScore(6)==='medium' && D.bandForScore(7)==='high' && D.bandForScore(10)==='high')
ok('TIME_SLOTS', JSON.stringify(D.TIME_SLOTS) === JSON.stringify(['morning','midday','evening','night']))

console.log('\n-- BrainDump --')
const b1 = await brainDumps.create({ checkInId: c1.id, text: 'too much at once', wordFrequencies: { too: 1, much: 1 } })
ok('exact field set', JSON.stringify(Object.keys(b1).sort()) === JSON.stringify(['checkInId','id','text','timestamp','wordFrequencies']))
ok('linked to check-in', b1.checkInId === c1.id)
ok('wordFrequencies kept', b1.wordFrequencies.too === 1 && b1.wordFrequencies.much === 1)
const b2 = await brainDumps.create({ text: 'standalone thought' })
ok('checkInId defaults to null', b2.checkInId === null)
ok('wordFrequencies defaults to {}', JSON.stringify(b2.wordFrequencies) === '{}')
await throws('missing text rejected', () => brainDumps.create({ text: '' }))
await throws('bad wordFrequencies rejected', () => brainDumps.create({ text: 'x', wordFrequencies: { a: 'lots' } }))
ok('array wordFrequencies rejected', await brainDumps.create({ text: 'y', wordFrequencies: [] }).then(()=>false, e=>e instanceof ValidationError))

console.log('\n-- BreathingSession --')
const s1 = await breathingSessions.create({ checkInId: c1.id, mode: 'box', cyclesCompleted: 6 })
ok('exact field set', JSON.stringify(Object.keys(s1).sort()) === JSON.stringify(['checkInId','cyclesCompleted','id','mode','timestamp']))
ok('mode box', s1.mode === 'box')
ok('mode 478 accepted', (await breathingSessions.create({ mode: '478' })).mode === '478')
ok('cyclesCompleted defaults 0', (await breathingSessions.create({ mode: 'box' })).cyclesCompleted === 0)
ok('standalone allowed', (await breathingSessions.create({ mode: 'box' })).checkInId === null)
await throws('bad mode rejected', () => breathingSessions.create({ mode: '4-7-8' }))
await throws('missing mode rejected', () => breathingSessions.create({ cyclesCompleted: 2 }))

console.log('\n-- JournalEntry --')
const j1 = await journalEntries.create({ date: '2026-09-09', items: ['slept badly', 'walked'] })
ok('exact field set', JSON.stringify(Object.keys(j1).sort()) === JSON.stringify(['createdAt','date','id','items','updatedAt']))
ok('no timestamp field', !('timestamp' in j1))
ok('items kept', j1.items.length === 2)
ok('items default []', (await journalEntries.create({ date: '2026-09-08' })).items.length === 0)
await throws('bad date rejected', () => journalEntries.create({ date: '09/09/2026' }))
await throws('impossible date rejected', () => journalEntries.create({ date: '2026-13-45' }))
await throws('missing date rejected', () => journalEntries.create({ items: ['x'] }))
await new Promise(r => setTimeout(r, 3))
const j2 = await journalEntries.update(j1.id, { items: [...j1.items, 'called mum'] })
ok('update applies', j2.items.length === 3)
ok('createdAt held', j2.createdAt === j1.createdAt)
ok('updatedAt moved', j2.updatedAt >= j1.updatedAt)

console.log('\n-- linking helpers --')
const rel = await D.relatedTo(c1.id)
ok('relatedTo finds both', rel.brainDumps.length === 1 && rel.breathingSessions.length === 1)
const alone = await D.standalone()
ok('standalone finds unlinked', alone.brainDumps.length === 1 && alone.breathingSessions.length === 3)

console.log('\n-- journal helpers --')
ok('journalFor finds day', (await D.journalFor('2026-09-09'))?.id === j1.id)
ok('journalFor missing day', (await D.journalFor('2020-01-01')) === null)
const added = await D.addJournalItem('drank water', '2026-09-09')
ok('addJournalItem appends', added.items.length === 4)
const fresh = await D.addJournalItem('first thing', '2026-09-07')
ok('addJournalItem creates', fresh.items.length === 1 && fresh.date === '2026-09-07')
ok('toDateKey shape', /^\d{4}-\d{2}-\d{2}$/.test(D.toDateKey()))

console.log('\n-- ordering & queries --')
ok('checkIns newest first', (await checkIns.list())[0].timestamp >= (await checkIns.list())[1].timestamp)
const jlist = await journalEntries.list()
ok('journal count', jlist.length === 3)
ok('journal ordered by date desc', jlist.map(e=>e.date).join(' ') === '2026-09-09 2026-09-08 2026-09-07')
ok('checkIns still ordered by timestamp', (await checkIns.list()).every((r,i,a) => i===0 || a[i-1].timestamp >= r.timestamp))
ok('where by timeSlot', (await checkIns.list({ where: { timeSlot: 'morning' } })).length === 1)
ok('where in list', (await checkIns.list({ where: { timeSlot: ['morning','night'] } })).length === 2)
ok('limit', (await checkIns.list({ limit: 2 })).length === 2)
ok('latest', (await checkIns.latest()) !== null)
ok('count', (await checkIns.count()) === 3)
const explicit = await checkIns.create({ timeSlot: 'evening', score: 4, timestamp: '2026-01-01T09:00:00.000Z' })
ok('explicit timestamp honoured', explicit.timestamp === '2026-01-01T09:00:00.000Z')
ok('between filters', (await checkIns.between('2025-12-31','2026-01-02')).length === 1)
await throws('bad explicit timestamp rejected', () => checkIns.create({ timeSlot: 'evening', score: 4, timestamp: 'nonsense' }))

console.log('\n-- NotificationSettings --')
const n0 = await notificationSettings.get()
ok('four slots', JSON.stringify(Object.keys(n0)) === JSON.stringify(['morning','midday','evening','night']))
ok('default times', n0.morning.time==='08:00' && n0.midday.time==='12:00' && n0.evening.time==='17:00' && n0.night.time==='21:00')
ok('default key present', n0.morning.default === '08:00' && n0.night.default === '21:00')
ok('enabled by default', D.TIME_SLOTS.every(s => n0[s].enabled === true))
const n1 = await notificationSettings.setSlot('morning', { time: '07:15' })
ok('setSlot changes time', n1.morning.time === '07:15')
ok('setSlot keeps enabled', n1.morning.enabled === true)
ok('setSlot leaves others', n1.night.time === '21:00')
ok('default unchanged by edit', n1.morning.default === '08:00')
const n2 = await notificationSettings.setSlot('night', { enabled: false })
ok('disable slot', n2.night.enabled === false)
ok('disable keeps time', n2.night.time === '21:00')
ok('earlier edit persisted', n2.morning.time === '07:15')
ok('survives reload', (await notificationSettings.get()).morning.time === '07:15')
ok('activeSlots excludes disabled & sorts', JSON.stringify(await notificationSettings.activeSlots()) === JSON.stringify(['morning','midday','evening']))
await throws('bad time rejected', () => notificationSettings.setSlot('morning', { time: '25:00' }))
await throws('bad time format rejected', () => notificationSettings.setSlot('morning', { time: '7:15' }))
await throws('unknown slot rejected', () => notificationSettings.setSlot('afternoon', { time: '15:00' }))
await throws('unknown key rejected', () => notificationSettings.update({ lunchtime: { time: '12:00' } }))
ok('unchanged after failures', (await notificationSettings.get()).morning.time === '07:15')
const nr = await notificationSettings.reset()
ok('reset restores', nr.morning.time === '08:00' && nr.night.enabled === true)

console.log('\n-- storage keys --')
const keys = [...mem.keys()].sort()
ok('spec-named keys', JSON.stringify(keys) === JSON.stringify([
  'rainy:v1:BRAIN_DUMPS','rainy:v1:BREATHING_SESSIONS','rainy:v1:CHECK_INS',
  'rainy:v1:JOURNAL_ENTRIES','rainy:v1:NOTIFICATION_SETTINGS']))
ok('stored as JSON arrays', Array.isArray(JSON.parse(mem.get('rainy:v1:CHECK_INS'))))

console.log('\n-- word frequencies --')
const { wordFrequencies, topWords, STOP_WORDS } = await import(new URL('../src/lib/words.js', import.meta.url))

ok('stop word list is the 48 from the spec', STOP_WORDS.size === 48)
ok('lowercases', JSON.stringify(wordFrequencies('Worry WORRY worry')) === JSON.stringify({ worry: 3 }))
ok('strips punctuation', JSON.stringify(wordFrequencies('deadline, deadline. deadline!')) === JSON.stringify({ deadline: 3 }))
ok('drops every stop word', Object.keys(wordFrequencies(
  'the a an and or but in on at to for of is it i my me was are be been this that with so just have had not do did as if we you he she they all its from by about no up out can get'
)).length === 0)
ok('keeps meaning, drops filler', JSON.stringify(wordFrequencies('I have so much work to do about the work'))
  === JSON.stringify({ much: 1, work: 2 }))
ok("don't becomes dont", Object.keys(wordFrequencies("don't")).join() === 'dont')
ok('curly apostrophe too (what phones type)', Object.keys(wordFrequencies('don\u2019t')).join() === 'dont')
ok('no stray one-letter tokens from contractions',
  Object.keys(wordFrequencies("I can't sleep, it's 3am and I'm wired")).every(w => w.length > 1))
ok('hyphens split words', JSON.stringify(wordFrequencies('self-care')) === JSON.stringify({ self: 1, care: 1 }))
ok('newlines and tabs are separators', JSON.stringify(wordFrequencies('sleep\n\tsleep')) === JSON.stringify({ sleep: 2 }))
ok('keeps numbers', JSON.stringify(wordFrequencies('3am 3am')) === JSON.stringify({ '3am': 2 }))
ok('keeps accents', Object.keys(wordFrequencies('café')).join() === 'café')
ok('empty text', JSON.stringify(wordFrequencies('')) === '{}')
ok('null-ish text', JSON.stringify(wordFrequencies(undefined)) === '{}')
ok('punctuation only', JSON.stringify(wordFrequencies('... !!! ---')) === '{}')
ok('topWords ranks by count then alphabetically',
  JSON.stringify(topWords(wordFrequencies('work work sleep sleep money'), 2))
  === JSON.stringify([{ word: 'sleep', count: 2 }, { word: 'work', count: 2 }]))

// the shape must survive a real save
const dumped = await brainDumps.create({ text: 'work work deadline', wordFrequencies: wordFrequencies('work work deadline') })
ok('frequencies round-trip through storage',
  JSON.stringify((await brainDumps.get(dumped.id)).wordFrequencies) === JSON.stringify({ work: 2, deadline: 1 }))
await brainDumps.remove(dumped.id)

console.log('\n-- backup --')
const dump = await D.exportAll()
ok('export includes settings', !!dump.data.notificationSettings)
ok('export includes all four', ['checkIns','brainDumps','breathingSessions','journalEntries'].every(k => Array.isArray(dump.data[k])))
const idsBefore = (await checkIns.list()).map(r=>r.id).sort()
const tsBefore = (await checkIns.list()).map(r=>r.timestamp).sort()
await D.importAll(dump)
ok('import preserves ids', JSON.stringify((await checkIns.list()).map(r=>r.id).sort()) === JSON.stringify(idsBefore))
ok('import preserves timestamps', JSON.stringify((await checkIns.list()).map(r=>r.timestamp).sort()) === JSON.stringify(tsBefore))
ok('import does not duplicate', (await checkIns.count()) === 4)
ok('journal timestamps preserved', (await journalEntries.list()).every(r => r.createdAt && r.updatedAt))

console.log('\n-- subscribe & delete --')
let fired = 0
const unsub = checkIns.subscribe(() => fired++)
await checkIns.create({ timeSlot: 'morning', score: 3 })
ok('subscribe fires', fired === 1)
unsub()
await checkIns.create({ timeSlot: 'morning', score: 3 })
ok('unsubscribe stops', fired === 1)
const doomed = await checkIns.latest()
ok('remove returns true', (await checkIns.remove(doomed.id)) === true)
ok('remove missing false', (await checkIns.remove('nope')) === false)

console.log('\n-- timeline --')
await D.clearAll()
const { prettyTime, nextReminder, prettyClock } = await import(new URL('../src/lib/time.js', import.meta.url))

const today = D.toDateKey()
const atToday = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString() }
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString() })()

ok('empty day', (await D.timelineFor(today)).length === 0)

const ci = await checkIns.create({ timeSlot: 'morning', score: 8, timestamp: atToday(9, 15) })
await brainDumps.create({ checkInId: ci.id, text: 'spiralling about the deadline', timestamp: atToday(9, 20) })
await breathingSessions.create({ checkInId: ci.id, mode: 'box', cyclesCompleted: 4, timestamp: atToday(9, 30) })
await brainDumps.create({ text: 'a thought on its own', timestamp: atToday(14, 0) })
await breathingSessions.create({ mode: '478', cyclesCompleted: 2, timestamp: atToday(16, 30) })
await checkIns.create({ timeSlot: 'evening', score: 2, timestamp: atToday(18, 45) })
await checkIns.create({ timeSlot: 'night', score: 9, timestamp: yesterday })

const line = await D.timelineFor(today)
ok('yesterday excluded', line.length === 4)
ok('newest first', line.map(e => e.kind).join(',') === 'checkIn,breathing,brainDump,checkIn')
ok('linked items nest, not repeat', line.filter(e => e.kind === 'brainDump').length === 1)

const morning = line.find(e => e.kind === 'checkIn' && e.score === 8)
ok('check-in carries its band', morning.band === 'high')
ok('nested brain dump', morning.brainDumps.length === 1 && morning.brainDumps[0].text.includes('deadline'))
ok('nested breathing', morning.breathingSessions.length === 1 && morning.breathingSessions[0].cyclesCompleted === 4)

const evening = line.find(e => e.kind === 'checkIn' && e.score === 2)
ok('unaccompanied check-in has empty arrays', evening.brainDumps.length === 0 && evening.breathingSessions.length === 0)
ok('standalone dump exposes text', line.find(e => e.kind === 'brainDump').text === 'a thought on its own')
ok('standalone breathing exposes mode', line.find(e => e.kind === 'breathing').mode === '478')
await D.clearAll()

console.log('\n-- reminders --')
ok('prettyTime on the hour', ['08:00','12:00','17:00','21:00'].map(prettyTime).join(' ') === '8am 12pm 5pm 9pm')
ok('prettyTime with minutes', prettyTime('07:30') === '7:30am' && prettyTime('00:15') === '12:15am')
ok('prettyTime midnight and noon', prettyTime('00:00') === '12am' && prettyTime('12:30') === '12:30pm')

const defaults = await notificationSettings.get()
const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d }
ok('before the first', JSON.stringify(nextReminder(defaults, at(6, 0))) === JSON.stringify({ time: '08:00', tomorrow: false }))
ok('between slots', JSON.stringify(nextReminder(defaults, at(13, 0))) === JSON.stringify({ time: '17:00', tomorrow: false }))
ok('after the last wraps to tomorrow', JSON.stringify(nextReminder(defaults, at(22, 30))) === JSON.stringify({ time: '08:00', tomorrow: true }))
ok('exactly on a slot picks the next', nextReminder(defaults, at(12, 0)).time === '17:00')

await notificationSettings.setSlot('morning', { enabled: false })
ok('disabled slot is skipped', nextReminder(await notificationSettings.get(), at(6, 0)).time === '12:00')
for (const slot of D.TIME_SLOTS) await notificationSettings.setSlot(slot, { enabled: false })
ok('all off returns null', nextReminder(await notificationSettings.get(), at(6, 0)) === null)
await notificationSettings.reset()

ok('prettyClock formats a time', /^\d{1,2}:\d{2}\s?[ap]m$/.test(prettyClock(atToday(14, 5))))

console.log('\n-- journal --')
await journalEntries.clear()
const { formatDayKey } = await import(new URL('../src/lib/time.js', import.meta.url))
const day = D.toDateKey()

ok('no entry to start', (await D.journalFor(day)) === null)
ok('past is empty', (await D.pastJournalEntries(day)).length === 0)

const first = await D.addJournalItem('walked to the shop', day)
ok('first item creates the entry', first.items.length === 1)
const second = await D.addJournalItem('called mum', day)
ok('second item appends', second.items.join('|') === 'walked to the shop|called mum')
ok('still one entry for the day', (await journalEntries.count()) === 1)
ok('createdAt held across appends', second.createdAt === first.createdAt)

ok('blank text is ignored', (await D.addJournalItem('   ', day)).items.length === 2)
ok('no entry created by blank text', (await journalEntries.count()) === 1)
ok('text is trimmed', (await D.addJournalItem('  ate lunch  ', day)).items[2] === 'ate lunch')

// duplicates must be removable independently, which is why index not value
await D.addJournalItem('rested', day)
await D.addJournalItem('rested', day)
ok('duplicates both stored', (await D.journalFor(day)).items.filter(i => i === 'rested').length === 2)
const afterDup = await D.removeJournalItem(3, day)
ok('removes by position, not value', afterDup.items.filter(i => i === 'rested').length === 1)

const afterRemove = await D.removeJournalItem(0, day)
ok('removes the right item', afterRemove.items.join('|') === 'called mum|ate lunch|rested')
ok('removing a missing index is harmless', (await D.removeJournalItem(99, day)).items.length === 3)

// emptying a day should take the day with it
await journalEntries.clear()
await D.addJournalItem('only thing', day)
ok('entry exists', (await journalEntries.count()) === 1)
ok('removing the last item returns null', (await D.removeJournalItem(0, day)) === null)
ok('and deletes the entry', (await journalEntries.count()) === 0)
ok('removing from a missing day is harmless', (await D.removeJournalItem(0, day)) === null)

// past entries
const older = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return D.toDateKey(d) }
await D.addJournalItem('today thing', day)
await D.addJournalItem('yesterday thing', older(1))
await D.addJournalItem('last week thing', older(7))
const earlier = await D.pastJournalEntries(day)
ok('past excludes today', earlier.length === 2 && !earlier.some(e => e.date === day))
ok('past is newest first', earlier[0].date === older(1) && earlier[1].date === older(7))
ok('formatDayKey reads as a date', /^[A-Za-z]+,\s/.test(formatDayKey(day)))
ok('formatDayKey does not slip a day', formatDayKey('2026-01-01').includes('1 January') || formatDayKey('2026-01-01').includes('January 1'))
await journalEntries.clear()

await D.clearAll()
ok('clearAll empties', (await checkIns.count())===0 && (await journalEntries.count())===0)
ok('clearAll resets settings', (await notificationSettings.get()).morning.time === '08:00')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
