<script lang="ts" module>
  export type WheelOption = Readonly<{ value: string; label: string }>;
</script>

<script lang="ts">
  // iOS-style wheel. Cylinder geometry, inertia and snap physics adapted from
  // @ncdai/react-wheel-picker (MIT, https://github.com/ncdai/react-wheel-picker).
  import { onMount, untrack } from 'svelte';

  let {
    options,
    value,
    label,
    onchange,
    infinite = false,
    visibleCount = 20,
    itemHeight = 36,
    align = 'center'
  }: {
    options: readonly WheelOption[];
    value: string;
    label: string;
    onchange: (value: string) => void;
    infinite?: boolean;
    visibleCount?: number;
    itemHeight?: number;
    align?: 'center' | 'start' | 'end';
  } = $props();

  const RESISTANCE = 0.3;
  const MAX_VELOCITY = 30;
  const DECELERATION = 30;
  const SNAP_BACK = 10;
  const SENSITIVITY = 5;
  const easeOutCubic = (progress: number) => Math.pow(progress - 1, 3) + 1;
  const clamp = (input: number, min: number, max: number) => Math.max(min, Math.min(input, max));

  const angle = $derived(360 / visibleCount);
  const radius = $derived(itemHeight / Math.tan((angle * Math.PI) / 180));
  const height = $derived(Math.round(radius * 2 + itemHeight * 0.25));
  const quarter = $derived(visibleCount >> 2);
  const list = $derived.by(() => {
    if (!infinite || !options.length) return options;
    const repeated: WheelOption[] = [];
    while (repeated.length < Math.ceil(visibleCount / 2)) repeated.push(...options);
    return repeated;
  });
  const wheelItems = $derived.by(() => {
    const items = list.map((option, index) => ({ index, option, rotation: -angle * index }));
    if (infinite && list.length) {
      for (let offset = 0; offset < quarter; offset++) {
        const before = list[list.length - offset - 1];
        const after = list[offset];
        if (before) items.unshift({ index: -offset - 1, option: before, rotation: angle * (offset + 1) });
        if (after) items.push({ index: offset + list.length, option: after, rotation: -angle * (offset + list.length) });
      }
    }
    return items;
  });
  const highlightItems = $derived(infinite ? [...list.slice(-1), ...list, ...list.slice(0, 1)] : list);

  let root: HTMLDivElement;
  let wheel: HTMLUListElement;
  let highlight: HTMLUListElement;
  let current = $state(0);
  let scroll = 0;
  let frame = 0;
  let dragging = false;
  let pointerId = -1;
  let startY = 0;
  let dragScroll = 0;
  let isClick = true;
  let samples: [number, number][] = [];
  let wheelDelta = 0;
  let lastWheel = 0;

  const normalize = (input: number) => ((input % list.length) + list.length) % list.length;

  function render(input: number): number {
    const position = infinite ? normalize(input) : input;
    wheel.style.transform = `translateZ(${-radius}px) rotateX(${angle * position}deg)`;
    for (const node of wheel.children) {
      if (!(node instanceof HTMLElement)) continue;
      const visibility = Math.abs(Number(node.dataset['index']) - position) > quarter ? 'hidden' : 'visible';
      if (node.style.visibility !== visibility) node.style.visibility = visibility;
    }
    highlight.style.transform = `translateY(${-position * itemHeight}px)`;
    return position;
  }

  function select(input: number): void {
    const index = infinite ? Math.round(normalize(input)) % list.length : clamp(Math.round(input), 0, list.length - 1);
    scroll = render(index);
    current = index;
    const option = list[index];
    if (option && option.value !== value) onchange(option.value);
  }

  function animate(from: number, to: number, duration: number): void {
    cancelAnimationFrame(frame);
    if (from === to || duration <= 0) {
      select(to);
      return;
    }
    const began = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - began) / 1000;
      if (elapsed < duration) {
        scroll = render(from + easeOutCubic(elapsed / duration) * (to - from));
        frame = requestAnimationFrame(tick);
      } else select(to);
    };
    frame = requestAnimationFrame(tick);
  }

  function step(delta: number): void {
    if (!list.length) return;
    const from = scroll;
    const to = infinite ? Math.round(from + delta) : clamp(Math.round(from + delta), 0, list.length - 1);
    const distance = Math.abs(to - from);
    if (!distance) return;
    animate(from, to, Math.sqrt(distance / SENSITIVITY));
  }

  function decelerate(velocity: number): void {
    const from = scroll;
    let to: number;
    let duration: number;
    if (!infinite && (from < 0 || from > list.length - 1)) {
      to = clamp(from, 0, list.length - 1);
      duration = Math.sqrt(Math.abs((from - to) / SNAP_BACK));
    } else {
      const deceleration = velocity > 0 ? -DECELERATION : DECELERATION;
      duration = Math.abs(velocity / deceleration);
      to = Math.round(from + velocity * duration + 0.5 * deceleration * duration * duration);
      if (!infinite) to = clamp(to, 0, list.length - 1);
      duration = Math.max(Math.sqrt(Math.abs((to - from) / DECELERATION)), Math.sqrt(Math.abs(to - from) / SENSITIVITY) * 0.6);
    }
    animate(from, to, duration);
  }

  function pointerdown(event: PointerEvent): void {
    if (!list.length || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    root.focus({ preventScroll: true });
    root.setPointerCapture(event.pointerId);
    cancelAnimationFrame(frame);
    dragging = true;
    pointerId = event.pointerId;
    startY = event.clientY;
    dragScroll = scroll;
    isClick = true;
    samples = [[startY, performance.now()]];
  }

  function pointermove(event: PointerEvent): void {
    if (!dragging || event.pointerId !== pointerId) return;
    if (isClick && Math.abs(event.clientY - startY) > 5) isClick = false;
    samples.push([event.clientY, performance.now()]);
    if (samples.length > 5) samples.shift();
    let next = scroll + (startY - event.clientY) / itemHeight;
    if (infinite) next = normalize(next);
    else if (next < 0) next *= RESISTANCE;
    else if (next > list.length - 1) next = list.length - 1 + (next - (list.length - 1)) * RESISTANCE;
    dragScroll = render(next);
  }

  function pointerup(event: PointerEvent): void {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    if (isClick) {
      const bounds = root.getBoundingClientRect();
      const offset = clamp((startY - (bounds.top + bounds.height / 2)) / radius, -1, 1);
      step(Math.round(Math.asin(offset) / ((angle * Math.PI) / 180)));
      return;
    }
    let velocity = 0;
    const last = samples.at(-1);
    const previous = samples.at(-2);
    if (last && previous && last[1] > previous[1]) {
      const perSecond = ((previous[0] - last[0]) / itemHeight) * 1000 / (last[1] - previous[1]);
      velocity = clamp(perSecond, -MAX_VELOCITY, MAX_VELOCITY);
    }
    scroll = dragScroll;
    decelerate(velocity);
  }

  function pointercancel(): void {
    if (!dragging) return;
    dragging = false;
    scroll = dragScroll;
    decelerate(0);
  }

  function keydown(event: KeyboardEvent): void {
    const moves: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
    if (!infinite) Object.assign(moves, { Home: -scroll, End: list.length - 1 - scroll });
    const delta = moves[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    step(delta);
  }

  onMount(() => {
    const wheelHandler = (event: WheelEvent) => {
      event.preventDefault();
      wheelDelta += event.deltaY;
      const now = performance.now();
      if (Math.abs(wheelDelta) < 24 || now - lastWheel < 70) return;
      lastWheel = now;
      step(Math.sign(wheelDelta));
      wheelDelta = 0;
    };
    root.addEventListener('wheel', wheelHandler, { passive: false });
    return () => {
      root.removeEventListener('wheel', wheelHandler);
      cancelAnimationFrame(frame);
    };
  });

  $effect(() => {
    const target = value;
    const items = list;
    void wheelItems;
    untrack(() => {
      const index = items.findIndex(option => option.value === target);
      if (index < 0 || dragging) return;
      cancelAnimationFrame(frame);
      scroll = render(index);
      current = index;
    });
  });
</script>

<div
  bind:this={root}
  class="wheel"
  data-align={align}
  style:height={`${height}px`}
  role="spinbutton"
  tabindex="0"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={Math.max(0, list.length - 1)}
  aria-valuenow={current}
  aria-valuetext={list[current]?.label ?? ''}
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={pointerup}
  onpointercancel={pointercancel}
  onlostpointercapture={pointercancel}
  onkeydown={keydown}
>
  <ul bind:this={wheel} class="wheel-options" aria-hidden="true">
    {#each wheelItems as item (item.index)}
      <li
        class="wheel-option"
        data-index={item.index}
        style:top={`${-itemHeight / 2}px`}
        style:height={`${itemHeight}px`}
        style:transform={`rotateX(${item.rotation}deg) translateZ(${radius}px)`}
      >{item.option.label}</li>
    {/each}
  </ul>
  <div class="wheel-highlight" style:height={`${itemHeight}px`} aria-hidden="true">
    <ul bind:this={highlight} style:top={infinite ? `${-itemHeight}px` : '0px'}>
      {#each highlightItems as option, index (index)}
        <li style:height={`${itemHeight}px`}>{option.label}</li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .wheel {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    perspective: 2000px;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: grab;
    outline: none;
    font-variant-numeric: tabular-nums;
    mask-image: linear-gradient(to bottom, transparent 0%, #000 24%, #000 76%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 24%, #000 76%, transparent 100%);
  }
  .wheel:active { cursor: grabbing; }
  ul { margin: 0; padding: 0; list-style: none; }
  .wheel-options {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 0;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform;
  }
  .wheel-option {
    position: absolute;
    left: 0;
    width: 100%;
    visibility: hidden;
    color: var(--muted);
    font-size: 18px;
  }
  .wheel-option, .wheel-highlight li {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    white-space: nowrap;
  }
  [data-align='start'] .wheel-option, [data-align='start'] .wheel-highlight li { justify-content: flex-start; }
  [data-align='end'] .wheel-option, [data-align='end'] .wheel-highlight li { justify-content: flex-end; }
  .wheel-highlight {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    overflow: hidden;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--ink);
    font-size: 18px;
    font-weight: 600;
    border-radius: 10px;
  }
  .wheel-highlight ul { position: absolute; width: 100%; }
  .wheel:focus-visible .wheel-highlight { box-shadow: inset 0 0 0 2px var(--ink); }
</style>
