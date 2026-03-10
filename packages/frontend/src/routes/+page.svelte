<script lang="ts">
  import { goto } from '$app/navigation';

  $effect(() => {
    goto('/devices');
  });
</script>

<div class="home">
  <p>Redirecting to devices page...</p>
</div>

<style>
  .home {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-secondary);
  }
</style>
