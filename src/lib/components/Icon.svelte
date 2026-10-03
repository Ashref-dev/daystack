<script lang="ts">
  let {name,size=20}: {name:string;size?:number}=$props();
  const paths:Record<string,string>={
    plus:'M12 5v14M5 12h14', close:'m6 6 12 12M18 6 6 18', left:'m14 6-6 6 6 6', right:'m10 6 6 6-6 6',
    more:'M5 12h.01M12 12h.01M19 12h.01', check:'m5 12 4 4L19 6', expand:'M14 4h6v6M20 4l-8 8M10 20H4v-6M4 20l8-8',
    stack:'m4 8 8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 18l8 4 8-4', sun:'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 1.4 1.4M17 17l1.4 1.4M5.6 18.4 1.4-1.4M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    moon:'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z', settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
    calendar:'M4 6h16v15H4V6ZM8 3v6M16 3v6M4 11h16', download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
    arrow:'M4 12h16m-6-6 6 6-6 6', repeat:'m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3',
    trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7', copy:'M9 9h12v12H9V9ZM15 9V3H3v12h6', up:'m6 14 6-6 6 6', down:'m6 10 6 6 6-6',
    grip:'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01', bell:'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4', cloud:'M6 18a4 4 0 0 1-1-7 7 7 0 0 1 13-2 5 5 0 0 1 0 9H6', wifi:'M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0M12 20h.01'
  };
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name]??paths['plus']}/></svg>
