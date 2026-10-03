<script lang="ts">
  import '@fontsource-variable/instrument-sans/wght.css';
  import '@fontsource/instrument-serif/latin-400.css';
  import '../app.css';
  import type { Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();
</script>
{@render children()}
