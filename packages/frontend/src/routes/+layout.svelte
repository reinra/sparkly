<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { backendClient } from '../frontendApiClient';
  import { deviceStore } from '../stores/deviceStore.svelte';
  
  let { children } = $props();
  let buildDate = $state<string | undefined>(undefined);

  onMount(async () => {
    try {
      const { status, body } = await backendClient.getSystemInfo();
      if (status === 200) {
        if (body.buildDate) {
          buildDate = new Date(body.buildDate).toISOString().replace('T', ' ').split('.')[0];
        }
        deviceStore.setDeviceModes(body.deviceModes);
      }
    } catch (e) {
      console.error('Failed to fetch system info', e);
    }
  });
</script>

<div class="app">
  <nav>
    <div class="nav-container">
      <div class="brand-container">
        <h1 class="logo"><a href="/devices">Twinkly LED Controller</a></h1>
        {#if buildDate}
          <div class="build-date">Build: {buildDate}</div>
        {/if}
      </div>
      <ul class="menu">
        <li>
          <a href="/devices" class:active={page.url.pathname === '/devices'}>
            Devices
          </a>
        </li>
        <li>
          <a href="/debug" class:active={page.url.pathname === '/debug'}>
            Debug
          </a>
        </li>
      </ul>
    </div>
  </nav>
  
  <main>
    {@render children()}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #f5f5f5;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  nav {
    background: #ff3e00;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .nav-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .logo a {
    color: inherit;
    text-decoration: none;
  }

  .brand-container {
    display: flex;
    flex-direction: column;
  }

  .build-date {
    font-size: 0.7rem;
    opacity: 0.8;
    margin-top: 0px;
    font-weight: normal;
  }

  .menu {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 2rem;
  }

  .menu a {
    color: white;
    text-decoration: none;
    padding: 1.5rem 0;
    display: block;
    font-weight: 500;
    border-bottom: 3px solid transparent;
    transition: border-color 0.2s;
  }

  .menu a:hover {
    border-bottom-color: rgba(255, 255, 255, 0.5);
  }

  .menu a.active {
    border-bottom-color: white;
  }

  main {
    flex: 1;
    max-width: 2000px;
    margin: 0 auto;
    padding: 2rem;
    width: 100%;
    box-sizing: border-box;
  }
</style>
