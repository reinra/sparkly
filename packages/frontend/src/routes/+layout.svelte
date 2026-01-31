<script lang="ts">
  import { page } from '$app/state';
  
  let { children } = $props();
</script>

<div class="app">
  <nav>
    <div class="nav-container">
      <h1 class="logo">Twinkly LED Controller</h1>
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
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    width: 100%;
    box-sizing: border-box;
  }
</style>
