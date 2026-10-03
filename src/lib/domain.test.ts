import { describe, expect, test } from 'bun:test';
import { emptyData } from './model';
import { addTask, getOccurrences, toggleComplete, editOccurrence, removeOccurrence, moveOccurrence } from './domain';
const draft={title:'Gym',notes:'',time:'08:00',start:'2026-10-05',end:null,weekdays:[1,3,5],reminder:null};
function fixture() { return addTask(emptyData(),draft); }
describe('dated occurrences',()=>{
  test('Given a weekly routine, when resolving weekdays, then only scheduled days appear',()=>{
    const data=fixture();
    expect(['2026-10-05','2026-10-06','2026-10-07'].map(date=>getOccurrences(data,date).length)).toEqual([1,0,1]);
  });
  test('Given a completed Monday, when resolving next Monday, then it is incomplete',()=>{
    const data=fixture(); const occurrence=getOccurrences(data,'2026-10-05')[0]; if(!occurrence) throw new Error('Fixture missing');
    const completed=toggleComplete(data,occurrence);
    expect(getOccurrences(completed,'2026-10-05')[0]?.completedAt).toBeNumber();
    expect(getOccurrences(completed,'2026-10-12')[0]?.completedAt).toBeNull();
  });
  test('Given Wednesday Gym, when moving to Thursday, then next Wednesday stays unchanged',()=>{
    const data=fixture(); const occurrence=getOccurrences(data,'2026-10-07')[0]; if(!occurrence) throw new Error('Fixture missing');
    const moved=moveOccurrence(data,occurrence,'2026-10-08');
    expect(getOccurrences(moved,'2026-10-07')).toHaveLength(0);
    expect(getOccurrences(moved,'2026-10-08')[0]?.title).toBe('Gym');
    expect(getOccurrences(moved,'2026-10-14')[0]?.time).toBe('08:00');
  });
  test('Given a routine, when changing future time, then historical time is preserved',()=>{
    const data=fixture(); const occurrence=getOccurrences(data,'2026-10-07')[0]; if(!occurrence) throw new Error('Fixture missing');
    const edited=editOccurrence(data,occurrence,{...draft,time:'09:00',start:'2026-10-07'},'future');
    expect(getOccurrences(edited,'2026-10-05')[0]?.time).toBe('08:00');
    expect(getOccurrences(edited,'2026-10-07')[0]?.time).toBe('09:00');
    expect(getOccurrences(edited,'2026-10-09')[0]?.time).toBe('09:00');
  });
  test('Given a routine, when editing one occurrence, then next occurrence is unchanged',()=>{
    const data=fixture(); const occurrence=getOccurrences(data,'2026-10-07')[0]; if(!occurrence) throw new Error('Fixture missing');
    const edited=editOccurrence(data,occurrence,{...draft,title:'Gym with Sam',time:'09:30',start:'2026-10-07'},'only');
    expect(getOccurrences(edited,'2026-10-07')[0]?.title).toBe('Gym with Sam');
    expect(getOccurrences(edited,'2026-10-09')[0]?.title).toBe('Gym');
  });
  test('Given completed history, when deleting future recurrence, then history and completion remain',()=>{
    const data=fixture(); const monday=getOccurrences(data,'2026-10-05')[0]; if(!monday) throw new Error('Fixture missing');
    const completed=toggleComplete(data,monday); const wed=getOccurrences(completed,'2026-10-07')[0]; if(!wed) throw new Error('Fixture missing');
    const removed=removeOccurrence(completed,wed,'future');
    expect(getOccurrences(removed,'2026-10-05')[0]?.completedAt).toBeNumber();
    expect(getOccurrences(removed,'2026-10-09')).toHaveLength(0);
  });
});
