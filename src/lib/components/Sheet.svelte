<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  let {title,onclose,children,wide=false}:{title:string;onclose:()=>void;children:Snippet;wide?:boolean}=$props();
  const titleId=$props.id();
  let dialog:HTMLDialogElement;
  onMount(()=>{
    const opener=document.activeElement;dialog.showModal();const initial=dialog.querySelector('[data-initial-focus]');if(initial instanceof HTMLElement)initial.focus();
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';const viewport=window.visualViewport;
    function resize(){document.documentElement.style.setProperty('--viewport-height',`${viewport?.height??innerHeight}px`);document.documentElement.style.setProperty('--keyboard-offset',`${Math.max(0,innerHeight-(viewport?.height??innerHeight)-(viewport?.offsetTop??0))}px`);}
    resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
    return()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);document.documentElement.style.removeProperty('--viewport-height');document.documentElement.style.removeProperty('--keyboard-offset');dialog.close();document.body.style.overflow=previous;if(opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});};
  });
</script>
<dialog bind:this={dialog} class:wide aria-labelledby={titleId} oncancel={(event)=>{event.preventDefault();onclose();}} onclick={(event)=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onclose();}}}>
  <div class="sheet-handle"></div>
  <header class="sheet-header"><h2 id={titleId}>{title}</h2><button class="icon-button" onclick={onclose} aria-label="Close"><Icon name="close"/></button></header>
  <div class="sheet-body">{@render children()}</div>
</dialog>
