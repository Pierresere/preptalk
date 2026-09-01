export type Screen =
  | { name: 'home' }
  | { name: 'dossiers' }
  | { name: 'prepare' | 'interview' | 'debrief'; id: string }
