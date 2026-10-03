<script lang="ts">
  import { untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import Sheet from './Sheet.svelte';
  import WheelPicker from './WheelPicker.svelte';
  import Icon from './Icon.svelte';
  import { addDays, days, localDate, parseDate } from '#lib/dates.ts';
  import { taskSchema, type Data, type Draft, type Occurrence } from '#lib/model.ts';
  import { app, commit, announce } from '#lib/state.svelte.ts';
  import { addTask, editOccurrence, removeOccurrence, StaleOccurrenceError } from '#lib/domain.ts';
  import { motion } from '#lib/motion.ts';

  type Panel = 'date' | 'time' | 'end' | 'note';
  let { date, occurrence = null, onclose }: { date: string; occurrence?: Occurrence | null; onclose: () => void } = $props();
  const initial = untrack(() => ({ occurrence, date }));
  const today = localDate();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const thisYear = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });
  const otherYear = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const recurring = !!initial.occurrence?.task.weekdays.length;
  const everyDay = [0, 1, 2, 3, 4, 5, 6];
  const longNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const presets = [
    { label: 'Once', days: [] },
    { label: 'Daily', days: everyDay },
    { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
    { label: 'Weekends', days: [0, 6] }
  ];
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Array.from({ length: 24 }, (_, hour) => ({ value: pad(hour), label: pad(hour) }));
  const minutes = Array.from({ length: 60 }, (_, minute) => ({ value: pad(minute), label: pad(minute) }));

  const formId = $props.id();
  let sheet: ReturnType<typeof Sheet>;
  let titleInput: HTMLInputElement;
  let title = $state(initial.occurrence?.title ?? '');
  let notes = $state(initial.occurrence?.notes ?? '');
  let time = $state(initial.occurrence?.time ?? '');
  let start = $state(initial.date);
  let end = $state(initial.occurrence?.task.ruleEnd ?? '');
  let selectedDays = $state<number[]>(initial.occurrence ? initial.occurrence.task.weekdays.slice() : everyDay.slice());
  let scope = $state<'only' | 'future'>('only');
  let open = $state<Panel | null>(null);
  let error = $state('');
  let titleInvalid = $state(false);
  let armed = $state(false);
  let disarm: ReturnType<typeof setTimeout> | undefined;

  const editingRule = $derived(!recurring || scope === 'future');
  const repeating = $derived(editingRule && selectedDays.length > 0);
  const effectiveStart = $derived(recurring && scope === 'future' ? (initial.occurrence?.originalDate ?? start) : start);
  const lower = initial.date < today ? initial.date : today;
  const upper = initial.date > today ? initial.date : today;
  const dateOptions = optionsFrom(addDays(lower, -60), 60 + span(lower, upper) + 400);
  const endOptions = $derived(optionsFrom(effectiveStart, 731));
  const repeatSummary = $derived(summary(selectedDays));

  function span(from: string, to: string): number { return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000); }
  function optionsFrom(from: string, count: number) { return Array.from({ length: count }, (_, offset) => { const value = addDays(from, offset); return { value, label: dayLabel(value) }; }); }
  function dayLabel(value: string): string {
    if (value === today) return 'Today';
    if (value === tomorrow) return 'Tomorrow';
    if (value === yesterday) return 'Yesterday';
    return (value.slice(0, 4) === today.slice(0, 4) ? thisYear : otherYear).format(parseDate(value));
  }
  function same(left: readonly number[], right: readonly number[]): boolean { return left.length === right.length && left.every(day => right.includes(day)); }
  function summary(selected: readonly number[]): string {
    if (!selected.length) return `Once, ${dayLabel(start).replace(/^(Today|Tomorrow|Yesterday)$/, value => value.toLowerCase())}`;
    if (selected.length === 7) return 'Every day';
    if (same(selected, [1, 2, 3, 4, 5])) return 'Every weekday';
    if (same(selected, [0, 6])) return 'Every weekend';
    if (selected.length === 1) return `Every ${longNames[selected[0] ?? 0]}`;
    return `${selected.length} days a week`;
  }
  function toggle(panel: Panel): void { open = open === panel ? null : panel; }
  function nextHour(): string { return `${pad((new Date().getHours() + 1) % 24)}:00`; }
  function setTime(enabled: boolean): void {
    time = enabled ? (initial.occurrence?.time ?? nextHour()) : '';
    open = enabled ? 'time' : open === 'time' ? null : open;
  }
  function setEnd(enabled: boolean): void {
    end = enabled ? addDays(effectiveStart, 27) : '';
    open = enabled ? 'end' : open === 'end' ? null : open;
  }
  function setDays(next: number[]): void {
    selectedDays = next;
    if (!next.length) { end = ''; if (open === 'end') open = null; }
  }
  function toggleDay(day: number): void {
    setDays(selectedDays.includes(day) ? selectedDays.filter(item => item !== day) : [...selectedDays, day]);
  }

  function applyChange(update: () => Data): boolean {
    try { commit(update()); sheet.dismiss(); return true; }
    catch (cause) { if (cause instanceof StaleOccurrenceError) { error = cause.message; return false; } throw cause; }
  }
  function save(): void {
    error = '';
    titleInvalid = false;
    const name = title.trim();
    if (!name) { error = 'Give it a name.'; titleInvalid = true; titleInput.focus(); return; }
    if (repeating && end && end < effectiveStart) { error = 'The end date must be after the start.'; return; }
    const reminder = time ? (initial.occurrence?.task.reminder ?? null) : null;
    const draft: Draft = { title: name, notes: notes.trim(), time: time || null, start, end: selectedDays.length && end ? end : null, weekdays: selectedDays, reminder };
    const parsed = taskSchema.safeParse({ ...draft, id: crypto.randomUUID(), updatedAt: Date.now(), deleted: false, order: 0 });
    if (!parsed.success) { error = parsed.error.issues[0]?.message ?? 'Check the details and try again.'; return; }
    const target = initial.occurrence;
    if (applyChange(() => target ? editOccurrence(app.data, target, draft, scope) : addTask(app.data, draft))) announce(target ? 'Task updated' : 'Task added');
  }
  function remove(): void {
    const target = initial.occurrence;
    if (!target) return;
    if (!armed) { armed = true; clearTimeout(disarm); disarm = setTimeout(() => { armed = false; }, 3500); return; }
    clearTimeout(disarm);
    if (applyChange(() => removeOccurrence(app.data, target, scope))) announce('Task deleted');
  }
</script>

{#snippet toggleSwitch(checked: boolean, name: string, onchange: (value: boolean) => void)}
  <button type="button" class="switch" role="switch" aria-checked={checked} aria-label={name} onclick={() => onchange(!checked)}></button>
{/snippet}

<Sheet bind:this={sheet} label={initial.occurrence ? 'Edit task' : 'New task'} {onclose}>
  <form class="composer" id={formId} onsubmit={(event) => { event.preventDefault(); save(); }}>
    <input
      class="title-input"
      data-initial-focus={initial.occurrence ? undefined : ''}
      bind:this={titleInput}
      bind:value={title}
      aria-label="Task name"
      aria-invalid={titleInvalid}
      oninput={() => { if (titleInvalid) { titleInvalid = false; error = ''; } }}
      placeholder="New task"
      maxlength="200"
      enterkeyhint="done"
      autocomplete="off"
    />

    {#if recurring}
      <div class="segmented" data-value={scope} role="group" aria-label="Apply changes to">
        <button type="button" aria-pressed={scope === 'only'} onclick={() => { scope = 'only'; open = null; armed = false; }}>This day</button>
        <button type="button" aria-pressed={scope === 'future'} onclick={() => { scope = 'future'; open = null; armed = false; }}>This &amp; upcoming</button>
      </div>
    {/if}

    {#if editingRule}
      <section class="repeat" aria-label="Repeat" transition:slide={{ duration: motion(280), easing: quintOut }}>
        <div class="repeat-head"><span>Repeat</span><span class="repeat-summary">{repeatSummary}</span></div>
        <div class="day-dots" role="group" aria-label="Repeat on">
          {#each days as day (day.value)}
            <button type="button" class="day-dot" class:on={selectedDays.includes(day.value)} aria-pressed={selectedDays.includes(day.value)} aria-label={longNames[day.value]} onclick={() => toggleDay(day.value)}>{day.label.slice(0, 1)}</button>
          {/each}
        </div>
        <div class="presets" role="group" aria-label="Quick repeat">
          {#each presets as preset (preset.label)}
            <button type="button" class="chip" class:on={same(preset.days, selectedDays)} aria-pressed={same(preset.days, selectedDays)} onclick={() => setDays(preset.days.slice())}>{preset.label}</button>
          {/each}
        </div>
      </section>
    {/if}

    <div class="rows">
      <div class="row-item">
        <div class="row">
          <button type="button" class="row-main" aria-expanded={open === 'time'} onclick={() => (time ? toggle('time') : setTime(true))}>
            <Icon name="clock" size={18} /><span class="row-label">Time</span>{#if time}<span class="row-value" class:active={open === 'time'}>{time}</span>{/if}
          </button>
          {@render toggleSwitch(!!time, 'Set a time', setTime)}
        </div>
        {#if open === 'time' && time}
          <div class="panel" transition:slide={{ duration: motion(320), easing: quintOut }}>
            <div class="wheels time-wheels">
              <WheelPicker label="Hour" options={hours} value={time.slice(0, 2)} infinite align="end" onchange={(value) => (time = `${value}:${time.slice(3, 5)}`)} />
              <span class="wheel-colon" aria-hidden="true">:</span>
              <WheelPicker label="Minute" options={minutes} value={time.slice(3, 5)} infinite align="start" onchange={(value) => (time = `${time.slice(0, 2)}:${value}`)} />
            </div>
          </div>
        {/if}
      </div>

      {#if !(recurring && scope === 'future')}
        <div class="row-item">
          <button type="button" class="row" aria-expanded={open === 'date'} onclick={() => toggle('date')}>
            <Icon name="calendar" size={18} /><span class="row-label">{repeating ? 'Starts' : 'Date'}</span><span class="row-value" class:active={open === 'date'}>{dayLabel(start)}</span>
          </button>
          {#if open === 'date'}
            <div class="panel" transition:slide={{ duration: motion(320), easing: quintOut }}>
              <div class="wheels"><WheelPicker label={repeating ? 'Start date' : 'Date'} options={dateOptions} value={start} onchange={(value) => { start = value; if (end && end < value) end = value; }} /></div>
            </div>
          {/if}
        </div>
      {/if}

      {#if repeating}
        <div class="row-item" transition:slide={{ duration: motion(280), easing: quintOut }}>
          <div class="row">
            <button type="button" class="row-main" aria-expanded={open === 'end'} onclick={() => (end ? toggle('end') : setEnd(true))}>
              <Icon name="flag" size={18} /><span class="row-label">Ends</span><span class="row-value" class:active={open === 'end'}>{end ? dayLabel(end) : 'Never'}</span>
            </button>
            {@render toggleSwitch(!!end, 'Set an end date', setEnd)}
          </div>
          {#if open === 'end' && end}
            <div class="panel" transition:slide={{ duration: motion(320), easing: quintOut }}>
              <div class="wheels"><WheelPicker label="End date" options={endOptions} value={end} onchange={(value) => (end = value)} /></div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="row-item">
        <button type="button" class="row" aria-expanded={open === 'note'} onclick={() => toggle('note')}>
          <Icon name="note" size={18} /><span class="row-label">Note</span>{#if notes.trim() && open !== 'note'}<span class="row-value note-preview">{notes.trim()}</span>{/if}
        </button>
        {#if open === 'note'}
          <div class="panel" transition:slide={{ duration: motion(320), easing: quintOut }}>
            <!-- svelte-ignore a11y_autofocus -->
            <textarea class="note-input" bind:value={notes} aria-label="Note" maxlength="4000" rows="3" autofocus></textarea>
          </div>
        {/if}
      </div>
    </div>

    {#if error}<p class="form-error" role="alert" transition:slide={{ duration: motion(200) }}>{error}</p>{/if}
  </form>
  {#snippet footer()}
    {#if initial.occurrence}
      <button type="button" class="delete" class:armed onclick={remove} aria-label={armed ? 'Confirm delete' : 'Delete task'}>
        <Icon name="trash" size={18} />{#if armed}<span>{recurring && scope === 'future' ? 'Delete all upcoming' : 'Delete'}</span>{/if}
      </button>
    {/if}
    <button type="submit" form={formId} class="save">{initial.occurrence ? 'Save' : repeating ? `Add to ${selectedDays.length === 7 ? 'every day' : selectedDays.length === 1 ? `${longNames[selectedDays[0] ?? 0]}s` : `${selectedDays.length} days`}` : 'Add task'}</button>
  {/snippet}
</Sheet>
