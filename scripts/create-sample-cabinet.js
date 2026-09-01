// ─────────────────────────────────────────────────────────────────────────────
// Sedrify — Sample Cabinet Generator
// Theme: Classic Films (1950–2000)
// Creates a .cabinet file with all 10 Foundation field types and 25 records.
// Run: node scripts/create-sample-cabinet.js
// Output: sample/classic-films.cabinet
// ─────────────────────────────────────────────────────────────────────────────

const Database = require('better-sqlite3')
const { mkdirSync, existsSync } = require('fs')
const { join } = require('path')
const { randomUUID } = require('crypto')

const OUTPUT_PATH = join(__dirname, '../sample/classic-films.cabinet')
mkdirSync(join(__dirname, '../sample'), { recursive: true })

if (existsSync(OUTPUT_PATH)) {
  console.log('Sample cabinet already exists at', OUTPUT_PATH)
  console.log('Delete it first to regenerate.')
  process.exit(0)
}

const db = new Database(OUTPUT_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const now = new Date().toISOString()
const uuid = () => randomUUID()

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE cabinet_meta (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE collections (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE views (
    id TEXT PRIMARY KEY NOT NULL,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    view_type TEXT NOT NULL DEFAULT 'table',
    display_order INTEGER NOT NULL DEFAULT 0,
    config TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE fields (
    id TEXT PRIMARY KEY NOT NULL,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    field_type TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    required INTEGER NOT NULL DEFAULT 0,
    is_primary INTEGER NOT NULL DEFAULT 0,
    default_value TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    recycled INTEGER NOT NULL DEFAULT 0,
    recycled_at TEXT,
    config TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE records (
    id TEXT PRIMARY KEY NOT NULL,
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    recycled INTEGER NOT NULL DEFAULT 0,
    recycled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(collection_id, sequence)
  );
  CREATE TABLE record_values (
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL REFERENCES fields(id),
    value_text TEXT,
    value_int INTEGER,
    value_real REAL,
    value_blob BLOB,
    PRIMARY KEY (record_id, field_id)
  );
  CREATE TABLE sequence_counters (
    collection_id TEXT PRIMARY KEY NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    next_sequence INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE field_choice_options (
    id TEXT PRIMARY KEY NOT NULL,
    field_id TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_fields_collection ON fields(collection_id);
  CREATE INDEX idx_records_collection ON records(collection_id);
  CREATE INDEX idx_record_values_record ON record_values(record_id);
`)

// ── Seed metadata ─────────────────────────────────────────────────────────────

const cabinetId = uuid()
const collectionId = uuid()
const viewId = uuid()

db.prepare('INSERT INTO cabinet_meta VALUES (?,?,?,?,?)').run(cabinetId, 'Classic Films', 1, now, now)
db.prepare('INSERT INTO collections VALUES (?,?,?,?,?)').run(collectionId, 'Films', 0, now, now)
db.prepare('INSERT INTO views VALUES (?,?,?,?,?,?,?,?)').run(viewId, collectionId, 'All Records', 'table', 0, '{}', now, now)
db.prepare('INSERT INTO sequence_counters VALUES (?,?)').run(collectionId, 26)

// ── Fields (one per Foundation type) ─────────────────────────────────────────

const fields = [
  { id: uuid(), name: 'Title',         type: 'text',          primary: 1, required: 1, desc: 'Film title', config: '{}' },
  { id: uuid(), name: 'Synopsis',      type: 'multiline',     primary: 0, required: 0, desc: 'Brief plot summary', config: '{}' },
  { id: uuid(), name: 'Year',          type: 'integer',       primary: 0, required: 1, desc: 'Release year', config: '{}' },
  { id: uuid(), name: 'Rating',        type: 'decimal',       primary: 0, required: 0, desc: 'Personal rating out of 10', config: '{}' },
  { id: uuid(), name: 'Release Date',  type: 'date',          primary: 0, required: 0, desc: 'Official release date', config: '{}' },
  { id: uuid(), name: 'Added',         type: 'datetime',      primary: 0, required: 0, desc: 'When added to collection', config: '{}' },
  { id: uuid(), name: 'Watched',       type: 'yesno',         primary: 0, required: 0, desc: 'Have you watched this?', config: '{}' },
  { id: uuid(), name: 'Genre',         type: 'choice',        primary: 0, required: 0, desc: 'Primary genre', config: '{}' },
  { id: uuid(), name: 'Poster',        type: 'linked-file',   primary: 0, required: 0, desc: 'Path to poster image', config: '{}' },
  { id: uuid(), name: 'Notes',         type: 'embedded-file', primary: 0, required: 0, desc: 'Embedded review notes', config: '{}' },
]

for (let i = 0; i < fields.length; i++) {
  const f = fields[i]
  db.prepare(`INSERT INTO fields VALUES (?,?,?,?,?,?,?,?,?,0,NULL,?,?,?)`).run(
    f.id, collectionId, f.name, f.type, f.desc, f.required, f.primary, null, i, f.config, now, now
  )
}

// ── Genre choice options ───────────────────────────────────────────────────────

const genreField = fields[7]
const genres = ['Drama', 'Sci-Fi', 'Thriller', 'Comedy', 'Crime', 'Western', 'Horror', 'Romance', 'Adventure', 'Fantasy']
const genreMap = {}
genres.forEach((g, i) => {
  const id = uuid()
  genreMap[g] = id
  db.prepare('INSERT INTO field_choice_options VALUES (?,?,?,?,?)').run(id, genreField.id, g, i, now)
})

// ── 25 Film records ───────────────────────────────────────────────────────────

const films = [
  { title: 'Rear Window',         synopsis: 'A photographer confined to a wheelchair spies on his neighbours.',          year: 1954, rating: 9.2, date: '1954-08-04', watched: 1, genre: 'Thriller' },
  { title: 'Vertigo',             synopsis: 'A detective with acrophobia investigates a mysterious woman.',                year: 1958, rating: 9.0, date: '1958-05-09', watched: 1, genre: 'Thriller' },
  { title: '2001: A Space Odyssey', synopsis: 'A voyage to Jupiter goes wrong when the AI HAL 9000 malfunctions.',      year: 1968, rating: 9.1, date: '1968-04-06', watched: 1, genre: 'Sci-Fi' },
  { title: 'The Godfather',       synopsis: 'The aging patriarch of an organized crime dynasty transfers control to his son.', year: 1972, rating: 9.6, date: '1972-03-15', watched: 1, genre: 'Crime' },
  { title: 'Chinatown',           synopsis: 'A private detective hired to expose an adulterer is led into a sinister conspiracy.', year: 1974, rating: 9.0, date: '1974-06-20', watched: 1, genre: 'Thriller' },
  { title: 'Apocalypse Now',      synopsis: 'A soldier is sent into Cambodia to assassinate a renegade colonel.',         year: 1979, rating: 8.8, date: '1979-08-15', watched: 1, genre: 'Drama' },
  { title: 'Alien',              synopsis: 'After a transmission from a planet, the crew of a spaceship investigates.',   year: 1979, rating: 8.9, date: '1979-05-25', watched: 1, genre: 'Sci-Fi' },
  { title: 'Blade Runner',        synopsis: 'A blade runner must pursue and terminate four replicants who have returned to Earth.', year: 1982, rating: 8.9, date: '1982-06-25', watched: 1, genre: 'Sci-Fi' },
  { title: 'Fanny and Alexander', synopsis: 'A theatrical family is torn apart when the mother remarries a strict bishop.', year: 1982, rating: 9.0, date: '1982-12-17', watched: 0, genre: 'Drama' },
  { title: 'Ran',                 synopsis: 'A Japanese lord descends into madness after abdicating to his sons.',         year: 1985, rating: 9.1, date: '1985-06-01', watched: 1, genre: 'Drama' },
  { title: 'Blue Velvet',        synopsis: 'After finding a severed ear, a young man investigates a mystery in a small town.', year: 1986, rating: 8.7, date: '1986-09-19', watched: 0, genre: 'Thriller' },
  { title: 'Wings of Desire',    synopsis: 'An angel in divided Berlin yearns to experience human sensations.',            year: 1987, rating: 8.8, date: '1987-09-23', watched: 0, genre: 'Romance' },
  { title: 'Cinema Paradiso',    synopsis: 'A filmmaker recalls his childhood in a Sicilian village and his love of cinema.', year: 1988, rating: 9.0, date: '1988-11-17', watched: 1, genre: 'Drama' },
  { title: 'Do the Right Thing', synopsis: 'On the hottest day of the year, tensions rise between neighbours in Brooklyn.', year: 1989, rating: 8.9, date: '1989-06-30', watched: 1, genre: 'Drama' },
  { title: 'Goodfellas',         synopsis: 'The story of Henry Hill and his life in the mob.',                             year: 1990, rating: 9.4, date: '1990-09-21', watched: 1, genre: 'Crime' },
  { title: 'Barton Fink',        synopsis: 'A playwright moves to Hollywood and experiences a severe case of writer\'s block.', year: 1991, rating: 8.6, date: '1991-05-15', watched: 0, genre: 'Thriller' },
  { title: 'Unforgiven',         synopsis: 'A retired outlaw takes on one more job with his old partner.',                 year: 1992, rating: 9.0, date: '1992-08-07', watched: 1, genre: 'Western' },
  { title: 'Schindler\'s List',  synopsis: 'A German businessman saves more than a thousand Polish Jews during the Holocaust.', year: 1993, rating: 9.5, date: '1993-12-15', watched: 1, genre: 'Drama' },
  { title: 'Pulp Fiction',       synopsis: 'The lives of two mob hitmen, a boxer, and a gangster\'s wife intertwine.',   year: 1994, rating: 9.4, date: '1994-10-14', watched: 1, genre: 'Crime' },
  { title: 'Three Colors: Red',  synopsis: 'A model and a retired judge form an unlikely friendship in Geneva.',          year: 1994, rating: 9.0, date: '1994-05-27', watched: 0, genre: 'Drama' },
  { title: 'Heat',               synopsis: 'A group of professional bank robbers starts to feel the heat from the police.', year: 1995, rating: 9.1, date: '1995-12-15', watched: 1, genre: 'Crime' },
  { title: 'Fargo',              synopsis: 'A car salesman hires two criminals to kidnap his wife.',                       year: 1996, rating: 9.0, date: '1996-03-08', watched: 1, genre: 'Crime' },
  { title: 'Boogie Nights',      synopsis: 'A teenager becomes a star in the adult film industry in 1970s California.',   year: 1997, rating: 8.8, date: '1997-10-10', watched: 0, genre: 'Drama' },
  { title: 'The Thin Red Line',  synopsis: 'The story of a group of men fighting in the Battle of Guadalcanal.',          year: 1998, rating: 8.9, date: '1998-12-23', watched: 0, genre: 'Drama' },
  { title: 'Eyes Wide Shut',     synopsis: 'A doctor embarks on a night-long odyssey after his wife reveals a fantasy.',  year: 1999, rating: 8.6, date: '1999-07-16', watched: 1, genre: 'Thriller' },
]

const insertRecord = db.prepare('INSERT INTO records VALUES (?,?,?,0,NULL,?,?)')
const insertValue = db.prepare('INSERT INTO record_values (record_id, field_id, value_text, value_int, value_real, value_blob) VALUES (?,?,?,?,?,NULL)')

const seed = db.transaction(() => {
  films.forEach((film, i) => {
    const recordId = uuid()
    const seq = i + 1
    insertRecord.run(recordId, collectionId, seq, now, now)

    const [titleF, synopsisF, yearF, ratingF, dateF, addedF, watchedF, genreF, posterF] = fields

    insertValue.run(recordId, titleF.id, film.title, null, null)
    insertValue.run(recordId, synopsisF.id, film.synopsis, null, null)
    insertValue.run(recordId, yearF.id, null, film.year, null)
    insertValue.run(recordId, ratingF.id, null, null, film.rating)
    insertValue.run(recordId, dateF.id, film.date, null, null)
    insertValue.run(recordId, addedF.id, now, null, null)
    insertValue.run(recordId, watchedF.id, null, film.watched, null)
    insertValue.run(recordId, genreF.id, genreMap[film.genre] ?? null, null, null)
    insertValue.run(recordId, posterF.id, null, null, null) // no poster files
  })
})

seed()
db.close()

console.log(`✓ Sample cabinet created: ${OUTPUT_PATH}`)
console.log(`  25 records, 10 fields, theme: Classic Films (1950–2000)`)
