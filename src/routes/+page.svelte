<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { quintOut } from 'svelte/easing';
  import { page } from '$app/state';
  import type { PageProps } from './$types';
  import type { Subscription } from '@supabase/supabase-js';
  import Icon from '#lib/components/Icon.svelte';
  import Composer from '#lib/components/Composer.svelte';
  import TaskRow from '#lib/components/TaskRow.svelte';
  import { app, initialize, commit, announce } from '#lib/state.svelte.ts';
  import { getOccurrences, moveOccurrence, reorderOccurrence, toggleComplete } from '#lib/domain.ts';
  import { addDays, formatDate, localDate, weekDates, weekLabel, weekOf } from '#lib/dates.ts';
  import { dateSchema, type Occurrence, type Settings } from '#lib/model.ts';
  import { checkReminders } from '#lib/reminders.ts';
  import { cloudClient } from '#lib/cloud.ts';
  import { syncNow } from '#lib/sync.svelte.ts';
  import { motion } from '#lib/motion.ts';

  let { data }: PageProps = $props();
  const origin = $derived(page.url.origin);
  const description = 'Build your routine once. Check it off today, it comes back fresh tomorrow.';
  const initialToday = untrack(() => data.initialDate);
  let today = $state(initialToday);
  let week = $state(weekOf(initialToday, 1));
  let expanded = $state(initialToday);
  let direction = $state(0);
  let intro = $state(true);
  let composer = $state<{ date: string; occurrence: Occurrence | null } | null>(null);
  let dragging = $state<Occurrence | null>(null);
  let dragX = $state(0);
  let dragY = $state(0);
  let hoverDay = $state('');
  let touchX = 0;
  let touchY = 0;
  let droppedAt = 0;
  let midnightTimer: ReturnType<typeof setTimeout>;
  let syncTimer: ReturnType<typeof setTimeout>;

  const weekStart = $derived(app.data.settings.weekStart);
  const currentWeek = $derived(weekOf(today, weekStart));
  const dates = $derived(weekDates(week));
  const stack = $derived(dates.map(date => {
    const items = getOccurrences(app.data, date);
    const visible = items.filter(item => !item.completedAt || (app.data.settings.showCompleted && !(app.data.settings.hidePastCompleted && date < today)));
    return { date, items, visible, complete: items.filter(item => item.completedAt !== null).length };
  }));
  const title = $derived(
    week === currentWeek ? 'This week'
      : week === addDays(currentWeek, 7) ? 'Next week'
      : week === addDays(currentWeek, -7) ? 'Last week'
      : weekLabel(week)
  );

  function navigate(delta: number): void {
    intro = false;
    direction = delta;
    week = addDays(week, delta * 7);
    expanded = addDays(expanded, delta * 7);
  }
  async function revealToday(): Promise<void> {
    await tick();
    const sheet = document.querySelector('.day.open');
    if (sheet && sheet.getBoundingClientRect().bottom > innerHeight - 96) sheet.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function goToday(): void {
    if (week !== currentWeek) { intro = false; direction = week < currentWeek ? 1 : -1; }
    week = currentWeek;
    expanded = today;
    void revealToday();
  }
  const themes = [
    { value: 'system', label: 'Auto', icon: 'auto' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' }
  ] as const;
  const theme = $derived(app.data.settings.theme);
  function setTheme(value: Settings['theme']): void {
    const settings = app.data.settings;
    if (settings.theme === value) return;
    const apply = async () => {
      commit({ ...app.data, settings: { ...settings, theme: value, updatedAt: Math.max(Date.now(), settings.updatedAt + 1) } });
      await tick();
    };
    if (document.startViewTransition && motion(1)) document.startViewTransition(apply);
    else void apply();
  }
  $effect(() => {
    if (!app.ready) return;
    const root = document.documentElement;
    if (theme === 'system') { delete root.dataset['theme']; localStorage.removeItem('folio-appearance'); }
    else { root.dataset['theme'] = theme; localStorage.setItem('folio-appearance', theme); }
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((meta, index) => { meta.content = theme === 'dark' ? '#171816' : theme === 'light' ? '#eae9e4' : index === 0 ? '#eae9e4' : '#171816'; });
  });

  function openComposer(date: string, occurrence: Occurrence | null = null): void { composer = { date, occurrence }; }
  function focusOpener(event: Event): void {
    const button = event.target instanceof Element ? event.target.closest('button[data-sheet-opener]') : null;
    if (button instanceof HTMLElement) button.focus({ preventScroll: true });
  }
  function refreshDay(): void {
    const next = localDate();
    if (next !== today) { today = next; goToday(); }
    clearTimeout(midnightTimer);
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 20);
    midnightTimer = setTimeout(refreshDay, midnight.getTime() - Date.now());
  }

  function stopDrag(): void {
    dragging = null;
    hoverDay = '';
    droppedAt = Date.now();
    window.removeEventListener('pointermove', moveDrag);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', stopDrag);
  }
  function moveDrag(event: PointerEvent): void {
    dragX = event.clientX;
    dragY = event.clientY;
    hoverDay = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-day]')?.getAttribute('data-day') ?? '';
    if (event.clientY < 72) window.scrollBy(0, -12);
    else if (event.clientY > innerHeight - 72) window.scrollBy(0, 12);
  }
  function endDrag(event: PointerEvent): void {
    const item = dragging;
    if (!item) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const row = element?.closest('[data-task]');
    const target = element?.closest('[data-day]')?.getAttribute('data-day');
    if (target && target !== item.date) {
      commit(moveOccurrence(app.data, item, target));
      expanded = target;
      announce(`Moved to ${formatDate(target, { weekday: 'long' })}`);
    } else if (row && row.getAttribute('data-task') !== item.key) {
      const sibling = getOccurrences(app.data, item.date).find(entry => entry.key === row.getAttribute('data-task'));
      if (sibling && sibling.time === item.time) {
        const below = event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        commit(reorderOccurrence(app.data, item, sibling.order + (below ? 0.01 : -0.01)));
        announce('Task reordered');
      }
    }
    stopDrag();
  }
  function startDrag(item: Occurrence, x: number, y: number): void {
    dragging = item;
    dragX = x;
    dragY = y;
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', stopDrag);
  }

  onMount(() => {
    let active = true;
    const handleSaved = () => { clearTimeout(syncTimer); syncTimer = setTimeout(() => { void syncNow(); }, 700); };
    const online = () => { app.online = navigator.onLine; if (app.online) void syncNow(); };
    const resume = () => { if (document.visibilityState === 'visible') { refreshDay(); online(); } };
    const holdScroll = (event: TouchEvent) => { if (dragging) event.preventDefault(); };
    void initialize().then(() => {
      if (!active) return;
      today = localDate();
      expanded = today;
      week = weekOf(today, app.data.settings.weekStart);
      const requested = dateSchema.safeParse(new URLSearchParams(location.search).get('date'));
      if (requested.success) { expanded = requested.data; week = weekOf(expanded, app.data.settings.weekStart); }
      app.online = navigator.onLine;
      refreshDay();
      void revealToday();
      void syncNow();
    });
    let auth: Subscription | null = null;
    void cloudClient().then(client => { if (active) auth = client?.auth.onAuthStateChange(() => { handleSaved(); }).data.subscription ?? null; });
    const interval = setInterval(() => {
      void checkReminders(app.data).catch(error => { if (error instanceof Error) app.status = 'A reminder couldn’t be shown.'; });
      if (app.online) void syncNow();
    }, 30000);
    document.addEventListener('touchmove', holdScroll, { passive: false });
    window.addEventListener('click', focusOpener, true);
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('folio-saved', handleSaved);
    return () => {
      active = false;
      clearTimeout(midnightTimer);
      clearTimeout(syncTimer);
      clearInterval(interval);
      auth?.unsubscribe();
      stopDrag();
      document.removeEventListener('touchmove', holdScroll);
      window.removeEventListener('click', focusOpener, true);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('folio-saved', handleSaved);
    };
  });
</script>

<svelte:head>
  <title>Daystack · Repeating routines, fresh every day</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={`${origin}/`} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Daystack" />
  <meta property="og:title" content="Daystack · Done today. Fresh tomorrow." />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={`${origin}/`} />
  <meta property="og:image" content={`${origin}/og.png`} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="An orange check mark tile beside the words Done today. Fresh tomorrow." />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Daystack · Done today. Fresh tomorrow." />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={`${origin}/og.png`} />
</svelte:head>

<main class="app">
  <nav class="week-bar" aria-label="Week">
    <button class="nav-arrow" aria-label="Previous week" onclick={() => navigate(-1)}><Icon name="left" size={20} /></button>
    <button class="week-title" onclick={goToday} disabled={week === currentWeek} aria-label={week === currentWeek ? 'This week' : `${title}. Back to this week`}>
      <span>{title}</span>
      {#if week !== currentWeek}<span class="today-pill" transition:fly={{ y: 4, duration: motion(220) }}>Today</span>{/if}
    </button>
    <button class="nav-arrow" aria-label="Next week" onclick={() => navigate(1)}><Icon name="right" size={20} /></button>
  </nav>

  {#if app.error}<div class="error-banner" role="alert">{app.error}</div>{/if}

  {#key week}
    <div
      class="stack"
      class:intro
      role="group"
      aria-label={`Week of ${formatDate(week, { month: 'long', day: 'numeric' })}`}
      in:fly={{ x: direction * 56, duration: motion(380), easing: quintOut, opacity: 0 }}
      ontouchstart={(event) => { touchX = event.changedTouches[0]?.clientX ?? 0; touchY = event.changedTouches[0]?.clientY ?? 0; }}
      ontouchend={(event) => {
        if (dragging || Date.now() - droppedAt < 400) return;
        const x = (event.changedTouches[0]?.clientX ?? touchX) - touchX;
        const y = (event.changedTouches[0]?.clientY ?? touchY) - touchY;
        if (Math.abs(x) > 80 && Math.abs(y) < 48 && !(event.target instanceof Element && event.target.closest('input,textarea'))) navigate(x < 0 ? 1 : -1);
      }}
    >
      {#each stack as day, index (day.date)}
        {@const opened = expanded === day.date}
        {@const isToday = day.date === today}
        <section class="day" class:open={opened} class:today={isToday} class:drop={hoverDay === day.date && dragging?.date !== day.date} data-day={day.date} style:--i={index}>
          <button class="day-head" onclick={() => (expanded = day.date)} aria-expanded={opened} aria-controls={`day-${day.date}`}>
            <h2 class="day-name">{formatDate(day.date, { weekday: 'long' })}</h2>
            <span class="day-date">{#if isToday}<span class="today-dot"></span><span>Today</span><span aria-hidden="true">·</span>{/if}<span>{formatDate(day.date, { month: 'short', day: 'numeric' })}</span></span>
            {#if day.items.length}
              <span class="day-count" class:done={day.complete === day.items.length} aria-label={`${day.complete} of ${day.items.length} done`}>
                {#if day.complete === day.items.length}<Icon name="check" size={18} stroke={2.2} />{:else}{day.complete}<span>/{day.items.length}</span>{/if}
              </span>
            {/if}
          </button>
          {#if opened}
            <div class="day-body" id={`day-${day.date}`} transition:slide={{ duration: motion(360), easing: quintOut }}>
              {#if day.visible.length}
                <ul class="tasks">
                  {#each day.visible as item (item.key)}
                    <li data-task={item.key} animate:flip={{ duration: motion(320), easing: quintOut }} transition:slide={{ duration: motion(260), easing: quintOut }}>
                      <TaskRow
                        {item}
                        missed={day.date < today}
                        ghost={dragging?.key === item.key}
                        oncomplete={() => { const wasDone = item.completedAt !== null; commit(toggleComplete(app.data, item)); announce(wasDone ? 'Marked not done' : 'Done'); }}
                        onedit={() => openComposer(item.date, item)}
                        onlift={(x, y) => startDrag(item, x, y)}
                      />
                    </li>
                  {/each}
                </ul>
              {:else if app.ready}
                <button class="empty-add" data-sheet-opener onclick={() => openComposer(day.date)}>
                  <Icon name="plus" size={18} />Add to {formatDate(day.date, { weekday: 'long' })}
                </button>
              {/if}
            </div>
          {/if}
        </section>
      {/each}
    </div>
  {/key}

  {#if app.ready}
    <div class="theme-toggle" role="group" aria-label="Appearance" style:--slot={themes.findIndex(item => item.value === theme)}>
      {#each themes as item (item.value)}
        <button aria-pressed={theme === item.value} aria-label={item.label} title={item.label} onclick={() => setTheme(item.value)}><Icon name={item.icon} size={16} /></button>
      {/each}
    </div>
  {/if}
</main>

<button class="fab" data-sheet-opener aria-label={`Add a task to ${formatDate(expanded, { weekday: 'long' })}`} disabled={!app.ready} onclick={() => openComposer(expanded)}>
  <Icon name="plus" size={26} stroke={2} />
</button>

<span class="sr-only" aria-live="polite">{app.status}</span>
{#if dragging}<div class="drag-preview" style:left={`${dragX}px`} style:top={`${dragY}px`}>{dragging.title}</div>{/if}
{#if composer}<Composer date={composer.date} occurrence={composer.occurrence} onclose={() => (composer = null)} />{/if}
