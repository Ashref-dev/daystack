<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  let { label, onclose, children, footer }: { label: string; onclose: () => void; children: Snippet; footer?: Snippet } = $props();
  let dialog: HTMLDialogElement;
  let closing = $state(false);
  let dragStart = -1;
  let dragOffset = 0;
  let dragTime = 0;

  export function dismiss(): void {
    if (closing) return;
    closing = true;
    const finish = () => { clearTimeout(fallback); dialog.removeEventListener('animationend', done); onclose(); };
    const done = (event: AnimationEvent) => { if (event.target === dialog) finish(); };
    const fallback = setTimeout(finish, 340);
    dialog.addEventListener('animationend', done);
  }

  function grab(event: PointerEvent): void {
    if (event.target instanceof Element && event.target.closest('button')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId);
    dragStart = event.clientY;
    dragOffset = 0;
    dragTime = performance.now();
    dialog.style.transition = 'none';
  }
  function drag(event: PointerEvent): void {
    if (dragStart < 0) return;
    const delta = event.clientY - dragStart;
    dragOffset = delta > 0 ? delta : delta * 0.15;
    dialog.style.transform = `translateY(${dragOffset}px)`;
  }
  function release(): void {
    if (dragStart < 0) return;
    dragStart = -1;
    const velocity = dragOffset / Math.max(1, performance.now() - dragTime);
    dialog.style.transition = '';
    if (dragOffset > 110 || (dragOffset > 24 && velocity > 0.5)) dismiss();
    else dialog.style.transform = '';
  }

  onMount(() => {
    const opener = document.activeElement;
    dialog.showModal();
    const initial = dialog.querySelector('[data-initial-focus]');
    if (initial instanceof HTMLElement) initial.focus({ preventScroll: true });
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const viewport = window.visualViewport;
    const root = document.documentElement.style;
    function resize() {
      root.setProperty('--viewport-height', `${viewport?.height ?? innerHeight}px`);
      root.setProperty('--keyboard-offset', `${Math.max(0, innerHeight - (viewport?.height ?? innerHeight) - (viewport?.offsetTop ?? 0))}px`);
    }
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      root.removeProperty('--viewport-height');
      root.removeProperty('--keyboard-offset');
      dialog.close();
      document.body.style.overflow = previous;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  });
</script>

<dialog
  bind:this={dialog}
  class="sheet"
  class:closing
  aria-label={label}
  oncancel={(event) => { event.preventDefault(); dismiss(); }}
  onclick={(event) => { if (event.target === dialog) dismiss(); }}
>
  <div class="sheet-grab" onpointerdown={grab} onpointermove={drag} onpointerup={release} onpointercancel={release} role="presentation">
    <button class="sheet-close" type="button" onclick={dismiss} aria-label="Close"><Icon name="close" size={18} /></button>
  </div>
  <div class="sheet-body">{@render children()}</div>
  {#if footer}<div class="sheet-foot">{@render footer()}</div>{/if}
</dialog>
