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

await D.clearAll()
ok('clearAll empties', (await checkIns.count())===0 && (await journalEntries.count())===0)
ok('clearAll resets settings', (await notificationSettings.get()).morning.time === '08:00')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
