<script lang="ts">
  import Icon from './Icon.svelte';
  import type { Occurrence } from '#lib/model.ts';
  let {item,missed,oncomplete,onedit,ondrag}:{item:Occurrence;missed:boolean;oncomplete:()=>void;onedit:()=>void;ondrag:(event:PointerEvent)=>void}=$props();
</script>
<li class="task-row" class:completed={item.completedAt!==null} class:missed={missed&&item.completedAt===null} data-task={item.key}>
  <button class="check-target" role="checkbox" aria-checked={item.completedAt!==null} aria-label={`${item.title}${item.time?`, ${item.time}`:''}, ${item.completedAt?'complete':'incomplete'}`} onclick={oncomplete}><span class="checkbox">{#if item.completedAt}<Icon name="check" size={17}/>{/if}</span></button>
  <button data-sheet-opener class="task-content" onclick={onedit} aria-label={`Edit ${item.title}`}><span class="task-title">{item.title}</span>{#if item.notes}<span class="task-note">{item.notes}</span>{/if}</button>
  {#if item.time}<span class="task-time">{item.time}</span>{/if}
  {#if item.task.weekdays.length}<span class="routine-mark" title="Repeating routine"><Icon name="repeat" size={13}/></span>{/if}
  <button class="drag-handle icon-button" aria-label={`Drag ${item.title} to move or reorder`} onpointerdown={ondrag}><Icon name="grip" size={17}/></button>
</li>
