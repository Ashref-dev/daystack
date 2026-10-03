export function localDate(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}
export function parseDate(value: string): Date { return new Date(`${value}T12:00:00`); }
export function addDays(value: string, days: number): string { const date = parseDate(value); date.setDate(date.getDate()+days); return localDate(date); }
export function weekday(value: string): number { return parseDate(value).getDay(); }
export function weekOf(value: string, start: number): string { return addDays(value,-((weekday(value)-start+7)%7)); }
export function weekDates(value: string): string[] { return Array.from({length:7},(_,index)=>addDays(value,index)); }
export function formatDate(value: string, options: Intl.DateTimeFormatOptions): string { return new Intl.DateTimeFormat('en',options).format(parseDate(value)); }
export function weekLabel(value: string): string { const end=addDays(value,6); return `${formatDate(value,{month:'short',day:'numeric'})} — ${formatDate(end,{month:'short',day:'numeric'})}`; }
export const days = [{label:'Mon',value:1},{label:'Tue',value:2},{label:'Wed',value:3},{label:'Thu',value:4},{label:'Fri',value:5},{label:'Sat',value:6},{label:'Sun',value:0}] as const;
