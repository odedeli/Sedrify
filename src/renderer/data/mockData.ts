export type FieldType =
  // Text
  | "text"
  | "multiline"
  | "url"
  | "email"
  | "phone"
  // Numbers
  | "integer"
  | "decimal"
  | "currency"
  | "rating"
  | "percentage"
  // Date & Time
  | "date"
  | "time"
  | "datetime"
  | "duration"
  // Boolean
  | "yesno"
  // Selection
  | "choice"
  | "multichoice"
  | "tags"
  // Files
  | "linked-file"
  | "embedded-file"
  // Advanced
  | "lookup"
  | "formula";

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  isPrimary: boolean;
  description: string;
  defaultValue: string;
  displayOrder: number;
  recycled?: boolean;
  options?: Record<string, string | number | boolean | string[]>;
}

export interface CabinetRecord {
  id: string;
  seq: number;
  values: { [fieldId: string]: string | number | boolean | null };
  createdAt: string;
  updatedAt: string;
}

export interface Cabinet {
  id: string;
  name: string;
  path: string;
  recordCount: number;
  fieldCount: number;
  lastOpened: string;
  fileSize: string;
  isActive: boolean;
}

export const mockFields: Field[] = [
  { id: "f1", name: "Title", type: "text", required: true, isPrimary: true, description: "Film title", defaultValue: "", displayOrder: 0 },
  { id: "f2", name: "Director", type: "text", required: false, isPrimary: false, description: "", defaultValue: "", displayOrder: 1 },
  { id: "f3", name: "Year", type: "integer", required: false, isPrimary: false, description: "Release year", defaultValue: "", displayOrder: 2 },
  { id: "f4", name: "Genre", type: "choice", required: false, isPrimary: false, description: "", defaultValue: "", displayOrder: 3, options: { choices: ["Drama", "Comedy", "Sci-Fi", "Horror", "Mystery", "Thriller", "Romance", "Action"] } },
  { id: "f5", name: "Rating", type: "decimal", required: false, isPrimary: false, description: "Score out of 10", defaultValue: "", displayOrder: 4, options: { min: 0, max: 10, decimalPlaces: "1" } },
  { id: "f6", name: "Watched", type: "yesno", required: false, isPrimary: false, description: "", defaultValue: "0", displayOrder: 5 },
  { id: "f7", name: "Notes", type: "multiline", required: false, isPrimary: false, description: "", defaultValue: "", displayOrder: 6 },
  { id: "f8", name: "Poster", type: "linked-file", required: false, isPrimary: false, description: "", defaultValue: "", displayOrder: 7 },
];

export const mockRecycledFields: Field[] = [
  { id: "fr1", name: "Runtime", type: "integer", required: false, isPrimary: false, description: "Duration in minutes", defaultValue: "", displayOrder: -1, recycled: true },
  { id: "fr2", name: "IMDb ID", type: "text", required: false, isPrimary: false, description: "", defaultValue: "", displayOrder: -1, recycled: true },
];

export const mockRecords: CabinetRecord[] = [
  { id: "r1", seq: 1, values: { f1: "The Godfather", f2: "Francis Ford Coppola", f3: 1972, f4: "Drama", f5: 9.5, f6: true, f7: "An epic crime saga.", f8: "/films/godfather.jpg" }, createdAt: "2026-01-10", updatedAt: "2026-08-01" },
  { id: "r2", seq: 2, values: { f1: "Blade Runner 2049", f2: "Denis Villeneuve", f3: 2017, f4: "Sci-Fi", f5: 8.8, f6: true, f7: "Stunning visual poetry.", f8: "/films/br2049.jpg" }, createdAt: "2026-01-11", updatedAt: "2026-08-02" },
  { id: "r3", seq: 3, values: { f1: "Mulholland Drive", f2: "David Lynch", f3: 2001, f4: "Mystery", f5: 8.5, f6: true, f7: "Dreamlike and unsettling.", f8: null }, createdAt: "2026-01-12", updatedAt: "2026-07-15" },
  { id: "r4", seq: 4, values: { f1: "Parasite", f2: "Bong Joon-ho", f3: 2019, f4: "Thriller", f5: 9.0, f6: true, f7: "A genre-defying masterwork.", f8: "/films/parasite.jpg" }, createdAt: "2026-02-01", updatedAt: "2026-08-10" },
  { id: "r5", seq: 5, values: { f1: "The Grand Budapest Hotel", f2: "Wes Anderson", f3: 2014, f4: "Comedy", f5: 8.2, f6: true, f7: "Whimsical and precise.", f8: null }, createdAt: "2026-02-14", updatedAt: "2026-07-20" },
  { id: "r6", seq: 6, values: { f1: "2001: A Space Odyssey", f2: "Stanley Kubrick", f3: 1968, f4: "Sci-Fi", f5: 8.7, f6: true, f7: "Transcendent.", f8: "/films/2001.jpg" }, createdAt: "2026-03-01", updatedAt: "2026-07-01" },
  { id: "r7", seq: 7, values: { f1: "Stalker", f2: "Andrei Tarkovsky", f3: 1979, f4: "Drama", f5: 8.9, f6: false, f7: "On the watchlist.", f8: null }, createdAt: "2026-03-15", updatedAt: "2026-06-01" },
  { id: "r8", seq: 8, values: { f1: "Hereditary", f2: "Ari Aster", f3: 2018, f4: "Horror", f5: 7.8, f6: true, f7: "Deeply unsettling.", f8: "/films/hereditary.jpg" }, createdAt: "2026-04-01", updatedAt: "2026-08-05" },
  { id: "r9", seq: 9, values: { f1: "Portrait of a Lady on Fire", f2: "Celine Sciamma", f3: 2019, f4: "Romance", f5: 8.1, f6: false, f7: "Beautiful and restrained.", f8: null }, createdAt: "2026-04-20", updatedAt: "2026-05-10" },
  { id: "r10", seq: 10, values: { f1: "Dune: Part Two", f2: "Denis Villeneuve", f3: 2024, f4: "Sci-Fi", f5: 8.4, f6: false, f7: "Epic spectacle.", f8: "/films/dune2.jpg" }, createdAt: "2026-05-01", updatedAt: "2026-08-20" },
];

export const mockCabinets: Cabinet[] = [
  { id: "c1", name: "Film Collection", path: "~/Documents/cabinets/films.cabinet", recordCount: 10, fieldCount: 8, lastOpened: "2 min ago", fileSize: "52 KB", isActive: true },
  { id: "c2", name: "Book Library", path: "~/Documents/cabinets/books.cabinet", recordCount: 247, fieldCount: 12, lastOpened: "3 days ago", fileSize: "418 KB", isActive: false },
  { id: "c3", name: "Wine Cellar", path: "~/Documents/cabinets/wine.cabinet", recordCount: 34, fieldCount: 9, lastOpened: "1 week ago", fileSize: "61 KB", isActive: false },
  { id: "c4", name: "Travel Journal", path: "~/Documents/cabinets/travel.cabinet", recordCount: 18, fieldCount: 6, lastOpened: "2 weeks ago", fileSize: "29 KB", isActive: false },
];

export function formatValue(value: string | number | boolean | null | undefined, type: FieldType): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "yesno") return value ? "Yes" : "No";
  return String(value);
}
