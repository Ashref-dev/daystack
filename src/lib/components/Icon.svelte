<script lang="ts">
  let { name, size = 20, stroke = 1.8 }: { name: string; size?: number; stroke?: number } = $props();
  const paths: Record<string, string> = {
    plus: 'M12 5v14M5 12h14',
    close: 'm6 6 12 12M18 6 6 18',
    left: 'm14 6-6 6 6 6',
    right: 'm10 6 6 6-6 6',
    check: 'm5 12 4 4L19 6',
    calendar: 'M4 6h16v15H4V6ZM8 3v6M16 3v6M4 11h16',
    clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    repeat: 'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3',
    flag: 'M5 21V4h11l-2 4 2 4H5',
    note: 'M5 6h14M5 11h14M5 16h9',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'
  };
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name] ?? paths['plus']} /></svg>
