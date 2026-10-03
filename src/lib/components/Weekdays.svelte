<script lang="ts">
  import { days } from '#lib/dates.ts';
  let {value=$bindable([]),disabled=false}:{value:number[];disabled?:boolean}=$props();
</script>
<div class="weekday-pills" role="group" aria-label="Repeat on weekdays">
  {#each days as day}<button type="button" class:selected={value.includes(day.value)} aria-label={day.label} aria-pressed={value.includes(day.value)} {disabled} onclick={()=>value=value.includes(day.value)?value.filter(item=>item!==day.value):[...value,day.value]}>{day.label.slice(0,1)}</button>{/each}
</div>
