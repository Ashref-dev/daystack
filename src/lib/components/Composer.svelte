<script lang="ts">
  import { untrack } from 'svelte';
  import Sheet from './Sheet.svelte';
  import Weekdays from './Weekdays.svelte';
  import Icon from './Icon.svelte';
  import { weekday } from '#lib/dates.ts';
  import { taskSchema,type Data, type Draft, type Occurrence } from '#lib/model.ts';
  import { app, commit, announce } from '#lib/state.svelte.ts';
  import { addTask, editOccurrence, moveOccurrence, removeOccurrence,StaleOccurrenceError } from '#lib/domain.ts';
  import { backgroundPushConfigured } from '#lib/reminders.ts';
  let {date,occurrence=null,onclose}:{date:string;occurrence?:Occurrence|null;onclose:()=>void}=$props();
  const initial=untrack(()=>({occurrence,date}));
  let title=$state(initial.occurrence?.title??''); let notes=$state(initial.occurrence?.notes??'');
  let time=$state(initial.occurrence?.time??''); let start=$state(initial.date); let end=$state(initial.occurrence?.task.ruleEnd??'');
  let selectedDays=$state<number[]>(initial.occurrence?.task.weekdays.slice()??[]);
  let repeat=$state(initial.occurrence?.task.weekdays.length?'custom':'none');
  let reminder=$state(initial.occurrence?initial.occurrence.task.reminder:app.data.settings.defaultReminder);
  let scope=$state<'only'|'future'>('only'); let error=$state(''); let confirmDelete=$state(false);
  let titleInvalid=$state(false);let titleInput:HTMLInputElement;const errorId=$props.id();
  let details=$state(!!initial.occurrence?.notes); let moveDate=$state(initial.date); let showMove=$state(false);
  const recurring=$derived(!!occurrence?.task.weekdays.length);
  const effectiveStart=$derived(recurring&&scope==='future'?(occurrence?.originalDate??start):start);
  function applyChange(update:()=>Data):boolean{try{commit(update());onclose();return true;}catch(cause){if(cause instanceof StaleOccurrenceError){error=cause.message;return false;}throw cause;}}
  function changeRepeat() {
    switch(repeat){case 'none':selectedDays=[];break;case 'daily':selectedDays=[0,1,2,3,4,5,6];break;case 'weekdays':selectedDays=[1,2,3,4,5];break;case 'weekends':selectedDays=[0,6];break;case 'weekly':selectedDays=[weekday(start)];break;case 'custom':if(!selectedDays.length)selectedDays=[weekday(start)];break;}
  }
  async function enableReminder() {
    if(reminder===null) return;
    if(!('Notification' in window)){error='This browser doesn’t support notifications. On iPhone, install Folio first.';reminder=null;return;}
    if(Notification.permission==='default') await Notification.requestPermission();
    if(Notification.permission!=='granted'){error='Notifications aren’t enabled. You can change this in your browser settings.';reminder=null;}
  }
  function save() {
    error='';titleInvalid=false;
    if(!title.trim()){error='Give this task a name.';titleInvalid=true;titleInput.focus();return;}
    if(repeat!=='none'&&!selectedDays.length){error='Choose at least one day for this routine.';return;}
    if(reminder!==null&&!time&&(!recurring||scope==='future')){error='Choose a time for this reminder.';return;}
    if(repeat!=='none'&&(!recurring||scope==='future')&&end&&end<effectiveStart){error='The end date must be on or after the start date.';return;}
    const draft:Draft={title:title.trim(),notes:notes.trim(),time:time||null,start,end:end||null,weekdays:selectedDays,reminder};
    const parsed=taskSchema.safeParse({...draft,id:crypto.randomUUID(),updatedAt:Date.now(),deleted:false,order:0});
    if(!parsed.success){error=parsed.error.issues[0]?.message??'Please check your task details.';return;}
    const isEdit=occurrence!==null;
    if(applyChange(()=>occurrence?editOccurrence(app.data,occurrence,draft,scope):addTask(app.data,draft)))announce(isEdit?'Task updated':'Task added');
  }
</script>
<Sheet title={occurrence?'Edit task':'A little intention.'} {onclose}>
  <form onsubmit={(event)=>{event.preventDefault();save();}}>
    <label class="field title-field">What needs to happen?<input data-initial-focus bind:this={titleInput} bind:value={title} aria-invalid={titleInvalid} aria-describedby={titleInvalid?errorId:undefined} oninput={()=>{if(titleInvalid)error='';titleInvalid=false;}} placeholder="e.g. Take a morning walk" maxlength="200" required/></label>
    {#if recurring}
      <fieldset class="scope"><legend>Apply changes to</legend><label><input type="radio" bind:group={scope} value="only"/> Only this occurrence</label><label><input type="radio" bind:group={scope} value="future"/> This and future occurrences</label></fieldset>
    {/if}
    <div class="form-columns"><label class="field">{recurring&&scope==='future'?'Changes begin':'Date'}{#if recurring&&scope==='future'}<input type="date" value={effectiveStart} disabled/>{:else}<input type="date" bind:value={start} required/>{/if}</label><label class="field"><span>Time <span class="optional">optional</span></span><input type="time" bind:value={time}/></label></div>
    {#if !recurring||scope==='future'}
      <label class="field">Repeat<select bind:value={repeat} onchange={changeRepeat}><option value="none">Doesn’t repeat</option><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekends">Weekends</option><option value="weekly">Every week on this day</option><option value="custom">Custom days</option></select></label>
      {#if repeat!=='none'}<Weekdays bind:value={selectedDays}/><label class="field end-field">Ends <span class="optional">optional</span><input type="date" bind:value={end} min={effectiveStart}/></label>{/if}
    {:else}<p class="hint"><Icon name="repeat" size={16}/> Your weekly routine stays unchanged.</p>{/if}
    <button type="button" class="text-button" onclick={()=>details=!details}>{details?'Hide notes':'Add a note'}</button>
    {#if details}<label class="field">Notes<textarea bind:value={notes} maxlength="4000" placeholder="Anything worth remembering…" rows="3"></textarea></label>{/if}
    {#if !recurring||scope==='future'}<label class="field">Reminder<select bind:value={reminder} onchange={enableReminder}><option value={null}>No reminder</option><option value={0}>At time</option><option value={5}>5 minutes before</option><option value={10}>10 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option></select></label>{/if}
    {#if reminder!==null}<p class="hint">{backgroundPushConfigured?'Enable background reminders for this device in Settings.':'Reminders work while Folio is open. Background push requires a configured reminder server.'}</p>{/if}
    {#if error}<p id={errorId} role="alert" class="form-error">{error}</p>{/if}
    <div class="sheet-actions"><button class="primary" type="submit">{occurrence?'Save changes':'Add task'}<Icon name="check" size={18}/></button></div>
  </form>
  {#if occurrence}<div class="editor-actions"><button class="text-button" onclick={()=>showMove=!showMove}><Icon name="arrow" size={17}/> Move to another day</button><button class="text-button danger" onclick={()=>confirmDelete=!confirmDelete}><Icon name="trash" size={17}/> Delete task</button></div>
    {#if showMove}<div class="inline-action"><label class="field">Move to<input type="date" bind:value={moveDate}/></label><button class="secondary" onclick={()=>{if(moveDate)applyChange(()=>moveOccurrence(app.data,occurrence,moveDate));}}>Move</button></div>{/if}
    {#if confirmDelete}<div class="delete-confirm"><p>{recurring?(scope==='only'?'Remove this occurrence only?':'Remove this and future occurrences?'):'Delete this task?'}</p><p class="hint">Past routine history is preserved.</p><button class="secondary danger" onclick={()=>applyChange(()=>removeOccurrence(app.data,occurrence,scope))}>Confirm deletion</button></div>{/if}
  {/if}
</Sheet>
