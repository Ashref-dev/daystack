<script lang="ts">
  import Icon from './Icon.svelte';
  import type { Occurrence } from '#lib/model.ts';
  let { item, missed, ghost, oncomplete, onedit, onlift }: {
    item: Occurrence; missed: boolean; ghost: boolean;
    oncomplete: () => void; onedit: () => void; onlift: (x: number, y: number) => void;
  } = $props();
  const done = $derived(item.completedAt !== null);
  let pressing = $state(false);
  let lifted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let originX = 0;
  let originY = 0;

  function release(): void {
    clearTimeout(timer);
    pressing = false;
    window.removeEventListener('pointermove', track);
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
  }
  function lift(x: number, y: number): void {
    release();
    lifted = true;
    navigator.vibrate?.(8);
    onlift(x, y);
  }
  function track(event: PointerEvent): void {
    const distance = Math.hypot(event.clientX - originX, event.clientY - originY);
    if (event.pointerType === 'mouse') { if (distance > 6) lift(event.clientX, event.clientY); }
    else if (distance > 8) release();
  }
  function press(event: PointerEvent): void {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('.check'))) return;
    originX = event.clientX;
    originY = event.clientY;
    lifted = false;
    if (event.pointerType !== 'mouse') {
      pressing = true;
      timer = setTimeout(() => lift(originX, originY), 420);
    }
    window.addEventListener('pointermove', track);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  }
  function edit(): void {
    if (lifted) { lifted = false; return; }
    onedit();
  }
</script>

<div class="task" class:done class:missed={missed && !done} class:pressing class:ghost onpointerdown={press} oncontextmenu={(event) => { if (pressing || lifted) event.preventDefault(); }} role="presentation">
  <button class="check" role="checkbox" aria-checked={done} aria-label={`${item.title}${item.time ? `, ${item.time}` : ''}`} onclick={oncomplete}>
    <span class="box"><Icon name="check" size={16} stroke={2.4} /></span>
  </button>
  <button class="task-body" data-sheet-opener onclick={edit} aria-label={`Edit ${item.title}`}>
    <span class="task-title">{item.title}</span>
    {#if item.notes}<span class="task-note">{item.notes}</span>{/if}
  </button>
  {#if item.time || item.task.weekdays.length}
    <span class="task-meta">{#if item.time}{item.time}{/if}{#if item.task.weekdays.length}<span class="routine" title="Repeats"><Icon name="repeat" size={12} /></span>{/if}</span>
  {/if}
</div>
