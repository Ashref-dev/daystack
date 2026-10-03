<script lang="ts">
  import { untrack } from 'svelte';
  import Sheet from './Sheet.svelte';import Weekdays from './Weekdays.svelte';import Icon from './Icon.svelte';
  import { app,commit } from '#lib/state.svelte.ts';
  import { addTask, editOccurrence, getOccurrences } from '#lib/domain.ts';
  import type { Data } from '#lib/model.ts';
  import { addDays } from '#lib/dates.ts';
  let {date,onclose}:{date:string;onclose:()=>void}=$props();
  type Row={id:string;taskId:string|null;title:string;time:string;weekdays:number[]};
  function blank():Row{return {id:crypto.randomUUID(),taskId:null,title:'',time:'',weekdays:[1,2,3,4,5,6,0]};}
  const initialRows=untrack(()=>{
    const visible=new Set(Array.from({length:7},(_,offset)=>getOccurrences(app.data,addDays(date,offset))).flat().map(item=>item.task.id));
    return app.data.tasks.filter(task=>task.weekdays.length&&!task.deleted&&(!task.end||task.end>=date)&&visible.has(task.id)).map(task=>({id:crypto.randomUUID(),taskId:task.id,title:task.title,time:task.time??'',weekdays:task.weekdays.slice()}));
  });
  let rows=$state<Row[]>(initialRows.length?initialRows:[blank(),blank()]);
  let paste=$state('');let showPaste=$state(false);let error=$state('');
  function pasteRows(){const parsed=paste.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const match=/^([0-2]\d:[0-5]\d)\s+(.+)$/.exec(line);return {...blank(),title:match?.[2]??line,time:match?.[1]??''};});rows=[...rows.filter(row=>row.title.trim()),...parsed];paste='';showPaste=false;}
  function reorder(index:number,delta:number){const next=rows.slice();const row=next[index];if(!row)return;const target=index+delta;if(target<0||target>=rows.length)return;next.splice(index,1);next.splice(target,0,row);rows=next;}
  function save(){
    const filled=rows.filter(row=>row.title.trim());
    if(!filled.length){error='Add a routine before saving.';return;}
    if(filled.some(row=>!row.weekdays.length)){error='Choose at least one day for every routine.';return;}
    if(filled.some(row=>row.title.trim().length>200 || (row.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)))){error='Check your titles and times (use HH:MM).';return;}
    let result:Data=app.data;
    for(const [index,row] of filled.entries()){
      const task=result.tasks.find(task=>task.id===row.taskId);
      const draft={title:row.title.trim(),time:row.time||null,notes:task?.notes??'',start:date,end:task?.ruleEnd??null,weekdays:row.weekdays,reminder:task?.reminder??null};
      if(task){
        if(task.title===draft.title&&task.time===draft.time&&task.weekdays.join(',')===draft.weekdays.join(',')&&task.order===index)continue;
        let occurrence;
        for(let offset=0;offset<7&&!occurrence;offset++)occurrence=getOccurrences(result,addDays(date,offset)).find(item=>item.task.id===task.id);
        if(occurrence)result=editOccurrence(result,occurrence,draft,'future');
      }else result=addTask(result,draft);
      const added=result.tasks.at(-1);if(added)result={...result,tasks:result.tasks.map(item=>item.id===added.id?{...item,order:index}:item)};
    }
    commit(result);onclose();
  }
</script>
<Sheet title="Make room for your week." {onclose} wide>
  <p class="sheet-intro">Set your routines once. A fresh list, every day.</p>
  <p class="hint">Existing routines update from their next occurrence on or after {date}. Past weeks stay intact.</p>
  <div class="planner-rows">
    {#each rows as row,index (row.id)}<div class="planner-row">
      <div class="planner-inputs"><label class="field"><span class="sr-only">Routine {index+1}</span><input bind:value={row.title} maxlength="200" placeholder="Routine name"/></label><label class="field"><span class="sr-only">Time for routine {index+1}</span><input type="time" bind:value={row.time}/></label></div>
      <Weekdays bind:value={row.weekdays}/>
      <div class="row-tools"><button class="icon-button" aria-label={`Move routine ${index+1} up`} disabled={index===0} onclick={()=>reorder(index,-1)}><Icon name="up" size={16}/></button><button class="icon-button" aria-label={`Move routine ${index+1} down`} disabled={index===rows.length-1} onclick={()=>reorder(index,1)}><Icon name="down" size={16}/></button><button class="icon-button" aria-label={`Duplicate routine ${index+1}`} onclick={()=>rows=[...rows.slice(0,index+1),{...row,id:crypto.randomUUID(),taskId:null,weekdays:row.weekdays.slice()},...rows.slice(index+1)]}><Icon name="copy" size={16}/></button><button class="icon-button" aria-label={`Remove draft row ${index+1}`} onclick={()=>rows=rows.filter(item=>item.id!==row.id)}><Icon name="close" size={16}/></button></div>
    </div>{/each}
  </div>
  <div class="planner-options"><button class="text-button" onclick={()=>rows=[...rows,blank()]}><Icon name="plus" size={18}/> Add routine</button><button class="text-button" onclick={()=>showPaste=!showPaste}>Paste a list</button></div>
  {#if showPaste}<label class="field">One routine per line<textarea bind:value={paste} rows="4" placeholder={'07:30 Medication\n08:00 Skincare\n21:00 Read'}></textarea></label><button class="secondary" onclick={pasteRows}>Add pasted routines</button>{/if}
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  <div class="sheet-actions"><button class="primary" onclick={save}>Save routines<Icon name="check" size={18}/></button></div>
</Sheet>
