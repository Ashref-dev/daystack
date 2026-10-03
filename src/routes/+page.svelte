<script lang="ts">
  import { onMount, tick,untrack } from 'svelte';
  import type { PageProps } from './$types';
  import type { Subscription } from '@supabase/supabase-js';
  import Icon from '#lib/components/Icon.svelte';
  import Composer from '#lib/components/Composer.svelte';
  import BulkPlanner from '#lib/components/BulkPlanner.svelte';
  import Settings from '#lib/components/Settings.svelte';
  import Sheet from '#lib/components/Sheet.svelte';
  import TaskRow from '#lib/components/TaskRow.svelte';
  import { app, initialize, commit, announce } from '#lib/state.svelte.ts';
  import { addTask, exampleWeek, getOccurrences, moveOccurrence, reorderOccurrence, toggleComplete } from '#lib/domain.ts';
  import { addDays, formatDate, localDate, weekDates, weekLabel, weekOf } from '#lib/dates.ts';
  import { dateSchema } from '#lib/model.ts';
  import type { Occurrence } from '#lib/model.ts';
  import { checkReminders } from '#lib/reminders.ts';
  import { cloudClient } from '#lib/cloud.ts';
  import { syncNow } from '#lib/sync.svelte.ts';
  let {data}:PageProps=$props();
  const initialToday=untrack(()=>data.initialDate);
  let today=$state(initialToday);let week=$state(weekOf(initialToday,1));let expanded=$state(initialToday);let quickTitle=$state('');
  let surface=$state<'composer'|'planner'|'settings'|'picker'|null>(null);let editing=$state<Occurrence|null>(null);let pickerDate=$state(initialToday);
  let dragging=$state<Occurrence|null>(null);let dragX=$state(0);let dragY=$state(0);let hoverDay=$state('');let showInstall=$state(false);let menu=$state(false);
  let installPrompt=$state<(Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>})|null>(null);
  let touchX=0;let touchY=0;let midnightTimer:ReturnType<typeof setTimeout>;let syncTimer:ReturnType<typeof setTimeout>;let lastWeekStart=1;
  const dates=$derived(weekDates(week));
  const allOccurrences=$derived(dates.map(date=>({date,items:getOccurrences(app.data,date)})));
  const isCurrentWeek=$derived(week===weekOf(today,app.data.settings.weekStart));
  const hasTasks=$derived(app.data.tasks.some(task=>!task.deleted));
  function navigate(delta:number){week=addDays(week,delta*7);expanded=addDays(expanded,delta*7);quickTitle='';menu=false;}
  async function revealToday(){await tick();const sheet=document.querySelector('.day-sheet.active');if(sheet&&sheet.getBoundingClientRect().bottom>innerHeight-80)sheet.scrollIntoView({block:'start',behavior:'instant'});}
  function goToday(){week=weekOf(today,app.data.settings.weekStart);expanded=today;quickTitle='';void revealToday();}
  function openComposer(item:Occurrence|null=null){editing=item;surface='composer';menu=false;}
  function focusSheetOpener(event:MouseEvent){const target=event.target;if(!(target instanceof Element))return;const button=target.closest('button[data-sheet-opener]');const opener=button?.closest('.context-menu')?button.closest('.menu-wrap')?.querySelector('button'):button;if(opener instanceof HTMLElement)opener.focus({preventScroll:true});}
  function quickAdd(){const title=quickTitle.trim();if(!title)return;commit(addTask(app.data,{title,notes:'',time:null,start:expanded,end:null,weekdays:[],reminder:null}));quickTitle='';announce('Task added');}
  function refreshDay(){const next=localDate();if(next!==today){today=next;goToday();}clearTimeout(midnightTimer);const midnight=new Date();midnight.setHours(24,0,0,20);midnightTimer=setTimeout(refreshDay,midnight.getTime()-Date.now());}
  function endDrag(event:PointerEvent){
    if(!dragging)return;
    const element=document.elementFromPoint(event.clientX,event.clientY);
    const taskKey=element?.closest('[data-task]')?.getAttribute('data-task');
    const target=element?.closest('[data-day]')?.getAttribute('data-day');
    if(target&&target!==dragging.date){commit(moveOccurrence(app.data,dragging,target));expanded=target;announce(`Moved to ${formatDate(target,{weekday:'long'})}`);}
    else if(taskKey&&taskKey!==dragging.key){const sibling=getOccurrences(app.data,dragging.date).find(item=>item.key===taskKey);if(sibling&&sibling.time===dragging.time){const down=event.clientY>(element?.closest('[data-task]')?.getBoundingClientRect().top??0)+24;commit(reorderOccurrence(app.data,dragging,sibling.order+(down?0.01:-0.01)));announce('Task reordered');}}
    dragging=null;hoverDay='';window.removeEventListener('pointermove',moveDrag);window.removeEventListener('pointerup',endDrag);window.removeEventListener('pointercancel',cancelDrag);
  }
  function cancelDrag(){dragging=null;hoverDay='';window.removeEventListener('pointermove',moveDrag);window.removeEventListener('pointerup',endDrag);window.removeEventListener('pointercancel',cancelDrag);}
  function moveDrag(event:PointerEvent){dragX=event.clientX;dragY=event.clientY;hoverDay=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-day]')?.getAttribute('data-day')??'';if(event.clientY<90)window.scrollBy(0,-12);else if(event.clientY>innerHeight-70)window.scrollBy(0,12);}
  function startDrag(item:Occurrence,event:PointerEvent){if(event.button!==0)return;event.preventDefault();dragging=item;dragX=event.clientX;dragY=event.clientY;window.addEventListener('pointermove',moveDrag);window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',cancelDrag);}
  $effect(()=>{if(typeof document==='undefined'||!app.ready)return;const theme=app.data.settings.theme;document.documentElement.dataset['theme']=theme;localStorage.setItem('folio-appearance',theme);const dark=theme==='dark'||(theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#171816':'#eae9e4');});
  $effect(()=>{const start=app.data.settings.weekStart;if(start!==lastWeekStart){lastWeekStart=start;week=weekOf(expanded,start);}});
  onMount(()=>{
    let active=true;
    const handleSaved=()=>{clearTimeout(syncTimer);syncTimer=setTimeout(()=>{void syncNow();},700);};
    const online=()=>{app.online=navigator.onLine;if(app.online)void syncNow();};
    const resume=()=>{if(document.visibilityState==='visible'){refreshDay();online();}};
    function isInstallEvent(event:Event):event is Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>}{return 'prompt' in event&&typeof event.prompt==='function'&&'userChoice' in event&&event.userChoice instanceof Promise;}
    const install=(event:Event)=>{if(isInstallEvent(event)){event.preventDefault();installPrompt=event;}};
    void initialize().then(()=>{
      if(!active)return;today=localDate();expanded=today;lastWeekStart=app.data.settings.weekStart;week=weekOf(today,lastWeekStart);
      const requested=dateSchema.safeParse(new URLSearchParams(location.search).get('date'));if(requested.success){expanded=requested.data;week=weekOf(expanded,lastWeekStart);}
      app.online=navigator.onLine;showInstall=/iPad|iPhone|iPod/.test(navigator.userAgent)&&!matchMedia('(display-mode: standalone)').matches&&!app.data.settings.installDismissed;
      refreshDay();void revealToday();void syncNow();
    });
    let auth:Subscription|null=null;
    void cloudClient().then(client=>{if(active)auth=client?.auth.onAuthStateChange(()=>{handleSaved();}).data.subscription??null;});
    const interval=setInterval(()=>{void checkReminders(app.data).catch(error=>{if(error instanceof Error)app.status='A reminder couldn’t be shown. Check notification settings.';});if(app.online)void syncNow();},30000);
    window.addEventListener('click',focusSheetOpener,true);window.addEventListener('online',online);window.addEventListener('offline',online);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);window.addEventListener('folio-saved',handleSaved);window.addEventListener('beforeinstallprompt',install);
    return()=>{active=false;clearTimeout(midnightTimer);clearTimeout(syncTimer);clearInterval(interval);auth?.unsubscribe();cancelDrag();window.removeEventListener('click',focusSheetOpener,true);window.removeEventListener('online',online);window.removeEventListener('offline',online);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);window.removeEventListener('folio-saved',handleSaved);window.removeEventListener('beforeinstallprompt',install);};
  });
</script>

<svelte:head><title>Folio · A little structure for your week</title><meta name="description" content="Your week, one day at a time. A beautifully simple, private weekly checklist with fresh recurring routines. Works offline, feels at home."/></svelte:head>
<div class="app-shell">
  <header class="app-header"><a class="brand" href="/" aria-label="Folio home" onclick={(event)=>{event.preventDefault();goToday();}}><img src="/icons/icon-192.png" alt="" width="36" height="36"/><span>folio<span class="brand-dot">.</span></span></a><div class="header-actions"><button data-sheet-opener class="plan-button secondary" onclick={()=>surface='planner'}><Icon name="stack" size={18}/><span>Plan your week</span></button><button data-sheet-opener class="icon-button settings-button" aria-label="Settings" onclick={()=>surface='settings'}><Icon name="settings"/></button></div></header>
  <main>
    <div class="week-heading"><div><h1>Your week, unfolded.</h1><p>A little structure. A lot of breathing room.</p></div><button data-sheet-opener class="icon-button mobile-plan" aria-label="Plan your week" onclick={()=>surface='planner'}><Icon name="stack"/></button></div>
    <nav class="week-nav" aria-label="Week navigation"><div class="week-controls"><button class="icon-button" aria-label="Previous week" onclick={()=>navigate(-1)}><Icon name="left" size={18}/></button><button data-sheet-opener class="week-range" onclick={()=>{pickerDate=expanded;surface='picker';}}>{weekLabel(week)}<span>{formatDate(week,{year:'numeric'})}</span></button><button class="icon-button" aria-label="Next week" onclick={()=>navigate(1)}><Icon name="right" size={18}/></button></div><div class="week-tools"><button class="today-button" class:current={isCurrentWeek} onclick={goToday}>Today<span class="today-dot"></span></button><div class="menu-wrap"><button class="icon-button" aria-label="More actions" aria-expanded={menu} onclick={()=>menu=!menu}><Icon name="more"/></button>{#if menu}<div class="context-menu"><button data-sheet-opener onclick={()=>{surface='planner';menu=false;}}><Icon name="stack" size={18}/>Plan week</button><button data-sheet-opener onclick={()=>{openComposer();}}><Icon name="plus" size={18}/>Add task</button><button data-sheet-opener onclick={()=>{surface='settings';menu=false;}}><Icon name="settings" size={18}/>Settings</button></div>{/if}</div></div></nav>
    {#if app.error}<div class="error-banner" role="alert">{app.error}</div>{/if}
    {#if !app.online}<p class="offline-note"><Icon name="wifi" size={14}/> Offline. Your week is still here.</p>{/if}
    <div class="week-stack" role="group" aria-label="Seven day stack" ontouchstart={(event)=>{touchX=event.changedTouches[0]?.clientX??0;touchY=event.changedTouches[0]?.clientY??0;}} ontouchend={(event)=>{if(dragging)return;const x=(event.changedTouches[0]?.clientX??touchX)-touchX;const y=(event.changedTouches[0]?.clientY??touchY)-touchY;const target=event.target;if(Math.abs(x)>90&&Math.abs(y)<45&&target instanceof Element&&!target.closest('button,input'))navigate(x<0?1:-1);}}>
      {#each allOccurrences as day,index (day.date)}
        {@const complete=day.items.filter(item=>item.completedAt!==null).length}
        {@const opened=expanded===day.date}
        <section class="day-sheet" class:active={opened} class:today={day.date===today} class:drop-target={hoverDay===day.date} data-day={day.date} style={`--sheet-index:${index}`} aria-label={formatDate(day.date,{weekday:'long',month:'long',day:'numeric'})}>
          <button class="day-header" onclick={()=>{expanded=day.date;quickTitle='';}} aria-expanded={opened} aria-controls={`day-${day.date}`}>
            <div class="day-label"><h2>{formatDate(day.date,{weekday:'long'}).toUpperCase()}</h2><span class="day-date">{formatDate(day.date,{month:'short',day:'numeric'})}{#if day.date===today}<span class="today-label">Today</span>{/if}</span></div>
            <div class="day-meta">{#if day.items.length}<span class="day-progress" class:all-done={complete===day.items.length}>{complete}<span> / {day.items.length}</span></span>{:else}<span class="day-empty">A clear day</span>{/if}<span class="day-chevron"><Icon name={opened?'up':'down'} size={18}/></span></div>
          </button>
          {#if opened}<div class="day-content" id={`day-${day.date}`}>
            {#if day.items.length}<ul class="tasks">{#each day.items.filter(item=>!item.completedAt||(app.data.settings.showCompleted&&!(app.data.settings.hidePastCompleted&&day.date<today))) as item (item.key)}<TaskRow {item} missed={day.date<today} oncomplete={()=>{commit(toggleComplete(app.data,item));announce(item.completedAt?'Task marked incomplete':'Task complete');}} onedit={()=>openComposer(item)} ondrag={(event)=>startDrag(item,event)}/>{/each}</ul>
              {#if day.items.every(item=>item.completedAt)&&!app.data.settings.showCompleted}<p class="quiet-done"><Icon name="check" size={18}/> All done. Room to breathe.</p>{/if}
            {:else}<div class="empty-day"><span class="empty-line"></span><p>{day.date<today?'A day left open.':'Nothing on your plate.'}</p><span>{hasTasks?'A little room for whatever comes your way.':'Start with one thing. Make the week your own.'}</span></div>{/if}
            <form class="quick-add" onsubmit={(event)=>{event.preventDefault();quickAdd();}}><Icon name="plus" size={21}/><input aria-label={`Add a task for ${formatDate(day.date,{weekday:'long'})}`} bind:value={quickTitle} placeholder={hasTasks?'Add a task…':'Add your first task…'} maxlength="200" disabled={!app.ready}/>{#if quickTitle.trim()}<button class="icon-button" type="submit" aria-label="Save quick task"><Icon name="arrow" size={18}/></button>{/if}<button data-sheet-opener class="icon-button" type="button" aria-label="Open full task composer" onclick={()=>openComposer()} disabled={!app.ready}><Icon name="expand" size={16}/></button></form>
            {#if !hasTasks&&app.ready}<div class="starter-prompt"><span>Not sure where to start?</span><button onclick={()=>commit(exampleWeek(app.data,today))}>Try an example week <Icon name="arrow" size={14}/></button></div>{/if}
          </div>{/if}
        </section>
      {/each}
    </div>
    {#if showInstall}<div class="install-card"><img src="/icons/icon-192.png" alt="" width="44" height="44"/><div><strong>A place on your Home Screen.</strong><p>Share → Add to Home Screen. Your week, a tap away.</p></div><button class="icon-button" aria-label="Dismiss install instructions" onclick={()=>{showInstall=false;commit({...app.data,settings:{...app.data.settings,installDismissed:true}});}}><Icon name="close" size={16}/></button></div>{/if}
    {#if installPrompt}<button class="install-button text-button" onclick={async()=>{await installPrompt?.prompt();installPrompt=null;}}>Install Folio <Icon name="download" size={17}/></button>{/if}
    <footer class="app-footer"><span>{app.saving?'Saving…':'Your week. At your pace.'}</span><a href="https://ashref.tn" target="_blank" rel="noreferrer">Made by ashref.tn<Icon name="arrow" size={12}/></a></footer>
  </main>
</div>
<span class="sr-only" aria-live="polite">{app.status}</span>
{#if dragging}<div class="drag-preview" style={`left:${dragX}px;top:${dragY}px`}><Icon name="grip" size={17}/>{dragging.title}</div>{/if}
{#if surface==='composer'}<Composer date={editing?.date??expanded} occurrence={editing} onclose={()=>{surface=null;editing=null;}}/>{/if}
{#if surface==='planner'}<BulkPlanner date={week<today?today:week} onclose={()=>surface=null}/>{/if}
{#if surface==='settings'}<Settings onclose={()=>surface=null}/>{/if}
{#if surface==='picker'}<Sheet title="Find your week." onclose={()=>surface=null}><p class="sheet-intro">A past week, a future plan. Choose any date.</p><form onsubmit={(event)=>{event.preventDefault();if(dateSchema.safeParse(pickerDate).success){week=weekOf(pickerDate,app.data.settings.weekStart);expanded=pickerDate;surface=null;}}}><label class="field">Go to date<input type="date" bind:value={pickerDate} required/></label><button class="primary">Open week<Icon name="arrow" size={18}/></button></form></Sheet>{/if}
