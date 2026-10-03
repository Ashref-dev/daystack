<script lang="ts">
  import '@fontsource/inter/latin-400.css';
  import '@fontsource/inter/latin-500.css';
  import '@fontsource/inter/latin-600.css';
  import '@fontsource/archivo-black/latin-400.css';
  import '../app.css';
  import type { Snippet } from 'svelte';
  let {children}:{children:Snippet}=$props();
</script>
{@render children()}
